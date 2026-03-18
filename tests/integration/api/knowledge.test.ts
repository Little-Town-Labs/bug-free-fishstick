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
          then: vi.fn((cb: (v: unknown[]) => unknown) => cb([])),
        })),
        then: vi.fn((cb: (v: unknown[]) => unknown) => cb([])),
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

vi.mock('@/lib/services/vector-search', () => ({
  searchSimilar: vi.fn(),
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
  parsePdf: vi.fn(() => Promise.resolve({ text: 'parsed pdf content' })),
}))

vi.mock('@/lib/documents/word-parser', () => ({
  parseWord: vi.fn(() => Promise.resolve({ text: 'parsed word content' })),
}))

// These imports will fail in red phase since routes don't exist yet
import { GET as listEntries, POST as createEntry } from '@/app/api/customers/[customerId]/knowledge/route'
import { POST as uploadDocument } from '@/app/api/customers/[customerId]/knowledge/upload/route'
import { POST as searchKnowledge } from '@/app/api/customers/[customerId]/knowledge/search/route'
import { GET as getEntry, DELETE as deleteEntry } from '@/app/api/customers/[customerId]/knowledge/[entryId]/route'

import { requireAuth, requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'
import { searchSimilar } from '@/lib/services/vector-search'
import { put as blobPut } from '@vercel/blob'

import { createMockKnowledgeEntry } from '../../factories/index'

const TEST_CUSTOMER_ID = '00000000-0000-4000-8000-000000000001'

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  url: string = `http://localhost:3000/api/customers/${TEST_CUSTOMER_ID}/knowledge`,
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

// Helper to create mock FormData request.
// In the jsdom/Node test environment, Request does not auto-set the
// Content-Type boundary when body is FormData, so request.formData() would
// throw. Override formData() directly to bypass the Content-Type check.
function createMockFormDataRequest(
  method: string,
  url: string,
  formData: FormData
): NextRequest {
  const request = new NextRequest(url, { method })
  Object.defineProperty(request, 'formData', {
    value: () => Promise.resolve(formData),
    writable: true,
    configurable: true,
  })
  return request
}

describe('Knowledge API Routes - Contract Tests (TDD Red Phase)', () => {
  const customerId = TEST_CUSTOMER_ID
  const mockAuthContext = { userId: 'user_123', orgId: 'org_456', orgRole: 'admin' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/customers/[customerId]/knowledge (list)', () => {
    it('should return 200 with array of entries', async () => {
      const mockEntries = [
        createMockKnowledgeEntry({ customerId, organizationId: 'org_456' }),
        createMockKnowledgeEntry({ customerId, organizationId: 'org_456' }),
      ]

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockEntries)),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/customers/${customerId}/knowledge`
      )
      const response = await listEntries(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.entries).toBeDefined()
      expect(Array.isArray(data.entries)).toBe(true)
      expect(requireAuth).toHaveBeenCalled()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('Unauthorized', 401))

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/customers/${customerId}/knowledge`
      )
      const response = await listEntries(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/customers/[customerId]/knowledge (create)', () => {
    it('should return 201 with created entry (admin) and send Inngest event', async () => {
      const mockCreatedEntry = createMockKnowledgeEntry({
        id: 'entry_new',
        customerId,
        organizationId: 'org_456',
        title: 'New Entry',
        content: 'Entry content',
        type: 'company_doc',
      })

      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockCreatedEntry])),
        })),
      } as never)
      vi.mocked(inngest.send).mockResolvedValue({ ids: ['event-123'] })

      const request = createMockRequest(
        'POST',
        `http://localhost:3000/api/customers/${customerId}/knowledge`,
        { title: 'New Entry', content: 'Entry content', type: 'company_doc' }
      )
      const response = await createEntry(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.entry).toBeDefined()
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'rfp/generate-embeddings' })
      )
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new AuthError('Admin access required', 403)
      )

      const request = createMockRequest(
        'POST',
        `http://localhost:3000/api/customers/${customerId}/knowledge`,
        { title: 'New Entry', content: 'Entry content', type: 'company_doc' }
      )
      const response = await createEntry(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(403)
    })

    it('should return 400 on invalid body', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)

      const request = createMockRequest(
        'POST',
        `http://localhost:3000/api/customers/${customerId}/knowledge`,
        { type: 'company_doc' } // missing title and content
      )
      const response = await createEntry(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('POST /api/customers/[customerId]/knowledge/upload', () => {
    it('should return 201 with created entry from multipart upload (admin)', async () => {
      const mockCreatedEntry = createMockKnowledgeEntry({
        customerId,
        organizationId: 'org_456',
        title: 'Test Document',
        type: 'company_doc',
      })

      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(blobPut).mockResolvedValue({
        url: 'https://blob.vercel-storage.com/doc.pdf',
        downloadUrl: 'https://blob.vercel-storage.com/doc.pdf',
        pathname: `${customerId}/doc.pdf`,
        contentType: 'application/pdf',
        contentDisposition: 'attachment; filename="test.pdf"',
        etag: 'mock-etag',
      })
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockCreatedEntry])),
        })),
      } as never)

      const formData = new FormData()
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      formData.append('file', file)
      formData.append('type', 'company_doc')
      formData.append('title', 'Test Document')

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/customers/${customerId}/knowledge/upload',
        formData
      )
      const response = await uploadDocument(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.entry).toBeDefined()
    })

    it('should return 400 when no file attached', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)

      const formData = new FormData()
      formData.append('type', 'company_doc')
      formData.append('title', 'Test Document')
      // no file attached

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/customers/${customerId}/knowledge/upload',
        formData
      )
      const response = await uploadDocument(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new AuthError('Admin access required', 403)
      )

      const formData = new FormData()
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      formData.append('file', file)
      formData.append('type', 'company_doc')
      formData.append('title', 'Test Document')

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/customers/${customerId}/knowledge/upload',
        formData
      )
      const response = await uploadDocument(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/customers/[customerId]/knowledge/search', () => {
    it('should return 200 with results array including similarity scores', async () => {
      const mockEntry = createMockKnowledgeEntry({
        customerId,
        organizationId: 'org_456',
      })
      const mockResults = [
        { entry: mockEntry, similarity: 0.92 },
        { entry: createMockKnowledgeEntry({ customerId }), similarity: 0.85 },
      ]

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(searchSimilar).mockResolvedValue(mockResults as never)

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/customers/${customerId}/knowledge/search',
        { query: 'enterprise solutions', limit: 5 }
      )
      const response = await searchKnowledge(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.results).toBeDefined()
      expect(Array.isArray(data.results)).toBe(true)
      expect(data.results[0]).toHaveProperty('similarity')
    })

    it('should return 400 on empty query', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/customers/${customerId}/knowledge/search',
        { query: '' }
      )
      const response = await searchKnowledge(request, { params: Promise.resolve({ customerId }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/customers/[customerId]/knowledge/[entryId] (get)', () => {
    it('should return 200 with entry', async () => {
      const mockEntry = createMockKnowledgeEntry({
        id: 'entry_1',
        customerId,
        organizationId: 'org_456',
      })

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockEntry])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/customers/${customerId}/knowledge/entry_1'
      )
      const response = await getEntry(request, {
        params: Promise.resolve({ customerId, entryId: 'entry_1' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.entry).toBeDefined()
      expect(data.entry.id).toBe('entry_1')
    })

    it('should return 404 when not found', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/customers/${customerId}/knowledge/nonexistent'
      )
      const response = await getEntry(request, {
        params: Promise.resolve({ customerId, entryId: 'nonexistent' }),
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('DELETE /api/customers/[customerId]/knowledge/[entryId] (delete)', () => {
    it('should return 204 on success (admin)', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
      } as never)

      const request = createMockRequest(
        'DELETE',
        'http://localhost:3000/api/customers/${customerId}/knowledge/entry_1'
      )
      const response = await deleteEntry(request, {
        params: Promise.resolve({ customerId, entryId: 'entry_1' }),
      })

      expect(response.status).toBe(204)
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new AuthError('Admin access required', 403)
      )

      const request = createMockRequest(
        'DELETE',
        'http://localhost:3000/api/customers/${customerId}/knowledge/entry_1'
      )
      const response = await deleteEntry(request, {
        params: Promise.resolve({ customerId, entryId: 'entry_1' }),
      })

      expect(response.status).toBe(403)
    })

    it('should return 404 when not found', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
      } as never)

      const request = createMockRequest(
        'DELETE',
        'http://localhost:3000/api/customers/${customerId}/knowledge/nonexistent'
      )
      const response = await deleteEntry(request, {
        params: Promise.resolve({ customerId, entryId: 'nonexistent' }),
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })
})
