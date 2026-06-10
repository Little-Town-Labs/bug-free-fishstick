import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuthLimited: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(false),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/services/proposal-draft', () => ({
  getDraft: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  const limit = vi.fn()
  const chain = { select: vi.fn(), from: vi.fn(), where: vi.fn(), limit }
  chain.select.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  return { db: chain }
})

import { requireAuthLimited } from '@/lib/utils/auth'
import { getDraft } from '@/lib/services/proposal-draft'
import { db } from '@/lib/db'
import { GET as exportHandler } from '@/app/api/rfps/[rfpId]/proposals/[draftId]/export/route'

const mockUser = { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' }

const now = new Date()
const mockDraftWithContent = {
  id: 'draft-1',
  rfpId: 'rfp-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  status: 'draft' as const,
  clarifyingQuestions: null,
  markdownContent: '# My Proposal\n\nThis is the proposal content.',
  generationError: null,
  version: 1,
  coverageReport: null,
  createdAt: now,
  updatedAt: now,
}

const mockRfp = { name: 'Q3 Cloud Services RFP' }

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`)
}

function rfpDraftParams(rfpId: string, draftId: string) {
  return { params: Promise.resolve({ rfpId, draftId }) } as Parameters<typeof exportHandler>[1]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthLimited).mockResolvedValue(mockUser)
  // Re-wire chain after clearAllMocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain = db as any
  chain.select.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue([mockRfp])
})

describe('GET /api/rfps/[rfpId]/proposals/[draftId]/export', () => {
  describe('success', () => {
    it('returns text/markdown content type', async () => {
      vi.mocked(getDraft).mockResolvedValue(mockDraftWithContent)

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/markdown')
    })

    it('returns Content-Disposition attachment header', async () => {
      vi.mocked(getDraft).mockResolvedValue(mockDraftWithContent)

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      expect(res.headers.get('Content-Disposition')).toContain('attachment')
    })

    it('includes RFP name in filename', async () => {
      vi.mocked(getDraft).mockResolvedValue(mockDraftWithContent)

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      const disposition = res.headers.get('Content-Disposition')!
      expect(disposition).toContain('q3-cloud-services-rfp')
      expect(disposition).toContain('.md')
    })

    it('returns markdownContent as the response body', async () => {
      vi.mocked(getDraft).mockResolvedValue(mockDraftWithContent)

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      const body = await res.text()
      expect(body).toBe(mockDraftWithContent.markdownContent)
    })

    it('falls back gracefully when RFP lookup fails', async () => {
      vi.mocked(getDraft).mockResolvedValue(mockDraftWithContent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain = db as any
      chain.limit.mockResolvedValue([])

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      expect(res.status).toBe(200)
      const disposition = res.headers.get('Content-Disposition')!
      expect(disposition).toContain('attachment')
      expect(disposition).toContain('.md')
    })
  })

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
      vi.mocked(requireAuthLimited).mockRejectedValue(new AuthErrorClass('Unauthorized', 401))

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      expect(res.status).toBe(401)
    })

    it('returns 404 when draft not found', async () => {
      vi.mocked(getDraft).mockResolvedValue(null)

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      expect(res.status).toBe(404)
    })

    it('returns 422 when draft has no markdownContent', async () => {
      vi.mocked(getDraft).mockResolvedValue({ ...mockDraftWithContent, markdownContent: null as string | null })

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      expect(res.status).toBe(422)
    })

    it('validates org scope — only returns draft for the authenticated org', async () => {
      // getDraft already enforces org scope in the service layer
      vi.mocked(getDraft).mockResolvedValue(null)

      const res = await exportHandler(
        createRequest('/api/rfps/rfp-1/proposals/draft-1/export'),
        rfpDraftParams('rfp-1', 'draft-1')
      )

      expect(res.status).toBe(404)
      expect(vi.mocked(getDraft)).toHaveBeenCalledWith('draft-1', mockUser.orgId)
    })
  })
})
