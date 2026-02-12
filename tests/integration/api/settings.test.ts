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
    update: vi.fn(),
  },
}))

vi.mock('@/lib/services/encryption', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace('enc:', '')),
}))

import { GET, PATCH } from '@/app/api/settings/route'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'

function createMockRequest(
  method: string,
  url = 'http://localhost:3000/api/settings',
  body?: unknown
): NextRequest {
  const init: RequestInit = { method, headers: {} }
  if (body) {
    init.body = JSON.stringify(body)
    ;(init.headers as Record<string, string>)['content-type'] = 'application/json'
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(url, init as any)
}

describe('Settings API Routes', () => {
  const adminCtx = { userId: 'user_1', orgId: 'org_123', orgRole: 'org:admin' }
  const memberCtx = { userId: 'user_2', orgId: 'org_123', orgRole: 'org:member' }

  const mockSettingsRow = {
    organizationId: 'org_123',
    llmProvider: 'claude',
    llmApiKeyEncrypted: 'enc:sk-ant-123',
    confidenceThreshold: 0.7,
    autoLearnEnabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/settings', () => {
    it('returns 200 with settings for authenticated user', async () => {
      vi.mocked(requireAuth).mockResolvedValue(memberCtx)
      vi.mocked(isAdmin).mockReturnValue(false)

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockSettingsRow])),
          })),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings).toBeDefined()
      expect(data.settings.llmProvider).toBe('claude')
    })

    it('returns llmApiKeyConfigured=true when key is set', async () => {
      vi.mocked(requireAuth).mockResolvedValue(memberCtx)
      vi.mocked(isAdmin).mockReturnValue(false)

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockSettingsRow])),
          })),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const response = await GET()
      const data = await response.json()

      expect(data.settings.llmApiKeyConfigured).toBe(true)
      expect(data.settings.llmApiKeyEncrypted).toBeUndefined()
    })

    it('returns llmApiKeyConfigured=false when key is null', async () => {
      vi.mocked(requireAuth).mockResolvedValue(memberCtx)
      vi.mocked(isAdmin).mockReturnValue(false)

      const rowWithNoKey = { ...mockSettingsRow, llmApiKeyEncrypted: null }
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([rowWithNoKey])),
          })),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const response = await GET()
      const data = await response.json()

      expect(data.settings.llmApiKeyConfigured).toBe(false)
    })

    it('returns default settings when no settings row exists', async () => {
      vi.mocked(requireAuth).mockResolvedValue(memberCtx)
      vi.mocked(isAdmin).mockReturnValue(false)

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as unknown as ReturnType<typeof db.select>)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings.llmProvider).toBe('claude')
      expect(data.settings.llmApiKeyConfigured).toBe(false)
      expect(data.settings.confidenceThreshold).toBe(0.7)
      expect(data.settings.autoLearnEnabled).toBe(true)
    })

    it('returns 401 when unauthenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(
        new (AuthError as unknown as new (msg: string, code: number) => Error)(
          'Authentication required',
          401
        )
      )

      const response = await GET()
      expect(response.status).toBe(401)
    })
  })

  describe('PATCH /api/settings', () => {
    it('admin can update llmProvider', async () => {
      vi.mocked(requireAuth).mockResolvedValue(adminCtx)
      vi.mocked(isAdmin).mockReturnValue(true)

      const updatedRow = { ...mockSettingsRow, llmProvider: 'openai' }
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([updatedRow])),
          })),
        })),
      } as unknown as ReturnType<typeof db.insert>)

      const request = createMockRequest('PATCH', undefined, { llmProvider: 'openai' })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings.llmProvider).toBe('openai')
    })

    it('admin can update llmApiKey (stored encrypted, not returned)', async () => {
      vi.mocked(requireAuth).mockResolvedValue(adminCtx)
      vi.mocked(isAdmin).mockReturnValue(true)

      const updatedRow = { ...mockSettingsRow, llmApiKeyEncrypted: 'enc:sk-ant-new-key' }
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([updatedRow])),
          })),
        })),
      } as unknown as ReturnType<typeof db.insert>)

      const request = createMockRequest('PATCH', undefined, { llmApiKey: 'sk-ant-new-key' })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.settings.llmApiKeyConfigured).toBe(true)
      expect(data.settings.llmApiKeyEncrypted).toBeUndefined()
      expect(data.settings.llmApiKey).toBeUndefined()
    })

    it('non-admin gets 403', async () => {
      vi.mocked(requireAuth).mockResolvedValue(memberCtx)
      vi.mocked(isAdmin).mockReturnValue(false)

      const request = createMockRequest('PATCH', undefined, { llmProvider: 'openai' })
      const response = await PATCH(request)

      expect(response.status).toBe(403)
    })

    it('returns 400 for invalid llmProvider value', async () => {
      vi.mocked(requireAuth).mockResolvedValue(adminCtx)
      vi.mocked(isAdmin).mockReturnValue(true)

      const request = createMockRequest('PATCH', undefined, { llmProvider: 'invalid-provider' })
      const response = await PATCH(request)

      expect(response.status).toBe(400)
    })

    it('returns 401 when unauthenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(
        new (AuthError as unknown as new (msg: string, code: number) => Error)(
          'Authentication required',
          401
        )
      )

      const request = createMockRequest('PATCH', undefined, { llmProvider: 'openai' })
      const response = await PATCH(request)

      expect(response.status).toBe(401)
    })
  })
})
