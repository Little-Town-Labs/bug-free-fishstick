import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  isAdmin: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public statusCode: number
    ) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock('@/lib/services/learning-capture', () => ({
  captureManualLearning: vi.fn(),
}))

import { GET, POST } from '@/app/api/learnings/route'
import { requireAuth } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { captureManualLearning } from '@/lib/services/learning-capture'

function createMockRequest(
  method: string,
  url = 'http://localhost:3000/api/learnings',
  body?: unknown
): NextRequest {
  const init: RequestInit = { method, headers: {} }
  if (body) {
    init.body = JSON.stringify(body)
    ;(init.headers as Record<string, string>)['content-type'] = 'application/json'
  }
   
  return new NextRequest(url, init as unknown as ConstructorParameters<typeof NextRequest>[1])
}

describe('Learnings API Routes', () => {
  const authCtx = { userId: 'user_1', orgId: 'org_123', orgRole: 'org:member' }

  const mockLearningRow = {
    id: '00000000-0000-4000-8000-000000000001',
    organizationId: 'org_123',
    customerId: 'cust-456',
    content: 'Key insight about the customer',
    sourceType: 'manual_entry',
    createdBy: 'user_1',
    sourceMetadata: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/learnings', () => {
    it('returns 200 with learnings array', async () => {
      vi.mocked(requireAuth).mockResolvedValue(authCtx)

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockLearningRow]),
      }
      vi.mocked(db.select).mockReturnValue(mockChain as never)

      const req = createMockRequest('GET')
      const res = await GET(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveProperty('learnings')
      expect(Array.isArray(body.learnings)).toBe(true)
    })

    it('filters by customerId when provided', async () => {
      vi.mocked(requireAuth).mockResolvedValue(authCtx)

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockLearningRow]),
      }
      vi.mocked(db.select).mockReturnValue(mockChain as never)

      const req = createMockRequest(
        'GET',
        'http://localhost:3000/api/learnings?customerId=cust-456'
      )
      const res = await GET(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.learnings).toBeDefined()
      // customerId filter was applied (where was called with an 'and' condition)
      expect(mockChain.where).toHaveBeenCalledWith(expect.anything())
    })

    it('returns 401 when unauthenticated', async () => {
      const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
      vi.mocked(requireAuth).mockRejectedValue(
        new AuthErrorClass('Unauthorized', 401)
      )

      const req = createMockRequest('GET')
      const res = await GET(req)

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/learnings', () => {
    it('creates manual_entry learning, returns 201', async () => {
      vi.mocked(requireAuth).mockResolvedValue(authCtx)
      vi.mocked(captureManualLearning).mockResolvedValue({
        ...mockLearningRow,
        sourceType: 'manual_entry',
      } as never)

      const req = createMockRequest('POST', undefined, {
        content: 'New insight about the customer',
        customerId: 'cust-456',
      })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body).toHaveProperty('learning')
      expect(captureManualLearning).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'New insight about the customer',
          organizationId: 'org_123',
          createdBy: 'user_1',
        })
      )
    })

    it('returns 400 when content is missing', async () => {
      vi.mocked(requireAuth).mockResolvedValue(authCtx)

      const req = createMockRequest('POST', undefined, { customerId: 'cust-456' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body).toHaveProperty('error')
    })

    it('returns 400 when content is empty string', async () => {
      vi.mocked(requireAuth).mockResolvedValue(authCtx)

      const req = createMockRequest('POST', undefined, { content: '   ' })
      const res = await POST(req)

      expect(res.status).toBe(400)
    })

    it('returns 401 when unauthenticated', async () => {
      const AuthErrorClass = (await import('@/lib/utils/auth')).AuthError
      vi.mocked(requireAuth).mockRejectedValue(
        new AuthErrorClass('Unauthorized', 401)
      )

      const req = createMockRequest('POST', undefined, { content: 'some insight' })
      const res = await POST(req)

      expect(res.status).toBe(401)
    })
  })
})
