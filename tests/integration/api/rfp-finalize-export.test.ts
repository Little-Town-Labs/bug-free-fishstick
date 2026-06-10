import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAdminLimited: vi.fn(),
  requireAuthLimited: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(true),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/db', () => {
  const returning = vi.fn()
  const whereUpdate = vi.fn().mockReturnValue({ returning })
  const set = vi.fn().mockReturnValue({ where: whereUpdate })
  const limit = vi.fn()
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit,
    update: vi.fn().mockReturnValue({ set }),
    set,
    returning,
  }
  chain.select.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  return { db: chain }
})

vi.mock('@/lib/services/rfp-workflow', () => ({
  validateTransition: vi.fn(),
  WorkflowError: class WorkflowError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'WorkflowError'
    }
  },
}))

vi.mock('@/lib/services/rfp-versions', () => ({
  createVersionSnapshot: vi.fn(),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: vi.fn() },
}))

import { requireAdminLimited } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'
import { POST } from '@/app/api/rfps/[rfpId]/finalize/route'

const mockAdmin = { userId: 'admin-1', orgId: 'org-1', orgRole: 'org:admin' }

const mockRfp = {
  id: 'rfp-1',
  organizationId: 'org-1',
  status: 'approved',
  name: 'Test RFP',
}

describe('POST /api/rfps/[rfpId]/finalize — Inngest event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdminLimited).mockResolvedValue(mockAdmin as never)

    const dbAny = db as any // eslint-disable-line @typescript-eslint/no-explicit-any
    dbAny.select.mockReturnValue(dbAny)
    dbAny.from.mockReturnValue(dbAny)
    dbAny.where.mockReturnValue(dbAny)
    dbAny.limit.mockResolvedValue([mockRfp])

    const returning = vi.fn().mockResolvedValue([{ ...mockRfp, status: 'finalized' }])
    const whereUpdate = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where: whereUpdate })
    dbAny.update = vi.fn().mockReturnValue({ set })
  })

  it('sends rfp/generate-completed-document Inngest event after finalization', async () => {
    const req = new NextRequest('http://localhost:3000/api/rfps/rfp-1/finalize', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(200)
    expect(inngest.send).toHaveBeenCalledWith({
      name: 'rfp/generate-completed-document',
      data: {
        rfpId: 'rfp-1',
        organizationId: 'org-1',
      },
    })
  })

  it('includes documentGenerationQueued in response', async () => {
    const req = new NextRequest('http://localhost:3000/api/rfps/rfp-1/finalize', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    const body = await res.json()
    expect(body.documentGenerationQueued).toBe(true)
  })
})
