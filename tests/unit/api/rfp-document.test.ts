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

vi.mock('@/lib/storage/blob', () => ({
  downloadFile: vi.fn(),
}))

import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { downloadFile } from '@/lib/storage/blob'
import { GET } from '@/app/api/rfps/[rfpId]/document/route'

const mockUser = { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' }

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/rfps/rfp-1/document')
}

function makeParams(rfpId = 'rfp-1') {
  return { params: Promise.resolve({ rfpId }) }
}

describe('GET /api/rfps/[rfpId]/document', () => {
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
    const body = await res.json()
    expect(body.error).toBe('RFP not found')
  })

  it('returns 404 when no file uploaded', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any).limit.mockResolvedValue([{
      id: 'rfp-1',
      organizationId: 'org-1',
      originalFileUrl: null,
      originalFileType: null,
    }])

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('No document uploaded for this RFP')
  })

  it('returns PDF with correct content-type', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any).limit.mockResolvedValue([{
      id: 'rfp-1',
      organizationId: 'org-1',
      originalFileUrl: 'https://blob.example.com/doc.pdf',
      originalFileType: 'pdf',
    }])

    const pdfBuffer = Buffer.from('%PDF-1.4 test')
    vi.mocked(downloadFile).mockResolvedValue(pdfBuffer)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('returns DOCX with correct content-type', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(db as any).limit.mockResolvedValue([{
      id: 'rfp-1',
      organizationId: 'org-1',
      originalFileUrl: 'https://blob.example.com/doc.docx',
      originalFileType: 'docx',
    }])

    const docxBuffer = Buffer.from('PK test')
    vi.mocked(downloadFile).mockResolvedValue(docxBuffer)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })
})
