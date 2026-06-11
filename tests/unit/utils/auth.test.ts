import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Clerk
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

// Mock only checkRateLimit; keep the real rateLimitHeaders
vi.mock('@/lib/utils/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/rate-limit')>()
  return { ...actual, checkRateLimit: vi.fn().mockResolvedValue(null) }
})

describe('Auth Utilities', () => {
  let mockAuth: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const { auth } = await import('@clerk/nextjs/server')
    mockAuth = auth as unknown as ReturnType<typeof vi.fn>
  })

  describe('getAuthContext', () => {
    it('returns userId, orgId, orgRole from Clerk auth', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:admin',
      })

      const { getAuthContext } = await import('@/lib/utils/auth')
      const result = await getAuthContext()

      expect(result).toEqual({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:admin',
      })
    })

    it('returns null when not authenticated', async () => {
      mockAuth.mockResolvedValue({
        userId: null,
        orgId: null,
        orgRole: null,
      })

      const { getAuthContext } = await import('@/lib/utils/auth')
      const result = await getAuthContext()

      expect(result).toBeNull()
    })

    it('returns null when userId is missing', async () => {
      mockAuth.mockResolvedValue({
        userId: null,
        orgId: 'org_456',
        orgRole: 'org:member',
      })

      const { getAuthContext } = await import('@/lib/utils/auth')
      const result = await getAuthContext()

      expect(result).toBeNull()
    })

    it('returns null when orgId is missing', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: null,
        orgRole: 'org:member',
      })

      const { getAuthContext } = await import('@/lib/utils/auth')
      const result = await getAuthContext()

      expect(result).toBeNull()
    })

    it('defaults to org:member when orgRole is not provided', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: null,
      })

      const { getAuthContext } = await import('@/lib/utils/auth')
      const result = await getAuthContext()

      expect(result).toEqual({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:member',
      })
    })
  })

  describe('requireAuth', () => {
    it('returns auth context when authenticated', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:member',
      })

      const { requireAuth } = await import('@/lib/utils/auth')
      const result = await requireAuth()

      expect(result).toEqual({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:member',
      })
    })

    it('throws AuthError with 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue({
        userId: null,
        orgId: null,
        orgRole: null,
      })

      const { requireAuth, AuthError } = await import('@/lib/utils/auth')

      await expect(requireAuth()).rejects.toThrow(AuthError)
      await expect(requireAuth()).rejects.toThrow('Authentication required')

      try {
        await requireAuth()
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError)
        expect((error as { statusCode: number }).statusCode).toBe(401)
      }
    })
  })

  describe('requireAdmin', () => {
    it('returns auth context when user has admin role', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:admin',
      })

      const { requireAdmin } = await import('@/lib/utils/auth')
      const result = await requireAdmin()

      expect(result).toEqual({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:admin',
      })
    })

    it('throws AuthError with 403 when user is not admin', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:member',
      })

      const { requireAdmin, AuthError } = await import('@/lib/utils/auth')

      await expect(requireAdmin()).rejects.toThrow(AuthError)
      await expect(requireAdmin()).rejects.toThrow('Admin access required')

      try {
        await requireAdmin()
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError)
        expect((error as { statusCode: number }).statusCode).toBe(403)
      }
    })

    it('throws AuthError with 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue({
        userId: null,
        orgId: null,
        orgRole: null,
      })

      const { requireAdmin, AuthError } = await import('@/lib/utils/auth')

      await expect(requireAdmin()).rejects.toThrow(AuthError)

      try {
        await requireAdmin()
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError)
        expect((error as { statusCode: number }).statusCode).toBe(401)
      }
    })
  })

  describe('requireAuthLimited', () => {
    it('returns auth context when not rate-limited', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:member',
      })
      const { checkRateLimit } = await import('@/lib/utils/rate-limit')
      vi.mocked(checkRateLimit).mockResolvedValue(null)

      const { requireAuthLimited } = await import('@/lib/utils/auth')
      const result = await requireAuthLimited('strict')

      expect(result.userId).toBe('user_123')
      expect(checkRateLimit).toHaveBeenCalledWith('user_123', 'strict')
    })

    it('throws AuthError 429 with rate-limit headers when limited', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:member',
      })
      const reset = Date.now() + 30_000
      const { checkRateLimit } = await import('@/lib/utils/rate-limit')
      vi.mocked(checkRateLimit).mockResolvedValue({ limit: 60, remaining: 0, reset })

      const { requireAuthLimited, AuthError } = await import('@/lib/utils/auth')

      try {
        await requireAuthLimited()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError)
        const authError = error as InstanceType<typeof AuthError>
        expect(authError.statusCode).toBe(429)
        expect(authError.headers).toMatchObject({
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': reset.toString(),
        })
        expect(Number(authError.headers!['Retry-After'])).toBeGreaterThan(0)
      }
    })
  })

  describe('requireAdminLimited', () => {
    it('throws AuthError 429 with headers for rate-limited admin', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:admin',
      })
      const { checkRateLimit } = await import('@/lib/utils/rate-limit')
      vi.mocked(checkRateLimit).mockResolvedValue({ limit: 10, remaining: 0, reset: Date.now() + 1000 })

      const { requireAdminLimited, AuthError } = await import('@/lib/utils/auth')

      try {
        await requireAdminLimited('strict')
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError)
        const authError = error as InstanceType<typeof AuthError>
        expect(authError.statusCode).toBe(429)
        expect(authError.headers!['X-RateLimit-Limit']).toBe('10')
      }
    })

    it('throws 403 before consuming rate limit for non-admin', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        orgId: 'org_456',
        orgRole: 'org:member',
      })
      const { checkRateLimit } = await import('@/lib/utils/rate-limit')
      vi.mocked(checkRateLimit).mockResolvedValue(null)

      const { requireAdminLimited } = await import('@/lib/utils/auth')

      await expect(requireAdminLimited()).rejects.toThrow('Admin access required')
      expect(checkRateLimit).not.toHaveBeenCalled()
    })
  })

  describe('isAdmin', () => {
    it('returns true for org:admin role', async () => {
      const { isAdmin } = await import('@/lib/utils/auth')
      expect(isAdmin('org:admin')).toBe(true)
    })

    it('returns false for org:member role', async () => {
      const { isAdmin } = await import('@/lib/utils/auth')
      expect(isAdmin('org:member')).toBe(false)
    })

    it('returns false for empty string', async () => {
      const { isAdmin } = await import('@/lib/utils/auth')
      expect(isAdmin('')).toBe(false)
    })

    it('returns false for other roles', async () => {
      const { isAdmin } = await import('@/lib/utils/auth')
      expect(isAdmin('org:viewer')).toBe(false)
      expect(isAdmin('custom:role')).toBe(false)
    })
  })
})
