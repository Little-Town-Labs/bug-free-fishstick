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

vi.mock('@/lib/db', () => {
  const limit = vi.fn()
  const chain = { select: vi.fn(), from: vi.fn(), where: vi.fn(), limit }
  chain.select.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  return { db: chain }
})

import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { GET } from '@/app/api/rfps/[rfpId]/download/route'

const mockUser = { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' }

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/rfps/rfp-1/download')
}

function makeParams(rfpId = 'rfp-1') {
  return { params: Promise.resolve({ rfpId }) }
}

describe('GET /api/rfps/[rfpId]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthLimited).mockResolvedValue(mockUser as never)

    const dbAny = db as any // eslint-disable-line @typescript-eslint/no-explicit-any
    dbAny.select.mockReturnValue(dbAny)
    dbAny.from.mockReturnValue(dbAny)
    dbAny.where.mockReturnValue(dbAny)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthLimited).mockRejectedValue(new (AuthError as unknown as new (msg: string, code: number) => Error)('Unauthorized', 401))

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when RFP not found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any).limit.mockResolvedValue([])

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 302 redirect when completedFileUrl exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any).limit.mockResolvedValue([{
      id: 'rfp-1',
      organizationId: 'org-1',
      completedFileUrl: 'https://blob.example.com/completed.pdf',
      completedFileError: null,
    }])

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://blob.example.com/completed.pdf')
  })

  it('returns 404 with completedFileError when no URL and error exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any).limit.mockResolvedValue([{
      id: 'rfp-1',
      organizationId: 'org-1',
      completedFileUrl: null,
      completedFileError: 'PDF generation failed — field positions missing',
    }])

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Completed document not available')
    expect(body.completedFileError).toBe('PDF generation failed — field positions missing')
  })

  it('returns 404 when neither URL nor error exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any).limit.mockResolvedValue([{
      id: 'rfp-1',
      organizationId: 'org-1',
      completedFileUrl: null,
      completedFileError: null,
    }])

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Completed document not available')
    expect(body.completedFileError).toBeNull()
  })
})
