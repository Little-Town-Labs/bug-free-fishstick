import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { queryAnalyticsSnapshots, type AnalyticsFilters } from '@/lib/services/analytics'
import { getRedis } from '@/lib/storage/kv'
import crypto from 'crypto'

const CACHE_TTL = 30 * 60 // 30 minutes

function buildFiltersHash(filters: AnalyticsFilters): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(filters))
    .digest('hex')
    .slice(0, 8)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const { searchParams } = new URL(request.url)

    const filters: AnalyticsFilters = {
      period: (searchParams.get('period') as AnalyticsFilters['period']) ?? 'day',
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      customerId: searchParams.get('customerId') ?? undefined,
      rfpType: searchParams.get('rfpType') ?? undefined,
    }

    // Non-admin users are scoped to their own assignments
    if (!isAdmin(auth.orgRole)) {
      filters.assignedUserId = auth.userId
    }

    const filtersHash = buildFiltersHash(filters)
    const cacheKey = `analytics:${auth.orgId}:${filters.period}:${filtersHash}`

    // Try cache first
    try {
      const redis = getRedis()
      if (redis) {
        const cached = await redis.get(cacheKey)
        if (cached) {
          return NextResponse.json(
            typeof cached === 'string' ? JSON.parse(cached) : cached,
            { status: 200 }
          )
        }
      }
    } catch {
      // Redis unavailable — fall through
    }

    const snapshots = await queryAnalyticsSnapshots(auth.orgId, filters)

    const response = {
      snapshots,
      filters,
      orgId: auth.orgId,
      isAdmin: isAdmin(auth.orgRole),
      dataAsOf: new Date().toISOString(),
    }

    // Cache the response
    try {
      const redis = getRedis()
      if (redis) await redis.set(cacheKey, JSON.stringify(response), { ex: CACHE_TTL })
    } catch {
      // Redis write failure is non-fatal
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[GET /api/analytics]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
