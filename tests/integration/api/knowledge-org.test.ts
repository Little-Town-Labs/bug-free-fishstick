import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// jsdom's File does not implement arrayBuffer(); polyfill it so route handlers
// that call file.arrayBuffer() don't throw in tests (parsers are mocked anyway).
if (!File.prototype.arrayBuffer) {
  Object.defineProperty(File.prototype, 'arrayBuffer', {
    value(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(0))
    },
    writable: true,
    configurable: true,
  })
}

// Mock next/server's after() — not available outside a real Next.js request scope
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: vi.fn((fn: () => unknown) => fn()) }
})

// Mock dependencies
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

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{}])),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
    })),
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn(() => Promise.resolve({ ids: ['event-id'] })),
  },
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn(() =>
    Promise.resolve({
      url: 'https://blob.vercel-storage.com/doc.pdf',
      downloadUrl: 'https://blob.vercel-storage.com/doc.pdf',
    })
  ),
}))

vi.mock('@/lib/documents/pdf-parser', () => ({
  parsePdf: vi.fn(() => Promise.resolve({ text: 'parsed pdf content', pages: 1 })),
}))

vi.mock('@/lib/documents/word-parser', () => ({
  parseWord: vi.fn(() => Promise.resolve({ text: 'parsed word content' })),
}))

import { GET as listEntries, POST as createEntry } from '@/app/api/knowledge/route'
import { POST as uploadDocument } from '@/app/api/knowledge/upload/route'
import { DELETE as deleteEntry } from '@/app/api/knowledge/[entryId]/route'

import { requireAuth, requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'

import { createMockKnowledgeEntry } from '../../factories/index'

const TEST_ENTRY_ID = '00000000-0000-4000-8000-000000000099'

function createMockRequest(
  method: string,
  url: string = 'http://localhost:3000/api/knowledge',
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: headers || {},
  }
  if (body) {
    init.body = JSON.stringify(body)
    if (!headers?.['content-type']) {
      init.headers = { ...init.headers, 'content-type': 'application/json' }
    }
  }
  return new NextRequest(url, init as unknown as ConstructorParameters<typeof NextRequest>[1])
}

// In the jsdom/Node test environment, Request does not auto-set the
// Content-Type boundary when body is FormData, so request.formData() would
// throw. Override formData() directly to bypass the Content-Type check.
function createMockFormDataRequest(method: string, url: string, formData: FormData): NextRequest {
  const request = new NextRequest(url, { method })
  Object.defineProperty(request, 'formData', {
    value: () => Promise.resolve(formData),
    writable: true,
    configurable: true,
  })
  return request
}

describe('Org-Level Knowledge API Routes', () => {
  const mockAuthContext = { userId: 'user_123', orgId: 'org_456', orgRole: 'admin' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/knowledge', () => {
    it('should return 200 with array of org-level entries', async () => {
      const mockEntries = [
        createMockKnowledgeEntry({ customerId: undefined, organizationId: 'org_456' }),
        createMockKnowledgeEntry({ customerId: undefined, organizationId: 'org_456' }),
      ]

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockEntries)),
          })),
        })),
      } as never)

      const request = createMockRequest('GET')
      const response = await listEntries(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.entries).toBeDefined()
      expect(Array.isArray(data.entries)).toBe(true)
      expect(requireAuth).toHaveBeenCalled()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('Unauthorized', 401))

      const request = createMockRequest('GET')
      const response = await listEntries(request)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/knowledge', () => {
    it('should return 201 with created entry (admin) and send Inngest event', async () => {
      const mockCreatedEntry = createMockKnowledgeEntry({
        id: 'entry_new',
        customerId: undefined,
        organizationId: 'org_456',
        title: 'Company Policy',
        content: 'Our company policy...',
        type: 'company_doc',
      })

      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockCreatedEntry])),
        })),
      } as never)
      vi.mocked(inngest.send).mockResolvedValue({ ids: ['event-123'] })

      const request = createMockRequest('POST', 'http://localhost:3000/api/knowledge', {
        title: 'Company Policy',
        content: 'Our company policy...',
        type: 'company_doc',
      })
      const response = await createEntry(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.entry).toBeDefined()
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'rfp/generate-embeddings' })
      )
    })

    it('should return 400 on invalid body (missing required fields)', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)

      const request = createMockRequest('POST', 'http://localhost:3000/api/knowledge', {
        type: 'company_doc',
        // missing title and content
      })
      const response = await createEntry(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new AuthError('Admin access required', 403))

      const request = createMockRequest('POST', 'http://localhost:3000/api/knowledge', {
        title: 'Test',
        content: 'Content',
        type: 'company_doc',
      })
      const response = await createEntry(request)

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/knowledge/upload', () => {
    it('should return 201 with created entry from multipart upload (admin)', async () => {
      const mockCreatedEntry = createMockKnowledgeEntry({
        customerId: undefined,
        organizationId: 'org_456',
        title: 'Past Proposal',
        type: 'past_rfp',
      })

      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockCreatedEntry])),
        })),
      } as never)

      const formData = new FormData()
      const file = new File(['test content'], 'proposal.pdf', { type: 'application/pdf' })
      formData.append('file', file)
      formData.append('type', 'past_rfp')
      formData.append('title', 'Past Proposal')

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/knowledge/upload',
        formData
      )
      const response = await uploadDocument(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.entry).toBeDefined()
    })

    it('should return 400 when no file attached', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)

      const formData = new FormData()
      formData.append('type', 'past_rfp')
      formData.append('title', 'Past Proposal')

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/knowledge/upload',
        formData
      )
      const response = await uploadDocument(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new AuthError('Admin access required', 403))

      const formData = new FormData()
      const file = new File(['test content'], 'proposal.pdf', { type: 'application/pdf' })
      formData.append('file', file)
      formData.append('type', 'past_rfp')
      formData.append('title', 'Past Proposal')

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/knowledge/upload',
        formData
      )
      const response = await uploadDocument(request)

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/knowledge/[entryId]', () => {
    it('should return 204 on success (admin)', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
      } as never)

      const request = createMockRequest(
        'DELETE',
        `http://localhost:3000/api/knowledge/${TEST_ENTRY_ID}`
      )
      const response = await deleteEntry(request, {
        params: Promise.resolve({ entryId: TEST_ENTRY_ID }),
      })

      expect(response.status).toBe(204)
    })

    it('should return 404 when entry not found', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
      } as never)

      const request = createMockRequest(
        'DELETE',
        `http://localhost:3000/api/knowledge/nonexistent`
      )
      const response = await deleteEntry(request, {
        params: Promise.resolve({ entryId: 'nonexistent' }),
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new AuthError('Admin access required', 403))

      const request = createMockRequest(
        'DELETE',
        `http://localhost:3000/api/knowledge/${TEST_ENTRY_ID}`
      )
      const response = await deleteEntry(request, {
        params: Promise.resolve({ entryId: TEST_ENTRY_ID }),
      })

      expect(response.status).toBe(403)
    })
  })
})
