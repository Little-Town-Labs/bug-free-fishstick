import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from '@/lib/storage/kv'

export type RateLimitTier = 'standard' | 'strict' | 'upload'

const TIER_CONFIG = {
  standard: { max: 60, window: '1 m' as const, prefix: 'rl:standard' },
  strict: { max: 10, window: '1 m' as const, prefix: 'rl:strict' },
  upload: { max: 20, window: '1 m' as const, prefix: 'rl:upload' },
} satisfies Record<RateLimitTier, { max: number; window: `${number} ${string}`; prefix: string }>

let _limiters: Record<RateLimitTier, Ratelimit> | null = null
function getLimiters(): Record<RateLimitTier, Ratelimit> | null {
  if (_limiters) return _limiters

  const redis = getRedis()
  if (!redis) return null

  _limiters = Object.fromEntries(
    (Object.entries(TIER_CONFIG) as [RateLimitTier, typeof TIER_CONFIG[RateLimitTier]][]).map(
      ([tier, cfg]) => [tier, new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(cfg.max, cfg.window),
        prefix: cfg.prefix,
      })]
    )
  ) as Record<RateLimitTier, Ratelimit>
  return _limiters
}

export interface RateLimitExceeded {
  limit: number
  remaining: number
  reset: number
}

/** Builds the standard rate-limit response headers for a 429. */
export function rateLimitHeaders(info: RateLimitExceeded): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': info.reset.toString(),
    'Retry-After': Math.max(0, Math.ceil((info.reset - Date.now()) / 1000)).toString(),
  }
}

/**
 * Check rate limit for a given identifier (typically userId or orgId).
 * Returns null if allowed, or the limit details when rate-limited.
 * Skips rate limiting gracefully when Redis is unavailable.
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'standard'
): Promise<RateLimitExceeded | null> {
  const limiters = getLimiters()
  if (!limiters) return null // Redis unavailable — allow request

  const limiter = limiters[tier]
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier)

    if (!success) {
      return { limit, remaining, reset }
    }
  } catch (error) {
    console.error('[rate-limit] Redis unreachable, allowing request:', error instanceof Error ? error.message : String(error))
  }

  return null
}
