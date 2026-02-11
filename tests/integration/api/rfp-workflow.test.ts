import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/services/rfp-workflow', () => ({
  validateTransition: vi.fn(),
  getAvailableTransitions: vi.fn(),
  WorkflowError: class WorkflowError extends Error {
    constructor(message: string, public statusCode = 409) {
      super(message)
      this.name = 'WorkflowError'
    }
  },
}))

vi.mock('@/lib/services/rfp-versions', () => ({
  createVersionSnapshot: vi.fn(),
}))

import { POST as submitRfp } from '@/app/api/rfps/[rfpId]/submit/route'
import { POST as approveRfp } from '@/app/api/rfps/[rfpId]/approve/route'
import { POST as returnRfp } from '@/app/api/rfps/[rfpId]/return/route'
import { POST as finalizeRfp } from '@/app/api/rfps/[rfpId]/finalize/route'
import { GET as getVersions } from '@/app/api/rfps/[rfpId]/versions/route'

import { requireAuth, requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { validateTransition, WorkflowError } from '@/lib/services/rfp-workflow'
import { createVersionSnapshot } from '@/lib/services/rfp-versions'

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'content-type': 'application/json' }
  }
  return new NextRequest(url, init as any)
}

const mockUser = { userId: 'user_1', orgId: 'org_1', orgRole: 'org:member' }
const mockAdmin = { userId: 'admin_1', orgId: 'org_1', orgRole: 'org:admin' }

const mockDraftRfp = { id: 'rfp_1', organizationId: 'org_1', status: 'draft', version: 1, automationPercentage: 0.8 }
const mockSubmittedRfp = { id: 'rfp_1', organizationId: 'org_1', status: 'submitted', version: 1, automationPercentage: 0.8 }
const mockApprovedRfp = { id: 'rfp_1', organizationId: 'org_1', status: 'approved', version: 1, automationPercentage: 0.8 }

function mockSelectRfp(rfp: object | null) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue(Promise.resolve(rfp ? [rfp] : [])),
      }),
    }),
  } as any)
}

function mockUpdateRfp(rfp: object) {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue(Promise.resolve([rfp])),
      }),
    }),
  } as any)
}

describe('RFP Workflow API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(validateTransition).mockImplementation(() => {
      // Default: does not throw (valid transition)
    })
  })

  // ─── POST /submit ────────────────────────────────────────────────────────────
  describe('POST /api/rfps/[rfpId]/submit', () => {
    it('returns 200 when draft RFP is submitted successfully', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockUser)
      mockSelectRfp(mockDraftRfp)
      mockUpdateRfp({ ...mockDraftRfp, status: 'submitted' })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/submit')
      const res = await submitRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.rfp).toBeDefined()
    })

    it('returns 404 when RFP not found', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockUser)
      mockSelectRfp(null)

      const req = createRequest('POST', 'http://localhost/api/rfps/nonexistent/submit')
      const res = await submitRfp(req, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(res.status).toBe(404)
    })

    it('returns 409 when transition is invalid', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockUser)
      mockSelectRfp(mockSubmittedRfp)
      vi.mocked(validateTransition).mockImplementation(() => {
        throw new WorkflowError('Invalid transition: submitted → submitted', 409)
      })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/submit')
      const res = await submitRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(409)
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('Unauthorized', 401))

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/submit')
      const res = await submitRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(401)
    })
  })

  // ─── POST /approve ────────────────────────────────────────────────────────────
  describe('POST /api/rfps/[rfpId]/approve', () => {
    it('returns 200 when admin approves submitted RFP', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(mockSubmittedRfp)
      mockUpdateRfp({ ...mockSubmittedRfp, status: 'approved' })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/approve')
      const res = await approveRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.rfp).toBeDefined()
    })

    it('returns 403 when non-admin calls approve', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new AuthError('Admin access required', 403))

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/approve')
      const res = await approveRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(403)
    })

    it('returns 404 when RFP not found', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(null)

      const req = createRequest('POST', 'http://localhost/api/rfps/nonexistent/approve')
      const res = await approveRfp(req, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(res.status).toBe(404)
    })

    it('returns 409 when RFP is not in submitted status', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(mockDraftRfp)
      vi.mocked(validateTransition).mockImplementation(() => {
        throw new WorkflowError('Invalid transition: draft → approved', 409)
      })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/approve')
      const res = await approveRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(409)
    })
  })

  // ─── POST /return ─────────────────────────────────────────────────────────────
  describe('POST /api/rfps/[rfpId]/return', () => {
    it('returns 200 when admin returns RFP with comments', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(mockSubmittedRfp)
      mockUpdateRfp({ ...mockSubmittedRfp, status: 'draft', returnComments: 'Needs more detail' })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/return', {
        comments: 'Needs more detail',
      })
      const res = await returnRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.rfp).toBeDefined()
    })

    it('returns 400 when comments are missing', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/return', {})
      const res = await returnRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(400)
    })

    it('returns 403 when non-admin calls return', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new AuthError('Admin access required', 403))

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/return', {
        comments: 'Needs work',
      })
      const res = await returnRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(403)
    })

    it('returns 404 when RFP not found', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(null)

      const req = createRequest('POST', 'http://localhost/api/rfps/nonexistent/return', {
        comments: 'Some comments',
      })
      const res = await returnRfp(req, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(res.status).toBe(404)
    })

    it('returns 409 when transition is invalid', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(mockDraftRfp)
      vi.mocked(validateTransition).mockImplementation(() => {
        throw new WorkflowError('Invalid transition: draft → draft', 409)
      })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/return', {
        comments: 'Some comments',
      })
      const res = await returnRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(409)
    })
  })

  // ─── POST /finalize ───────────────────────────────────────────────────────────
  describe('POST /api/rfps/[rfpId]/finalize', () => {
    it('returns 200 and creates version snapshot when admin finalizes', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(mockApprovedRfp)
      mockUpdateRfp({ ...mockApprovedRfp, status: 'finalized' })
      vi.mocked(createVersionSnapshot).mockResolvedValue({
        id: 'ver_1',
        rfpId: 'rfp_1',
        versionNumber: 2,
        createdBy: 'admin_1',
        changeSummary: 'Finalized',
        snapshot: null,
        createdAt: new Date(),
      })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/finalize')
      const res = await finalizeRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(200)
      expect(createVersionSnapshot).toHaveBeenCalledWith(
        'rfp_1',
        'org_1',
        'admin_1',
        expect.any(String)
      )
    })

    it('returns 403 when non-admin calls finalize', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new AuthError('Admin access required', 403))

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/finalize')
      const res = await finalizeRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(403)
    })

    it('returns 404 when RFP not found', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(null)

      const req = createRequest('POST', 'http://localhost/api/rfps/nonexistent/finalize')
      const res = await finalizeRfp(req, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(res.status).toBe(404)
    })

    it('returns 409 when RFP is not in approved status', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
      mockSelectRfp(mockSubmittedRfp)
      vi.mocked(validateTransition).mockImplementation(() => {
        throw new WorkflowError('Invalid transition: submitted → finalized', 409)
      })

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp_1/finalize')
      const res = await finalizeRfp(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(409)
    })
  })

  // ─── GET /versions ────────────────────────────────────────────────────────────
  describe('GET /api/rfps/[rfpId]/versions', () => {
    it('returns 200 with list of versions', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockUser)
      // First select: verify RFP exists
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([mockDraftRfp])),
            }),
          }),
        } as any)
        // Second select: fetch versions
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([
                {
                  id: 'ver_1',
                  rfpId: 'rfp_1',
                  versionNumber: 1,
                  createdBy: 'admin_1',
                  changeSummary: 'Initial',
                  createdAt: new Date(),
                },
              ])
            ),
          }),
        } as any)

      const req = createRequest('GET', 'http://localhost/api/rfps/rfp_1/versions')
      const res = await getVersions(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.versions).toBeDefined()
      expect(Array.isArray(data.versions)).toBe(true)
    })

    it('returns 404 when RFP not found', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockUser)
      mockSelectRfp(null)

      const req = createRequest('GET', 'http://localhost/api/rfps/nonexistent/versions')
      const res = await getVersions(req, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('Unauthorized', 401))

      const req = createRequest('GET', 'http://localhost/api/rfps/rfp_1/versions')
      const res = await getVersions(req, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(res.status).toBe(401)
    })
  })
})
