import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
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
    const auth = await requireAuth()

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
    const auth = await requireAuth()
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!body.customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    const [createdRfp] = await db
      .insert(rfps)
      .values({
        organizationId: auth.orgId,
        assignedUserId: auth.userId,
        name: body.name,
        customerId: body.customerId,
      })
      .returning()

    // Invalidate the org's RFP list cache for all users
    try {
      const redis = getRedis()
      if (redis) {
        const adminKey = `rfps:${auth.orgId}:admin`
        const memberKey = `rfps:${auth.orgId}:${auth.userId}`
        await Promise.all([redis.del(adminKey), redis.del(memberKey)])
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
