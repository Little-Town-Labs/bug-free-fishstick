import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
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
    update: vi.fn(),
  },
}))

vi.mock('@/lib/ai/agents/proposal-coverage-checker', () => ({
  checkCoverage: vi.fn(),
}))

import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { checkCoverage } from '@/lib/ai/agents/proposal-coverage-checker'
import { POST } from '@/app/api/rfps/[rfpId]/proposals/[draftId]/coverage/route'

const mockUser = { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' }

const mockCoverageReport = {
  coverageScore: 75,
  evaluatedAt: '2026-02-26T12:00:00.000Z',
  requirements: [
    { requirementId: 'f1', question: 'Background?', addressed: true, evidence: 'Acme Corp...', gap: null },
    { requirementId: 'f2', question: 'Security?', addressed: true, evidence: 'ISO 27001', gap: null },
    { requirementId: 'f3', question: 'Timeline?', addressed: true, evidence: '6 months', gap: null },
    { requirementId: 'f4', question: 'Budget?', addressed: false, evidence: null, gap: 'Not addressed' },
  ],
}

function createRequest(): NextRequest {
  return new NextRequest('http://localhost/api/rfps/rfp-1/proposals/draft-1/coverage', { method: 'POST' })
}

function routeParams() {
  return { params: Promise.resolve({ rfpId: 'rfp-1', draftId: 'draft-1' }) } as any
}

let selectCallCount: number

function setupDbMocks(opts: { draftExists?: boolean; rfpExists?: boolean } = {}) {
  const { draftExists = true, rfpExists = true } = opts
  selectCallCount = 0

  const mockDraft = draftExists ? {
    id: 'draft-1',
    organizationId: 'org-1',
    markdownContent: '# Proposal\n\nContent here.',
    status: 'draft',
  } : undefined

  const mockRfp = rfpExists ? {
    id: 'rfp-1',
    organizationId: 'org-1',
    parsedStructure: {
      pages: 1,
      fields: [
        { id: 'f1', type: 'text', question: 'Background?' },
        { id: 'f2', type: 'text', question: 'Security?' },
      ],
    },
  } : undefined

  vi.mocked(db.select).mockImplementation(() => {
    const call = selectCallCount++
    if (call === 0) {
      // Draft query
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockDraft ? [mockDraft] : []),
          }),
        }),
      } as any
    }
    if (call === 1) {
      // RFP query
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockRfp ? [mockRfp] : []),
          }),
        }),
      } as any
    }
    // Templates query (no limit)
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any
  })

  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as any)
}

describe('POST /api/rfps/[rfpId]/proposals/[draftId]/coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(mockUser)
    vi.mocked(checkCoverage).mockResolvedValue(mockCoverageReport)
  })

  it('returns coverage report on success', async () => {
    setupDbMocks()
    const res = await POST(createRequest(), routeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.coverageScore).toBe(75)
    expect(body.requirements).toHaveLength(4)
  })

  it('saves coverage report to database', async () => {
    setupDbMocks()
    await POST(createRequest(), routeParams())

    expect(db.update).toHaveBeenCalled()
  })

  it('calls checkCoverage with correct args', async () => {
    setupDbMocks()
    await POST(createRequest(), routeParams())

    expect(checkCoverage).toHaveBeenCalledWith(
      expect.objectContaining({
        requirements: [
          { id: 'f1', question: 'Background?' },
          { id: 'f2', question: 'Security?' },
        ],
        proposalMarkdown: '# Proposal\n\nContent here.',
        evaluateCoverageTemplates: [],
        organizationId: 'org-1',
      }),
    )
  })

  it('returns 404 when draft not found', async () => {
    setupDbMocks({ draftExists: false })
    const res = await POST(createRequest(), routeParams())

    expect(res.status).toBe(404)
  })

  it('returns 404 when RFP not found', async () => {
    setupDbMocks({ rfpExists: false })
    const res = await POST(createRequest(), routeParams())

    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('Unauthorized', 401))
    setupDbMocks()
    const res = await POST(createRequest(), routeParams())

    expect(res.status).toBe(401)
  })

  it('returns 500 when checkCoverage fails', async () => {
    setupDbMocks()
    vi.mocked(checkCoverage).mockRejectedValue(new Error('LLM timeout'))
    const res = await POST(createRequest(), routeParams())

    expect(res.status).toBe(500)
  })
})
