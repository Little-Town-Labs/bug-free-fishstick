import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

// Mock svix
vi.mock('svix', () => ({
  Webhook: vi.fn(),
}))

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
}))

// Mock schema
vi.mock('@/lib/db/schema/tenant-settings', () => ({
  tenantSettings: { organizationId: 'organization_id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}))

import { Webhook } from 'svix'
import { db } from '@/lib/db'

describe('Clerk Webhook Handler', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, CLERK_WEBHOOK_SECRET: 'test-webhook-secret' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  function createWebhookRequest(body: object, headers: Record<string, string> = {}) {
    const defaultHeaders: Record<string, string> = {
      'svix-id': 'msg_test123',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,test-signature',
      'content-type': 'application/json',
      ...headers,
    }

    return new NextRequest('http://localhost:3000/api/webhooks/clerk', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: defaultHeaders,
    })
  }

  function mockWebhookVerify(payload: object) {
    const mockVerify = vi.fn().mockReturnValue(payload)
    vi.mocked(Webhook).mockImplementation(() => ({ verify: mockVerify }) as unknown as InstanceType<typeof Webhook>)
    return mockVerify
  }

  describe('webhook signature verification', () => {
    it('returns 500 when CLERK_WEBHOOK_SECRET is not set', async () => {
      delete process.env.CLERK_WEBHOOK_SECRET

      // Re-import to get fresh module with updated env
      vi.resetModules()
      const { POST } = await import('@/app/api/webhooks/clerk/route')

      const req = createWebhookRequest({ type: 'organization.created', data: { id: 'org_123' } })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Webhook secret not configured')
    })

    it('returns 400 when svix headers are missing', async () => {
      vi.resetModules()
      const { POST } = await import('@/app/api/webhooks/clerk/route')

      const req = new NextRequest('http://localhost:3000/api/webhooks/clerk', {
        method: 'POST',
        body: JSON.stringify({ type: 'test' }),
        headers: { 'content-type': 'application/json' },
      })

      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Missing svix headers')
    })

    it('returns 400 when signature verification fails', async () => {
      vi.mocked(Webhook).mockImplementation(() => ({
        verify: vi.fn().mockImplementation(() => {
          throw new Error('Invalid signature')
        }),
      }) as unknown as InstanceType<typeof Webhook>)

      vi.resetModules()
      const { POST } = await import('@/app/api/webhooks/clerk/route')

      const req = createWebhookRequest({ type: 'organization.created', data: { id: 'org_123' } })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid webhook signature')
    })
  })

  describe('organization.created', () => {
    it('creates tenant settings for new organization', async () => {
      const payload = { type: 'organization.created', data: { id: 'org_new123' } }
      mockWebhookVerify(payload)

      vi.resetModules()
      const { POST } = await import('@/app/api/webhooks/clerk/route')

      const req = createWebhookRequest(payload)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.received).toBe(true)
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('organization.deleted', () => {
    it('deletes tenant settings for removed organization', async () => {
      const payload = { type: 'organization.deleted', data: { id: 'org_del456' } }
      mockWebhookVerify(payload)

      vi.resetModules()
      const { POST } = await import('@/app/api/webhooks/clerk/route')

      const req = createWebhookRequest(payload)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.received).toBe(true)
      expect(db.delete).toHaveBeenCalled()
    })
  })

  describe('unknown event types', () => {
    it('returns 200 for unhandled event types', async () => {
      const payload = { type: 'user.created', data: { id: 'user_123' } }
      mockWebhookVerify(payload)

      vi.resetModules()
      const { POST } = await import('@/app/api/webhooks/clerk/route')

      const req = createWebhookRequest(payload)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.received).toBe(true)
    })
  })

  describe('error handling', () => {
    it('returns 500 when database operation fails', async () => {
      const payload = { type: 'organization.created', data: { id: 'org_err789' } }
      mockWebhookVerify(payload)

      // Make db.insert throw
      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      vi.resetModules()
      const { POST } = await import('@/app/api/webhooks/clerk/route')

      const req = createWebhookRequest(payload)
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Webhook processing failed')
    })
  })
})
