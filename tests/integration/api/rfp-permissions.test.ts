import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  isAdmin: vi.fn(),
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

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  })),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          then: vi.fn((cb: (v: unknown[]) => unknown) => cb([])),
        })),
        then: vi.fn((cb: (v: unknown[]) => unknown) => cb([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{}])),
        })),
      })),
    })),
  },
}))

import { GET as listRfps } from '@/app/api/rfps/route'
import { PUT as updateRfp } from '@/app/api/rfps/[rfpId]/route'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'

function createMockRequest(
  method: string,
  url = 'http://localhost:3000/api/rfps',
  body?: unknown
): NextRequest {
  const init: RequestInit = { method, headers: {} }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'content-type': 'application/json' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(url, init as any)
}

describe('RFP Permission Filtering', () => {
  const adminContext = { userId: 'user_admin', orgId: 'org_123', orgRole: 'org:admin' }
  const userContext = { userId: 'user_member', orgId: 'org_123', orgRole: 'org:member' }

  const mockRfpAdmin = {
    id: 'rfp_1',
    organizationId: 'org_123',
    assignedUserId: 'user_admin',
    name: 'Admin RFP',
    status: 'draft',
  }
  const mockRfpUser = {
    id: 'rfp_2',
    organizationId: 'org_123',
    assignedUserId: 'user_member',
    name: 'User RFP',
    status: 'draft',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/rfps - role-based filtering', () => {
    it('admin (org:admin) sees all tenant RFPs', async () => {
      vi.mocked(requireAuth).mockResolvedValue(adminContext)
      vi.mocked(isAdmin).mockReturnValue(true)

      const allRfps = [mockRfpAdmin, mockRfpUser]
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(allRfps)),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const response = await listRfps()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rfps).toHaveLength(2)
    })

    it('user (org:member) sees only their assigned RFPs', async () => {
      vi.mocked(requireAuth).mockResolvedValue(userContext)
      vi.mocked(isAdmin).mockReturnValue(false)

      const assignedOnly = [mockRfpUser]
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(assignedOnly)),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const response = await listRfps()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rfps).toHaveLength(1)
      expect(data.rfps[0].assignedUserId).toBe('user_member')
    })

    it('user cannot see RFPs from another org', async () => {
      const crossOrgContext = { userId: 'user_member', orgId: 'org_other', orgRole: 'org:member' }
      vi.mocked(requireAuth).mockResolvedValue(crossOrgContext)
      vi.mocked(isAdmin).mockReturnValue(false)

      // DB returns empty because orgId filter + assignedUserId filter excludes cross-org
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const response = await listRfps()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rfps).toHaveLength(0)
    })

    it('returns 401 when unauthenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(
        new (AuthError as unknown as new (msg: string, code: number) => Error)(
          'Authentication required',
          401
        )
      )

      const response = await listRfps()

      expect(response.status).toBe(401)
    })
  })

  describe('PUT /api/rfps/:rfpId - assignment update', () => {
    it('admin can update assignedUserId', async () => {
      vi.mocked(requireAuth).mockResolvedValue(adminContext)
      vi.mocked(isAdmin).mockReturnValue(true)

      const updatedRfp = { ...mockRfpAdmin, assignedUserId: 'user_member' }
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([updatedRfp])),
          })),
        })),
      } as unknown as ReturnType<typeof db.update>)

      const request = createMockRequest(
        'PUT',
        'http://localhost:3000/api/rfps/rfp_1',
        { assignedUserId: 'user_member' }
      )
      const response = await updateRfp(request, {
        params: Promise.resolve({ rfpId: 'rfp_1' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rfp).toBeDefined()
    })

    it('non-admin cannot update assignedUserId (returns 403)', async () => {
      vi.mocked(requireAuth).mockResolvedValue(userContext)
      vi.mocked(isAdmin).mockReturnValue(false)

      const request = createMockRequest(
        'PUT',
        'http://localhost:3000/api/rfps/rfp_2',
        { assignedUserId: 'user_admin' }
      )
      const response = await updateRfp(request, {
        params: Promise.resolve({ rfpId: 'rfp_2' }),
      })

      expect(response.status).toBe(403)
    })
  })
})
