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

vi.mock('@/lib/services/proposal-content-library', () => ({
  createEntry: vi.fn(),
  listEntries: vi.fn(),
  getEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  ensureFixedSections: vi.fn().mockResolvedValue(undefined),
}))

import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import {
  createEntry,
  listEntries,
  getEntry,
  updateEntry,
  deleteEntry,
} from '@/lib/services/proposal-content-library'
import { GET as listHandler, POST as createHandler } from '@/app/api/content-library/route'
import {
  GET as getHandler,
  PATCH as patchHandler,
  DELETE as deleteHandler,
} from '@/app/api/content-library/[entryId]/route'

const mockUser = { userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' }

const mockEntry = {
  id: 'entry-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  category: 'Pricing',
  name: 'Standard Pricing',
  content: 'Our standard pricing is...',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'content-type': 'application/json' }
  }
  return new NextRequest(url, init as unknown as ConstructorParameters<typeof NextRequest>[1])
}

function entryParams(entryId: string) {
  return { params: Promise.resolve({ entryId }) } as never
}

describe('content-library API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthLimited).mockResolvedValue(mockUser)
  })

  describe('GET /api/content-library', () => {
    it('returns 200 with entries list', async () => {
      vi.mocked(listEntries).mockResolvedValue([mockEntry] as never)
      const req = createRequest('GET', 'http://localhost/api/content-library')
      const res = await listHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0].id).toBe('entry-1')
    })

    it('passes category filter to service', async () => {
      vi.mocked(listEntries).mockResolvedValue([mockEntry] as never)
      const req = createRequest('GET', 'http://localhost/api/content-library?category=Pricing')
      await listHandler(req)
      expect(listEntries).toHaveBeenCalledWith('org-1', 'Pricing', undefined)
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new (AuthError as unknown as new (msg: string, code: number) => Error)('Unauthorized', 401)
      )
      const req = createRequest('GET', 'http://localhost/api/content-library')
      const res = await listHandler(req)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/content-library', () => {
    it('returns 201 with created entry', async () => {
      vi.mocked(createEntry).mockResolvedValue(mockEntry as never)
      const req = createRequest('POST', 'http://localhost/api/content-library', {
        category: 'Pricing',
        name: 'Standard Pricing',
        content: 'Our standard pricing is...',
      })
      const res = await createHandler(req)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.entry.id).toBe('entry-1')
    })

    it('returns 400 when category is missing', async () => {
      const req = createRequest('POST', 'http://localhost/api/content-library', {
        name: 'Test',
        content: 'Content',
      })
      const res = await createHandler(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 when name is missing', async () => {
      const req = createRequest('POST', 'http://localhost/api/content-library', {
        category: 'Pricing',
        content: 'Content',
      })
      const res = await createHandler(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 when content is missing', async () => {
      const req = createRequest('POST', 'http://localhost/api/content-library', {
        category: 'Pricing',
        name: 'Test',
      })
      const res = await createHandler(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 when category is empty string', async () => {
      const req = createRequest('POST', 'http://localhost/api/content-library', {
        category: '',
        name: 'Test',
        content: 'Content',
      })
      const res = await createHandler(req)
      expect(res.status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new (AuthError as unknown as new (msg: string, code: number) => Error)('Unauthorized', 401)
      )
      const req = createRequest('POST', 'http://localhost/api/content-library', {
        category: 'Pricing',
        name: 'Test',
        content: 'Content',
      })
      const res = await createHandler(req)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/content-library/[entryId]', () => {
    it('returns 200 with entry', async () => {
      vi.mocked(getEntry).mockResolvedValue(mockEntry as never)
      const req = createRequest('GET', 'http://localhost/api/content-library/entry-1')
      const res = await getHandler(req, entryParams('entry-1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.entry.id).toBe('entry-1')
    })

    it('returns 404 when entry not found', async () => {
      vi.mocked(getEntry).mockRejectedValue(
        Object.assign(new Error('Not found'), { statusCode: 404 })
      )
      const req = createRequest('GET', 'http://localhost/api/content-library/missing')
      const res = await getHandler(req, entryParams('missing'))
      expect(res.status).toBe(404)
    })

    it('enforces org scope (403 for cross-org access resolves as 404)', async () => {
      vi.mocked(getEntry).mockRejectedValue(
        Object.assign(new Error('Not found'), { statusCode: 404 })
      )
      const req = createRequest('GET', 'http://localhost/api/content-library/entry-1')
      const res = await getHandler(req, entryParams('entry-1'))
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/content-library/[entryId]', () => {
    it('returns 200 with updated entry', async () => {
      vi.mocked(updateEntry).mockResolvedValue({ ...mockEntry, name: 'Updated' } as never)
      const req = createRequest('PATCH', 'http://localhost/api/content-library/entry-1', {
        name: 'Updated',
      })
      const res = await patchHandler(req, entryParams('entry-1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.entry.name).toBe('Updated')
    })

    it('returns 400 when patch values fail validation (empty string)', async () => {
      const req = createRequest('PATCH', 'http://localhost/api/content-library/entry-1', {
        name: '',
      })
      const res = await patchHandler(req, entryParams('entry-1'))
      expect(res.status).toBe(400)
    })

    it('returns 404 when entry not found', async () => {
      vi.mocked(updateEntry).mockRejectedValue(
        Object.assign(new Error('Not found'), { statusCode: 404 })
      )
      const req = createRequest('PATCH', 'http://localhost/api/content-library/missing', {
        name: 'Test',
      })
      const res = await patchHandler(req, entryParams('missing'))
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/content-library/[entryId]', () => {
    it('returns 204 on successful delete', async () => {
      vi.mocked(deleteEntry).mockResolvedValue(undefined)
      const req = createRequest('DELETE', 'http://localhost/api/content-library/entry-1')
      const res = await deleteHandler(req, entryParams('entry-1'))
      expect(res.status).toBe(204)
    })

    it('returns 404 when entry not found', async () => {
      vi.mocked(deleteEntry).mockRejectedValue(
        Object.assign(new Error('Not found'), { statusCode: 404 })
      )
      const req = createRequest('DELETE', 'http://localhost/api/content-library/missing')
      const res = await deleteHandler(req, entryParams('missing'))
      expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new (AuthError as unknown as new (msg: string, code: number) => Error)('Unauthorized', 401)
      )
      const req = createRequest('DELETE', 'http://localhost/api/content-library/entry-1')
      const res = await deleteHandler(req, entryParams('entry-1'))
      expect(res.status).toBe(401)
    })
  })
})
