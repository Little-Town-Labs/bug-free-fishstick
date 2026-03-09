import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

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

export type RateLimitTier = 'standard' | 'strict' | 'upload'

const TIER_CONFIG = {
  standard: { max: 60, window: '1 m' as const, prefix: 'rl:standard' },
  strict: { max: 10, window: '1 m' as const, prefix: 'rl:strict' },
  upload: { max: 20, window: '1 m' as const, prefix: 'rl:upload' },
} satisfies Record<RateLimitTier, { max: number; window: `${number} ${string}`; prefix: string }>

let _limiters: Record<RateLimitTier, Ratelimit> | null = null
function getLimiters(): Record<RateLimitTier, Ratelimit> {
  if (!_limiters) {
    const redis = getRedis()
    _limiters = Object.fromEntries(
      (Object.entries(TIER_CONFIG) as [RateLimitTier, typeof TIER_CONFIG[RateLimitTier]][]).map(
        ([tier, cfg]) => [tier, new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(cfg.max, cfg.window),
          prefix: cfg.prefix,
        })]
      )
    ) as Record<RateLimitTier, Ratelimit>
  }
  return _limiters
}

/**
 * Check rate limit for a given identifier (typically userId or orgId).
 * Returns null if allowed, or a NextResponse with 429 if rate-limited.
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'standard'
): Promise<NextResponse | null> {
  const limiter = getLimiters()[tier]
  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  return null
}
