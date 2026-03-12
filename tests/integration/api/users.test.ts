import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(true),
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public statusCode: number
    ) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn().mockResolvedValue({
    organizations: {
      getOrganizationMembershipList: vi.fn().mockResolvedValue({
        data: [
          {
            publicUserData: {
              userId: 'user-1',
              identifier: 'alice@example.com',
              firstName: 'Alice',
              lastName: 'Smith',
            },
            role: 'org:admin',
            createdAt: 1700000000000,
          },
          {
            publicUserData: {
              userId: 'user-2',
              identifier: 'bob@example.com',
              firstName: null,
              lastName: null,
            },
            role: 'org:member',
            createdAt: null,
          },
        ],
      }),
      createOrganizationInvitation: vi.fn().mockResolvedValue({
        id: 'inv-1',
        emailAddress: 'newuser@example.com',
        role: 'org:member',
      }),
    },
  }),
}))

import { GET, POST } from '@/app/api/users/route'
import { requireAuth, isAdmin } from '@/lib/utils/auth'
import { NextRequest } from 'next/server'

describe('Users API Routes', () => {
  const auth = requireAuth as ReturnType<typeof vi.fn>
  const adminCheck = isAdmin as ReturnType<typeof vi.fn>

  const mockAuth = {
    userId: 'user-1',
    orgId: 'org-1',
    orgRole: 'org:admin',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue(mockAuth)
    adminCheck.mockReturnValue(true)
  })

  describe('GET /api/users', () => {
    it('returns 200 with members list', async () => {
      const res = await GET()
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.members).toHaveLength(2)
      expect(data.isAdmin).toBe(true)
    })

    it('maps membership data correctly', async () => {
      const res = await GET()
      const data = await res.json()

      expect(data.members[0]).toMatchObject({
        userId: 'user-1',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        orgRole: 'org:admin',
      })
    })

    it('handles missing name fields', async () => {
      const res = await GET()
      const data = await res.json()

      expect(data.members[1]).toMatchObject({
        userId: 'user-2',
        email: 'bob@example.com',
      })
    })

    it('returns isAdmin: false for non-admin', async () => {
      adminCheck.mockReturnValue(false)
      const res = await GET()
      const data = await res.json()

      expect(data.isAdmin).toBe(false)
    })

    it('returns 401 when not authenticated', async () => {
      const { AuthError: AE } = await import('@/lib/utils/auth')
      auth.mockRejectedValue(new AE('Unauthorized', 401))

      const res = await GET()
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/users (invite)', () => {
    const makeRequest = (body: object) =>
      new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      })

    it('returns 403 when non-admin tries to invite', async () => {
      adminCheck.mockReturnValue(false)
      const res = await POST(makeRequest({ email: 'test@example.com' }))
      expect(res.status).toBe(403)
    })

    it('returns 400 when email is missing', async () => {
      const res = await POST(makeRequest({ role: 'org:member' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when email is not a string', async () => {
      const res = await POST(makeRequest({ email: 123 }))
      expect(res.status).toBe(400)
    })

    it('returns 201 with invitation on success', async () => {
      const res = await POST(makeRequest({ email: 'newuser@example.com', role: 'org:member' }))
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.invitation).toBeDefined()
    })

    it('defaults role to org:member when not org:admin', async () => {
      const { clerkClient } = await import('@clerk/nextjs/server')
      const client = await (clerkClient as ReturnType<typeof vi.fn>)()

      await POST(makeRequest({ email: 'test@example.com', role: 'invalid' }))

      expect(client.organizations.createOrganizationInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'org:member' })
      )
    })

    it('accepts org:admin role', async () => {
      const { clerkClient } = await import('@clerk/nextjs/server')
      const client = await (clerkClient as ReturnType<typeof vi.fn>)()

      await POST(makeRequest({ email: 'admin@example.com', role: 'org:admin' }))

      expect(client.organizations.createOrganizationInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'org:admin' })
      )
    })

    it('returns 401 when not authenticated', async () => {
      const { AuthError: AE } = await import('@/lib/utils/auth')
      auth.mockRejectedValue(new AE('Unauthorized', 401))

      const res = await POST(makeRequest({ email: 'test@example.com' }))
      expect(res.status).toBe(401)
    })
  })
})
