import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Auth } from '@clerk/nextjs/server'

// Mock Clerk
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

describe('Auth Utilities', () => {
  let mockAuth: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const { auth } = await import('@clerk/nextjs/server')
    mockAuth = auth as ReturnType<typeof vi.fn>
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
        expect((error as any).statusCode).toBe(401)
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
        expect((error as any).statusCode).toBe(403)
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
        expect((error as any).statusCode).toBe(401)
      }
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
