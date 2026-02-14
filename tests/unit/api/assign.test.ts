import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReturning = vi.fn()
const mockWhere = vi.fn()
const mockSet = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    update: () => ({ set: mockSet }),
  },
}))

vi.mock('@/lib/db/schema/rfps', () => ({
  rfps: { id: 'id', organizationId: 'organizationId', assignedUserId: 'assignedUserId' },
}))

vi.mock('@/lib/utils/auth', () => ({
  requireAdmin: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(true),
  AuthError: class AuthError extends Error {
    statusCode: number
    constructor(msg: string, code: number) {
      super(msg)
      this.statusCode = code
    }
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ col: _col, val })),
  and: vi.fn((...args) => args),
}))

import { POST } from '@/app/api/rfps/[rfpId]/assign/route'
import { requireAdmin, AuthError } from '@/lib/utils/auth'

const mockRequireAdmin = vi.mocked(requireAdmin)

describe('POST /api/rfps/[rfpId]/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({
      userId: 'admin-1',
      orgId: 'org-1',
      orgRole: 'org:admin',
    })
    mockSet.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ returning: mockReturning })
  })

  it('assigns user successfully', async () => {
    mockReturning.mockResolvedValueOnce([{ id: 'rfp-1', assignedUserId: 'user-2' }])

    const req = new Request('http://localhost/api/rfps/rfp-1/assign', {
      method: 'POST',
      body: JSON.stringify({ assignedUserId: 'user-2' }),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp-1' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.rfp.assignedUserId).toBe('user-2')
  })

  it('returns 400 if assignedUserId missing', async () => {
    const req = new Request('http://localhost/api/rfps/rfp-1/assign', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 if rfp not found', async () => {
    mockReturning.mockResolvedValueOnce([])

    const req = new Request('http://localhost/api/rfps/rfp-1/assign', {
      method: 'POST',
      body: JSON.stringify({ assignedUserId: 'user-2' }),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new AuthError('Forbidden', 403))

    const req = new Request('http://localhost/api/rfps/rfp-1/assign', {
      method: 'POST',
      body: JSON.stringify({ assignedUserId: 'user-2' }),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp-1' }) })
    expect(res.status).toBe(403)
  })
})
