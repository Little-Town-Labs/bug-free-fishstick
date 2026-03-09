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

// Standard rate limit: 60 requests per minute per user
const standardLimiter = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:standard',
})

// Strict rate limit for expensive operations: 10 per minute per user
const strictLimiter = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:strict',
})

// Upload rate limit: 20 per minute per user
const uploadLimiter = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:upload',
})

export type RateLimitTier = 'standard' | 'strict' | 'upload'

const limiters: Record<RateLimitTier, Ratelimit> = {
  standard: standardLimiter,
  strict: strictLimiter,
  upload: uploadLimiter,
}

/**
 * Check rate limit for a given identifier (typically userId or orgId).
 * Returns null if allowed, or a NextResponse with 429 if rate-limited.
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'standard'
): Promise<NextResponse | null> {
  const limiter = limiters[tier]
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
