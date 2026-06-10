import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, isAdmin, AuthError } from '@/lib/utils/auth'
import { readJsonBody } from '@/lib/utils/request'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { customers } from '@/lib/db/schema/customers'
import { createRfpSchema } from '@/lib/utils/validation'
import { eq, and } from 'drizzle-orm'
import { decryptJson } from '@/lib/services/encryption'
import { getRedis } from '@/lib/storage/kv'

interface ContactInfo {
  email?: string
  phone?: string
  address?: string
}

function decryptRfpPii<T extends { customerContactInfo?: unknown }>(rfp: T): T {
  return {
    ...rfp,
    customerContactInfo: decryptJson<ContactInfo>(rfp.customerContactInfo),
  }
}

const CACHE_TTL = 60 // seconds

export async function GET() {
  try {
    const auth = await requireAuthLimited()

    const adminFlag = isAdmin(auth.orgRole) ? 'admin' : auth.userId
    const cacheKey = `rfps:${auth.orgId}:${adminFlag}`

    try {
      const redis = getRedis()
      if (redis) {
        const cached = await redis.get<typeof rfpsList>(cacheKey)
        if (cached) return NextResponse.json({ rfps: cached.map(decryptRfpPii) }, { status: 200 })
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    const whereClause = isAdmin(auth.orgRole)
      ? eq(rfps.organizationId, auth.orgId)
      : and(eq(rfps.organizationId, auth.orgId), eq(rfps.assignedUserId, auth.userId))

    const rfpsList = await db.select().from(rfps).where(whereClause)

    try {
      const redis = getRedis()
      if (redis) await redis.set(cacheKey, rfpsList, { ex: CACHE_TTL })
    } catch {
      // Redis unavailable — proceed without caching
    }

    return NextResponse.json({ rfps: rfpsList.map(decryptRfpPii) }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthLimited()
    const body = await readJsonBody(request)

    const parsed = createRfpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      )
    }

    // Verify the customer belongs to this org before referencing it
    const [existingCustomer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, parsed.data.customerId), eq(customers.organizationId, auth.orgId)))
      .limit(1)

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const [createdRfp] = await db
      .insert(rfps)
      .values({
        organizationId: auth.orgId,
        assignedUserId: auth.userId,
        name: parsed.data.name,
        customerId: parsed.data.customerId,
      })
      .returning()

    // Invalidate the org's RFP list cache for all users (admin + per-member keys)
    try {
      const redis = getRedis()
      if (redis) {
        const keysToDelete: string[] = []
        let cursor = '0'
        do {
          const [nextCursor, keys] = await redis.scan(cursor, {
            match: `rfps:${auth.orgId}:*`,
            count: 100,
          })
          keysToDelete.push(...keys)
          cursor = String(nextCursor)
        } while (cursor !== '0')
        if (keysToDelete.length > 0) {
          await redis.del(...keysToDelete)
        }
      }
    } catch {
      // Redis unavailable — proceed
    }

    return NextResponse.json({ rfp: createdRfp }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
