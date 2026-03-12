import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  getAuthContext: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/services/company-profile', () => ({
  getCompanyProfile: vi.fn(),
  upsertCompanyProfile: vi.fn(),
}))

import { requireAuth, requireAdmin } from '@/lib/utils/auth'
import { getCompanyProfile, upsertCompanyProfile } from '@/lib/services/company-profile'
import { GET, PATCH } from '@/app/api/settings/company-profile/route'

const mockMember = { userId: 'user-1', orgId: 'org_test', orgRole: 'org:member' }
const mockAdmin = { userId: 'user-1', orgId: 'org_test', orgRole: 'org:admin' }

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings/company-profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue(mockMember)
  vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
  vi.mocked(getCompanyProfile).mockResolvedValue({ companyProfile: null })
  vi.mocked(upsertCompanyProfile).mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// GET /api/settings/company-profile
// ---------------------------------------------------------------------------

describe('GET /api/settings/company-profile', () => {
  it('returns 401 when unauthenticated', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAuth).mockRejectedValue(new AuthErrorClass('Authentication required', 401))

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 500 on unexpected server error', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('DB connection refused'))

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns { companyProfile: null } when no profile saved', async () => {
    vi.mocked(getCompanyProfile).mockResolvedValue({ companyProfile: null })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ companyProfile: null })
  })

  it('returns saved profile text when profile exists', async () => {
    vi.mocked(getCompanyProfile).mockResolvedValue({ companyProfile: '# About Us\n\nWe build things.' })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.companyProfile).toBe('# About Us\n\nWe build things.')
  })

  it('allows non-admin authenticated members to read profile', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockMember)
    vi.mocked(getCompanyProfile).mockResolvedValue({ companyProfile: '# About' })

    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('calls getCompanyProfile with orgId from session (tenant isolation)', async () => {
    await GET()
    expect(vi.mocked(getCompanyProfile)).toHaveBeenCalledWith('org_test')
  })

  it('does NOT call requireAdmin for GET (any member can read)', async () => {
    await GET()
    expect(vi.mocked(requireAdmin)).not.toHaveBeenCalled()
    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/settings/company-profile
// ---------------------------------------------------------------------------

describe('PATCH /api/settings/company-profile', () => {
  it('returns 401 when unauthenticated', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Authentication required', 401))

    const res = await PATCH(createPatchRequest({ companyProfile: '# Corp' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated user is not an admin', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await PATCH(createPatchRequest({ companyProfile: '# Corp' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for a non-JSON request body', async () => {
    const req = new NextRequest('http://localhost/api/settings/company-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON body')
  })

  it('returns 422 when companyProfile exceeds 10000 characters', async () => {
    const longText = 'x'.repeat(10001)
    const res = await PATCH(createPatchRequest({ companyProfile: longText }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details).toBeDefined()
    expect(Array.isArray(body.details)).toBe(true)
  })

  it('returns 422 when companyProfile field is missing from body', async () => {
    const res = await PATCH(createPatchRequest({}))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.details).toBeDefined()
  })

  it('returns 200 { success: true } for valid profile text', async () => {
    const res = await PATCH(createPatchRequest({ companyProfile: '# About\n\nWe build things.' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 { success: true } for null companyProfile (clear profile)', async () => {
    const res = await PATCH(createPatchRequest({ companyProfile: null }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 200 { success: true } for empty string companyProfile', async () => {
    const res = await PATCH(createPatchRequest({ companyProfile: '' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('calls upsertCompanyProfile with orgId and text (tenant isolation)', async () => {
    await PATCH(createPatchRequest({ companyProfile: '# Corp' }))
    expect(vi.mocked(upsertCompanyProfile)).toHaveBeenCalledWith('org_test', '# Corp')
  })

  it('calls upsertCompanyProfile with null when clearing profile', async () => {
    await PATCH(createPatchRequest({ companyProfile: null }))
    expect(vi.mocked(upsertCompanyProfile)).toHaveBeenCalledWith('org_test', null)
  })

  it('does NOT call upsertCompanyProfile when validation fails', async () => {
    const longText = 'x'.repeat(10001)
    await PATCH(createPatchRequest({ companyProfile: longText }))
    expect(vi.mocked(upsertCompanyProfile)).not.toHaveBeenCalled()
  })

  it('accepts exactly 10000 character profile (boundary value)', async () => {
    const exactText = 'x'.repeat(10000)
    const res = await PATCH(createPatchRequest({ companyProfile: exactText }))
    expect(res.status).toBe(200)
  })
})
