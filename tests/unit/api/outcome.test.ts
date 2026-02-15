import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockReturning, mockUpdateWhere, mockSet, mockUpdate,
  mockSelectLimit, mockSelectWhere, mockFrom,
  mockInngestSend, mockGetIntegrationConfig,
} = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockUpdateWhere = vi.fn()
  const mockSet = vi.fn()
  const mockUpdate = vi.fn()
  const mockSelectLimit = vi.fn()
  const mockSelectWhere = vi.fn()
  const mockFrom = vi.fn()
  const mockInngestSend = vi.fn()
  const mockGetIntegrationConfig = vi.fn()
  return {
    mockReturning, mockUpdateWhere, mockSet, mockUpdate,
    mockSelectLimit, mockSelectWhere, mockFrom,
    mockInngestSend, mockGetIntegrationConfig,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: mockFrom }),
    update: mockUpdate,
  },
}))

vi.mock('@/lib/db/schema/rfps', () => ({
  rfps: { id: 'id', organizationId: 'organizationId', status: 'status', outcome: 'outcome', crmDealId: 'crmDealId', outcomeSetAt: 'outcomeSetAt', updatedAt: 'updatedAt' },
}))

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
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
  eq: vi.fn((_col: unknown, val: unknown) => ({ col: _col, val })),
  and: vi.fn((...args: unknown[]) => args),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}))

vi.mock('@/lib/services/integration-config', () => ({
  getIntegrationConfig: mockGetIntegrationConfig,
}))

import { PATCH } from '@/app/api/rfps/[rfpId]/outcome/route'
import { requireAuth, AuthError } from '@/lib/utils/auth'

const mockRequireAuth = vi.mocked(requireAuth)

const mockRfp = {
  id: 'rfp-1',
  name: 'Test RFP',
  organizationId: 'org-1',
  status: 'finalized',
  outcome: null,
  crmDealId: null,
}

describe('PATCH /api/rfps/[rfpId]/outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' })
    mockFrom.mockReturnValue({ where: mockSelectWhere })
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValue([mockRfp])
    mockUpdate.mockReturnValue({ set: mockSet })
    mockSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdateWhere.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([{ ...mockRfp, outcome: 'won', outcomeSetAt: new Date() }])
    mockGetIntegrationConfig.mockResolvedValue(null)
    mockInngestSend.mockResolvedValue(undefined)
  })

  it('returns 400 for invalid outcome value', async () => {
    const req = new Request('http://localhost/api/rfps/rfp-1/outcome', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'maybe' }),
    })

    const res = await PATCH(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('won')
  })

  it('returns 400 when RFP status is not finalized', async () => {
    mockSelectLimit.mockResolvedValue([{ ...mockRfp, status: 'approved' }])

    const req = new Request('http://localhost/api/rfps/rfp-1/outcome', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'won' }),
    })

    const res = await PATCH(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('finalized')
  })

  it('returns 404 when RFP not found', async () => {
    mockSelectLimit.mockResolvedValue([])

    const req = new Request('http://localhost/api/rfps/rfp-1/outcome', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'lost' }),
    })

    const res = await PATCH(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(404)
  })

  it('saves outcome and returns updated RFP', async () => {
    const req = new Request('http://localhost/api/rfps/rfp-1/outcome', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'won', crmDealId: 'deal-123' }),
    })

    const res = await PATCH(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { rfp: { outcome: string } }
    expect(body.rfp.outcome).toBe('won')
  })

  it('sends CRM sync event when CRM integration is configured', async () => {
    mockGetIntegrationConfig.mockImplementation((_orgId: string, type: string) => {
      if (type === 'hubspot') return Promise.resolve({ isEnabled: true })
      return Promise.resolve(null)
    })

    const req = new Request('http://localhost/api/rfps/rfp-1/outcome', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'won' }),
    })

    await PATCH(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'integration/crm-sync-rfp' })
    )
  })

  it('does not send CRM event when no CRM integration configured', async () => {
    mockGetIntegrationConfig.mockResolvedValue(null)

    const req = new Request('http://localhost/api/rfps/rfp-1/outcome', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'lost' }),
    })

    await PATCH(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    const crmCalls = mockInngestSend.mock.calls.filter(
      ([event]) => (event as { name: string }).name === 'integration/crm-sync-rfp'
    )
    expect(crmCalls).toHaveLength(0)
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401))

    const req = new Request('http://localhost/api/rfps/rfp-1/outcome', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'won' }),
    })

    const res = await PATCH(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(401)
  })
})
