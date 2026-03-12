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

vi.mock('@/lib/services/proposalTemplates', () => ({
  listProposalTemplates: vi.fn(),
  createProposalTemplate: vi.fn(),
  updateProposalTemplate: vi.fn(),
  deleteProposalTemplate: vi.fn(),
  reorderProposalTemplates: vi.fn(),
}))

import { requireAuth, requireAdmin } from '@/lib/utils/auth'
import {
  listProposalTemplates,
  createProposalTemplate,
  updateProposalTemplate,
  deleteProposalTemplate,
  reorderProposalTemplates,
} from '@/lib/services/proposalTemplates'
import { GET, POST } from '@/app/api/settings/proposal-templates/route'
import { POST as REORDER } from '@/app/api/settings/proposal-templates/reorder/route'
import { PATCH, DELETE } from '@/app/api/settings/proposal-templates/[id]/route'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockMember = { userId: 'user-1', orgId: 'org_test', orgRole: 'org:member' }
const mockAdmin = { userId: 'user-1', orgId: 'org_test', orgRole: 'org:admin' }

const mockTemplate = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  organizationId: 'org_test',
  section: 'assumptions' as const,
  title: 'Standard Assumptions',
  content: 'All work performed during business hours.',
  isRequired: false,
  triggerRfpTypes: null,
  triggerIndustryTags: null,
  evaluateCoverage: false,
  sortOrder: 0,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const validCreateBody = {
  section: 'assumptions',
  title: 'Standard Assumptions',
  content: 'All work performed during business hours.',
}

const validReorderBody = {
  items: [
    { id: '550e8400-e29b-41d4-a716-446655440000', sortOrder: 0 },
    { id: '660e8400-e29b-41d4-a716-446655440001', sortOrder: 1 },
  ],
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings/proposal-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createPatchRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/settings/proposal-templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createReorderRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings/proposal-templates/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createDeleteRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/settings/proposal-templates/${id}`, {
    method: 'DELETE',
  })
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue(mockMember)
  vi.mocked(requireAdmin).mockResolvedValue(mockAdmin)
  vi.mocked(listProposalTemplates).mockResolvedValue([mockTemplate])
  vi.mocked(createProposalTemplate).mockResolvedValue(mockTemplate)
  vi.mocked(updateProposalTemplate).mockResolvedValue(mockTemplate)
  vi.mocked(deleteProposalTemplate).mockResolvedValue(true)
  vi.mocked(reorderProposalTemplates).mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// GET /api/settings/proposal-templates
// ---------------------------------------------------------------------------

describe('GET /api/settings/proposal-templates', () => {
  it('returns 200 with templates array when authenticated', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templates).toBeInstanceOf(Array)
    expect(body.templates).toHaveLength(1)
    expect(body.templates[0].id).toBe(mockTemplate.id)
  })

  it('returns 403 when requireAdmin throws AuthError(403)', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('DB connection refused'))

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('calls listProposalTemplates with orgId from session', async () => {
    await GET()
    expect(vi.mocked(listProposalTemplates)).toHaveBeenCalledWith('org_test')
  })

  it('returns empty array when no templates exist', async () => {
    vi.mocked(listProposalTemplates).mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templates).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// POST /api/settings/proposal-templates
// ---------------------------------------------------------------------------

describe('POST /api/settings/proposal-templates', () => {
  it('returns 201 with created template on valid body (admin)', async () => {
    const res = await POST(createPostRequest(validCreateBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.template).toBeDefined()
    expect(body.template.id).toBe(mockTemplate.id)
  })

  it('returns 400 when isRequired=true and evaluateCoverage=true (Zod refine)', async () => {
    const invalidBody = {
      ...validCreateBody,
      isRequired: true,
      evaluateCoverage: true,
    }
    const res = await POST(createPostRequest(invalidBody))
    expect(res.status).toBe(400)
  })

  it('returns 400 when required fields missing (no section)', async () => {
    const { section: _section, ...bodyWithoutSection } = validCreateBody
    const res = await POST(createPostRequest(bodyWithoutSection))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/settings/proposal-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 403 when requireAdmin throws AuthError(403)', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await POST(createPostRequest(validCreateBody))
    expect(res.status).toBe(403)
  })

  it('calls createProposalTemplate with auth.userId as createdBy', async () => {
    await POST(createPostRequest(validCreateBody))
    expect(vi.mocked(createProposalTemplate)).toHaveBeenCalledWith(
      'org_test',
      'user-1',
      expect.objectContaining({ section: 'assumptions' })
    )
  })
})

// ---------------------------------------------------------------------------
// POST /api/settings/proposal-templates/reorder
// ---------------------------------------------------------------------------

describe('POST /api/settings/proposal-templates/reorder', () => {
  it('returns 200 with { success: true } on valid reorder', async () => {
    const res = await REORDER(createReorderRequest(validReorderBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 when service throws INVALID_IDS error', async () => {
    vi.mocked(reorderProposalTemplates).mockRejectedValue(new Error('INVALID_IDS'))

    const res = await REORDER(createReorderRequest(validReorderBody))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(
      'One or more template IDs are invalid or do not belong to this organization'
    )
  })

  it('returns 400 for empty items array', async () => {
    const res = await REORDER(createReorderRequest({ items: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-admin', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await REORDER(createReorderRequest(validReorderBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/settings/proposal-templates/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    })
    const res = await REORDER(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/settings/proposal-templates/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/settings/proposal-templates/[id]', () => {
  const templateId = '550e8400-e29b-41d4-a716-446655440000'

  it('returns 200 with updated template on valid patch', async () => {
    const res = await PATCH(createPatchRequest(templateId, { title: 'Updated Title' }), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.template).toBeDefined()
    expect(body.template.id).toBe(mockTemplate.id)
  })

  it('returns 404 when service returns null (not found)', async () => {
    vi.mocked(updateProposalTemplate).mockResolvedValue(null)

    const res = await PATCH(createPatchRequest(templateId, { title: 'Updated Title' }), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await PATCH(createPatchRequest(templateId, { title: 'Updated Title' }), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new NextRequest(
      `http://localhost/api/settings/proposal-templates/${templateId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{{{',
      }
    )
    const res = await PATCH(req, { params: Promise.resolve({ id: templateId }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('calls updateProposalTemplate with orgId, templateId, and patch data', async () => {
    const patch = { title: 'Updated Title' }
    await PATCH(createPatchRequest(templateId, patch), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(vi.mocked(updateProposalTemplate)).toHaveBeenCalledWith(
      'org_test',
      templateId,
      expect.objectContaining({ title: 'Updated Title' })
    )
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/settings/proposal-templates/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/settings/proposal-templates/[id]', () => {
  const templateId = '550e8400-e29b-41d4-a716-446655440000'

  it('returns 204 with no body on successful delete', async () => {
    const res = await DELETE(createDeleteRequest(templateId), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(res.status).toBe(204)
  })

  it('returns 404 when service returns false (not found)', async () => {
    vi.mocked(deleteProposalTemplate).mockResolvedValue(false)

    const res = await DELETE(createDeleteRequest(templateId), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin', async () => {
    const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
    vi.mocked(requireAdmin).mockRejectedValue(new AuthErrorClass('Admin access required', 403))

    const res = await DELETE(createDeleteRequest(templateId), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(res.status).toBe(403)
  })

  it('calls deleteProposalTemplate with orgId and templateId', async () => {
    await DELETE(createDeleteRequest(templateId), {
      params: Promise.resolve({ id: templateId }),
    })
    expect(vi.mocked(deleteProposalTemplate)).toHaveBeenCalledWith('org_test', templateId)
  })
})
