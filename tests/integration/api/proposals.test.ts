import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(false),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/services/proposal-draft', () => ({
  createDraft: vi.fn(),
  submitAnswers: vi.fn(),
  getDraft: vi.fn(),
  listDrafts: vi.fn(),
  updateDraftContent: vi.fn(),
  cancelDraft: vi.fn(),
}))

import { requireAuth, AuthError } from '@/lib/utils/auth'
import {
  createDraft,
  submitAnswers,
  getDraft,
  listDrafts,
  cancelDraft,
} from '@/lib/services/proposal-draft'
import { GET as listProposals, POST as createProposal } from '@/app/api/rfps/[rfpId]/proposals/route'
import { GET as getProposal, PATCH as patchProposal, DELETE as deleteProposal } from '@/app/api/rfps/[rfpId]/proposals/[draftId]/route'
import { POST as submitAnswersRoute } from '@/app/api/rfps/[rfpId]/proposals/[draftId]/answers/route'

const mockUser = { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' }

const mockQuestions = [
  { id: 'q1', question: 'What pricing model?', rfpSection: 'Pricing', answer: null },
  { id: 'q2', question: 'Any certifications?', rfpSection: 'Standards', answer: null },
  { id: 'q3', question: 'Preferred timeline?', rfpSection: 'Schedule', answer: null },
]

const mockDraft = {
  id: 'draft-1',
  rfpId: 'rfp-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  status: 'awaiting_answers',
  clarifyingQuestions: mockQuestions,
  markdownContent: null,
  generationError: null,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'content-type': 'application/json' }
  }
  return new NextRequest(url, init as any)
}

function routeParams(rfpId: string, draftId?: string) {
  return draftId
    ? { params: Promise.resolve({ rfpId, draftId }) } as any
    : { params: Promise.resolve({ rfpId }) } as any
}

describe('proposals API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(mockUser)
  })

  describe('POST /api/rfps/[rfpId]/proposals', () => {
    it('should return 201 with draft and clarifying questions', async () => {
      vi.mocked(createDraft).mockResolvedValue(mockDraft as any)

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp-1/proposals')
      const res = await createProposal(req, routeParams('rfp-1'))

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.draft).toBeDefined()
      expect(body.draft.clarifyingQuestions).toHaveLength(3)
    })

    it('should return 422 when RFP has no parsedStructure', async () => {
      vi.mocked(createDraft).mockRejectedValue(
        Object.assign(new Error('RFP must be processed before generating a proposal'), { statusCode: 422 })
      )

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp-1/proposals')
      const res = await createProposal(req, routeParams('rfp-1'))

      expect(res.status).toBe(422)
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(
        new (AuthError as any)('Unauthorized', 401)
      )

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp-1/proposals')
      const res = await createProposal(req, routeParams('rfp-1'))

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/rfps/[rfpId]/proposals', () => {
    it('should return 200 with list of drafts', async () => {
      vi.mocked(listDrafts).mockResolvedValue([mockDraft] as any)

      const req = createRequest('GET', 'http://localhost/api/rfps/rfp-1/proposals')
      const res = await listProposals(req, routeParams('rfp-1'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.drafts).toHaveLength(1)
    })
  })

  describe('GET /api/rfps/[rfpId]/proposals/[draftId]', () => {
    it('should return 200 with full draft details', async () => {
      vi.mocked(getDraft).mockResolvedValue(mockDraft as any)

      const req = createRequest('GET', 'http://localhost/api/rfps/rfp-1/proposals/draft-1')
      const res = await getProposal(req, routeParams('rfp-1', 'draft-1'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('draft-1')
      expect(body.clarifyingQuestions).toBeDefined()
    })

    it('should return 404 when draft not found or belongs to different org', async () => {
      vi.mocked(getDraft).mockResolvedValue(null)

      const req = createRequest('GET', 'http://localhost/api/rfps/rfp-1/proposals/draft-1')
      const res = await getProposal(req, routeParams('rfp-1', 'draft-1'))

      expect(res.status).toBe(404)
    })

    it('should enforce tenant isolation — 404 when rfpId belongs to different org', async () => {
      vi.mocked(getDraft).mockResolvedValue(null)

      const req = createRequest('GET', 'http://localhost/api/rfps/other-org-rfp/proposals/draft-1')
      const res = await getProposal(req, routeParams('other-org-rfp', 'draft-1'))

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/rfps/[rfpId]/proposals/[draftId]/answers', () => {
    it('should return 202 with full draft object', async () => {
      vi.mocked(submitAnswers).mockResolvedValue({ ...mockDraft, status: 'generating' } as any)

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp-1/proposals/draft-1/answers', {
        answers: [
          { id: 'q1', answer: 'Fixed price' },
          { id: 'q2', answer: 'ISO 27001' },
          { id: 'q3', answer: '6 months' },
        ],
      })
      const res = await submitAnswersRoute(req, routeParams('rfp-1', 'draft-1'))

      expect(res.status).toBe(202)
      const body = await res.json()
      expect(body.draft.id).toBe('draft-1')
      expect(body.draft.status).toBe('generating')
    })

    it('should return 400 when answers array is missing', async () => {
      const req = createRequest('POST', 'http://localhost/api/rfps/rfp-1/proposals/draft-1/answers', {})
      const res = await submitAnswersRoute(req, routeParams('rfp-1', 'draft-1'))

      expect(res.status).toBe(400)
    })

    it('should return 409 when draft is not in awaiting_answers state', async () => {
      vi.mocked(submitAnswers).mockRejectedValue(
        Object.assign(new Error('Draft is not awaiting answers'), { statusCode: 409 })
      )

      const req = createRequest('POST', 'http://localhost/api/rfps/rfp-1/proposals/draft-1/answers', {
        answers: [],
      })
      const res = await submitAnswersRoute(req, routeParams('rfp-1', 'draft-1'))

      expect(res.status).toBe(409)
    })
  })

  describe('DELETE /api/rfps/[rfpId]/proposals/[draftId]', () => {
    it('should return 200 when cancelling a generating draft', async () => {
      vi.mocked(cancelDraft).mockResolvedValue({
        ...mockDraft,
        status: 'error',
        generationError: 'Cancelled by user',
      } as any)

      const req = createRequest('DELETE', 'http://localhost/api/rfps/rfp-1/proposals/draft-1')
      const res = await deleteProposal(req, routeParams('rfp-1', 'draft-1'))

      expect(res.status).toBe(200)
    })

    it('should return 409 when draft is not in generating state', async () => {
      vi.mocked(cancelDraft).mockRejectedValue(
        Object.assign(new Error('Draft is not generating'), { statusCode: 409 })
      )

      const req = createRequest('DELETE', 'http://localhost/api/rfps/rfp-1/proposals/draft-1')
      const res = await deleteProposal(req, routeParams('rfp-1', 'draft-1'))

      expect(res.status).toBe(409)
    })
  })
})
