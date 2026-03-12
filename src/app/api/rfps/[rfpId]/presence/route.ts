import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { getRedis } from '@/lib/storage/kv'

const PRESENCE_TTL = 30 // seconds
const PRESENCE_PREFIX = 'presence:'

export interface PresenceEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  color: string
  lastSeenAt: string
}

function presenceKey(rfpId: string, userId: string): string {
  return `${PRESENCE_PREFIX}${rfpId}:${userId}`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    await requireAuth()
    const { rfpId } = await params

    // Scan for all presence keys for this RFP
    const pattern = `${PRESENCE_PREFIX}${rfpId}:*`
    let cursor = 0
    const viewers: PresenceEntry[] = []

    try {
      const redis = getRedis()
      if (redis) {
        do {
          const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 20 })
          cursor = Number(nextCursor)
          if (keys.length > 0) {
            const values = await redis.mget<(PresenceEntry | null)[]>(...keys)
            for (const v of values) {
              if (v) viewers.push(typeof v === 'string' ? JSON.parse(v) : v)
            }
          }
        } while (cursor !== 0)
      }
    } catch {
      // Redis unavailable — return empty list
    }

    return NextResponse.json({ viewers }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { rfpId } = await params
    const body = await request.json().catch(() => ({}))

    const entry: PresenceEntry = {
      userId: auth.userId,
      displayName: body.displayName ?? auth.userId,
      avatarUrl: body.avatarUrl ?? null,
      color: body.color ?? '#6366f1',
      lastSeenAt: new Date().toISOString(),
    }

    try {
      const redis = getRedis()
      if (redis) await redis.set(presenceKey(rfpId, auth.userId), JSON.stringify(entry), { ex: PRESENCE_TTL })
    } catch {
      // Redis unavailable — heartbeat is best-effort
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
