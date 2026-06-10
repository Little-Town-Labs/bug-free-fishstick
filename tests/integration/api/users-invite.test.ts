import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuthLimited: vi.fn(),
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
      createOrganizationInvitation: vi.fn().mockResolvedValue({
        id: 'inv-1',
        emailAddress: 'invited@example.com',
        role: 'org:member',
      }),
    },
  }),
}))

import { POST } from '@/app/api/users/invite/route'
import { requireAuthLimited, isAdmin } from '@/lib/utils/auth'

describe('POST /api/users/invite', () => {
  const auth = requireAuthLimited as ReturnType<typeof vi.fn>
  const adminCheck = isAdmin as ReturnType<typeof vi.fn>

  const mockAuth = {
    userId: 'user-1',
    orgId: 'org-1',
    orgRole: 'org:admin',
  }

  const makeRequest = (body: object) =>
    new NextRequest('http://localhost/api/users/invite', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue(mockAuth)
    adminCheck.mockReturnValue(true)
  })

  it('returns 201 with invitation on success', async () => {
    const res = await POST(makeRequest({ email: 'invited@example.com', role: 'org:member' }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.invitation).toBeDefined()
  })

  it('returns 403 when not admin', async () => {
    adminCheck.mockReturnValue(false)
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when email missing', async () => {
    const res = await POST(makeRequest({ role: 'org:member' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is not a string', async () => {
    const res = await POST(makeRequest({ email: 42 }))
    expect(res.status).toBe(400)
  })

  it('defaults to org:member for unknown role', async () => {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await (clerkClient as ReturnType<typeof vi.fn>)()

    await POST(makeRequest({ email: 'test@example.com', role: 'unknown' }))

    expect(client.organizations.createOrganizationInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'org:member' })
    )
  })

  it('uses org:admin role when specified', async () => {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await (clerkClient as ReturnType<typeof vi.fn>)()

    await POST(makeRequest({ email: 'admin@example.com', role: 'org:admin' }))

    expect(client.organizations.createOrganizationInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'org:admin' })
    )
  })

  it('returns 401 when unauthenticated', async () => {
    const { AuthError: AE } = await import('@/lib/utils/auth')
    auth.mockRejectedValue(new AE('Unauthorized', 401))

    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(401)
  })
})
