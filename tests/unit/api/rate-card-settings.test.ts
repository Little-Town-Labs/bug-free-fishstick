import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAdmin: vi.fn(),
  getAuthContext: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/services/rate-card', () => ({
  getRateCard: vi.fn(),
  upsertRateCard: vi.fn(),
}))

import { requireAdmin } from '@/lib/utils/auth'
import { getRateCard, upsertRateCard } from '@/lib/services/rate-card'
import { GET, PATCH } from '@/app/api/settings/rate-card/route'

const mockAdmin = { userId: 'user-1', orgId: 'org_test', orgRole: 'org:admin' }

const validRateCard = {
  mode: 'blended' as const,
  blendedRate: 150,
  blendedRateUnit: 'hour' as const,
  roles: [],
  defaultMarginPct: 0.2,
  currency: 'USD',
  discounts: [],
}

const validProposalDefaults = {
  pricingModel: 'time_and_materials' as const,
  paymentTermsDays: 30,
  warrantyPeriodDays: 90,
}

const validPatchBody = {
  rateCard: validRateCard,
  proposalDefaults: validProposalDefaults,
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings/rate-card', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
  vi.mocked(getRateCard).mockResolvedValue({ rateCard: null, proposalDefaults: null })
  vi.mocked(upsertRateCard).mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// GET /api/settings/rate-card
// ---------------------------------------------------------------------------

describe('GET /api/settings/rate-card', () => {
  it('returns 401 when unauthenticated', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Authentication required', 401))

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated user is not an admin', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 500 on unexpected server error', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('DB connection refused'))

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns { rateCard: null, proposalDefaults: null } when no config saved', async () => {
    vi.mocked(getRateCard).mockResolvedValue({ rateCard: null, proposalDefaults: null })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ rateCard: null, proposalDefaults: null })
  })

  it('returns populated rate card data when config exists', async () => {
    vi.mocked(getRateCard).mockResolvedValue({
      rateCard: validRateCard,
      proposalDefaults: validProposalDefaults,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rateCard).toEqual(validRateCard)
    expect(body.proposalDefaults).toEqual(validProposalDefaults)
  })

  it('calls getRateCard with orgId from session (tenant isolation)', async () => {
    await GET()
    expect(vi.mocked(getRateCard)).toHaveBeenCalledWith('org_test')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/settings/rate-card
// ---------------------------------------------------------------------------

describe('PATCH /api/settings/rate-card', () => {
  it('returns 401 when unauthenticated', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Authentication required', 401))

    const res = await PATCH(createPatchRequest(validPatchBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated user is not an admin', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await PATCH(createPatchRequest(validPatchBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for a non-JSON request body', async () => {
    const req = new NextRequest('http://localhost/api/settings/rate-card', {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON body')
  })

  it('returns 422 with details array when rateCard is missing from body', async () => {
    const res = await PATCH(createPatchRequest({ proposalDefaults: validProposalDefaults }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details).toBeDefined()
    expect(Array.isArray(body.details)).toBe(true)
    expect(body.details.length).toBeGreaterThan(0)
  })

  it('returns 422 for blended mode with null blendedRate', async () => {
    const res = await PATCH(createPatchRequest({
      rateCard: { ...validRateCard, blendedRate: null },
      proposalDefaults: validProposalDefaults,
    }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details.some((d: { field: string }) => d.field.includes('blendedRate'))).toBe(true)
  })

  it('returns 422 for blended mode with null blendedRateUnit', async () => {
    const res = await PATCH(createPatchRequest({
      rateCard: { ...validRateCard, blendedRateUnit: null },
      proposalDefaults: validProposalDefaults,
    }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details.some((d: { field: string }) => d.field.includes('blendedRateUnit'))).toBe(true)
  })

  it('returns 422 for by_role mode with empty roles array', async () => {
    const res = await PATCH(createPatchRequest({
      rateCard: {
        mode: 'by_role',
        blendedRate: null,
        blendedRateUnit: null,
        roles: [],
        defaultMarginPct: 0.2,
        currency: 'USD',
        discounts: [],
      },
      proposalDefaults: validProposalDefaults,
    }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details.some((d: { field: string }) => d.field.includes('roles'))).toBe(true)
  })

  it('returns 422 for percentage discount value > 1', async () => {
    const res = await PATCH(createPatchRequest({
      rateCard: {
        ...validRateCard,
        discounts: [{
          name: 'Bad discount',
          type: 'percentage',
          value: 1.5,
          appliesTo: 'total',
          customerIds: null,
        }],
      },
      proposalDefaults: validProposalDefaults,
    }))
    expect(res.status).toBe(422)
  })

  it('returns 422 for customerIds as empty array', async () => {
    const res = await PATCH(createPatchRequest({
      rateCard: {
        ...validRateCard,
        discounts: [{
          name: 'Scoped discount',
          type: 'percentage',
          value: 0.1,
          appliesTo: 'total',
          customerIds: [],
        }],
      },
      proposalDefaults: validProposalDefaults,
    }))
    expect(res.status).toBe(422)
  })

  it('returns 422 for invalid currency code (lowercase)', async () => {
    const res = await PATCH(createPatchRequest({
      rateCard: { ...validRateCard, currency: 'usd' },
      proposalDefaults: validProposalDefaults,
    }))
    expect(res.status).toBe(422)
  })

  it('returns 200 { success: true } for valid blended rate card', async () => {
    const res = await PATCH(createPatchRequest(validPatchBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 { success: true } for valid by-role rate card', async () => {
    const res = await PATCH(createPatchRequest({
      rateCard: {
        mode: 'by_role',
        blendedRate: null,
        blendedRateUnit: null,
        roles: [{ name: 'Senior Engineer', unit: 'hour', rate: 195 }],
        defaultMarginPct: 0.15,
        currency: 'GBP',
        discounts: [],
      },
      proposalDefaults: validProposalDefaults,
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('calls upsertRateCard with orgId from session (tenant isolation)', async () => {
    await PATCH(createPatchRequest(validPatchBody))
    expect(vi.mocked(upsertRateCard)).toHaveBeenCalledWith(
      'org_test',
      validRateCard,
      validProposalDefaults
    )
  })

  it('does NOT call upsertRateCard when validation fails', async () => {
    await PATCH(createPatchRequest({ rateCard: { mode: 'invalid' }, proposalDefaults: validProposalDefaults }))
    expect(vi.mocked(upsertRateCard)).not.toHaveBeenCalled()
  })
})
