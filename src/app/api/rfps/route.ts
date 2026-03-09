import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'
import { Redis } from '@upstash/redis'
import { decryptJson } from '@/lib/services/encryption'

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

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  }
  return _redis
}

const CACHE_TTL = 60 // seconds

export async function GET() {
  try {
    const auth = await requireAuth()

    const adminFlag = isAdmin(auth.orgRole) ? 'admin' : auth.userId
    const cacheKey = `rfps:${auth.orgId}:${adminFlag}`

    try {
      const cached = await getRedis().get<typeof rfpsList>(cacheKey)
      if (cached) return NextResponse.json({ rfps: cached.map(decryptRfpPii) }, { status: 200 })
    } catch {
      // KV unavailable in local dev — fall through to DB
    }

    const whereClause = isAdmin(auth.orgRole)
      ? eq(rfps.organizationId, auth.orgId)
      : and(eq(rfps.organizationId, auth.orgId), eq(rfps.assignedUserId, auth.userId))

    const rfpsList = await db.select().from(rfps).where(whereClause)

    try {
      await getRedis().set(cacheKey, rfpsList, { ex: CACHE_TTL })
    } catch {
      // KV unavailable — proceed without caching
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
      const adminKey = `rfps:${auth.orgId}:admin`
      const memberKey = `rfps:${auth.orgId}:${auth.userId}`
      await Promise.all([getRedis().del(adminKey), getRedis().del(memberKey)])
    } catch {
      // KV unavailable — proceed
    }

    return NextResponse.json({ rfp: createdRfp }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
