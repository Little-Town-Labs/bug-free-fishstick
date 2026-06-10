import { describe, it, expect } from 'vitest'
import { authErrorResponse } from '@/lib/utils/api-error'
import { AuthError } from '@/lib/utils/auth'
import { rateLimitHeaders } from '@/lib/utils/rate-limit'

describe('authErrorResponse', () => {
  it('builds a JSON response from statusCode and message', async () => {
    const res = authErrorResponse(new AuthError('Authentication required', 401))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Authentication required')
  })

  it('includes headers attached to the error', async () => {
    const res = authErrorResponse(
      new AuthError('Too many requests', 429, {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0',
        'Retry-After': '30',
      })
    )

    expect(res.status).toBe(429)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('omits rate-limit headers when the error has none', () => {
    const res = authErrorResponse(new AuthError('Admin access required', 403))

    expect(res.status).toBe(403)
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
    expect(res.headers.get('Retry-After')).toBeNull()
  })
})

describe('rateLimitHeaders', () => {
  it('formats limit, remaining, reset and Retry-After', () => {
    const reset = Date.now() + 45_000
    const headers = rateLimitHeaders({ limit: 60, remaining: 0, reset })

    expect(headers['X-RateLimit-Limit']).toBe('60')
    expect(headers['X-RateLimit-Remaining']).toBe('0')
    expect(headers['X-RateLimit-Reset']).toBe(reset.toString())
    const retryAfter = Number(headers['Retry-After'])
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(45)
  })

  it('clamps Retry-After to zero for past reset timestamps', () => {
    const headers = rateLimitHeaders({ limit: 60, remaining: 0, reset: Date.now() - 1000 })
    expect(headers['Retry-After']).toBe('0')
  })
})
