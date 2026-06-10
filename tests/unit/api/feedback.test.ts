import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
const mockDbSelect = vi.fn()
const mockInngestSend = vi.fn()

vi.mock('@/lib/utils/auth', () => ({
  requireAuthLimited: () => mockRequireAuth(),
  AuthError: class AuthError extends Error {
    statusCode: number
    constructor(message: string, statusCode: number) {
      super(message)
      this.name = 'AuthError'
      this.statusCode = statusCode
    }
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbSelect(),
        }),
      }),
    }),
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}))

// Must mock schema modules
vi.mock('@/lib/db/schema/rfps', () => ({
  rfps: { id: 'id', organizationId: 'org_id', customerId: 'customer_id' },
}))

import { POST } from '@/app/api/rfps/[rfpId]/responses/[fieldId]/feedback/route'

describe('POST /api/rfps/[rfpId]/responses/[fieldId]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user1', orgId: 'org1', orgRole: 'org:member' })
    mockDbSelect.mockResolvedValue([{ id: 'rfp1', customerId: 'cust1' }])
    mockInngestSend.mockResolvedValue(undefined)
  })

  it('returns 202 for valid accept feedback', async () => {
    const req = new Request('http://localhost/api/rfps/rfp1/responses/f1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'accept' }),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp1', fieldId: 'f1' }) })
    expect(res.status).toBe(202)

    const body = await res.json()
    expect(body.queued).toBe(true)
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'rfp/capture-learning',
        data: expect.objectContaining({ type: 'accept', rfpId: 'rfp1', fieldId: 'f1' }),
      })
    )
  })

  it('returns 400 for invalid feedback type', async () => {
    const req = new Request('http://localhost/api/rfps/rfp1/responses/f1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invalid' }),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp1', fieldId: 'f1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when RFP not found', async () => {
    mockDbSelect.mockResolvedValue([])

    const req = new Request('http://localhost/api/rfps/rfp1/responses/f1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'accept' }),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp1', fieldId: 'f1' }) })
    expect(res.status).toBe(404)
  })

  it('sends edit feedback with original and corrected text', async () => {
    const req = new Request('http://localhost/api/rfps/rfp1/responses/f1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'edit', originalText: 'old', correctedText: 'new' }),
    })

    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp1', fieldId: 'f1' }) })
    expect(res.status).toBe(202)
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'edit', originalText: 'old', correctedText: 'new' }),
      })
    )
  })
})
