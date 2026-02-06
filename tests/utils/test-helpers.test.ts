import { describe, it, expect } from 'vitest'
import {
  createMockNextRequest,
  parseResponse,
  createMockAuthContext,
} from './test-helpers'

describe('test-helpers', () => {
  describe('createMockNextRequest', () => {
    it('creates a GET request with default options', () => {
      const req = createMockNextRequest('/api/rfps')
      expect(req.method).toBe('GET')
      expect(req.url).toBe('http://localhost:3000/api/rfps')
    })

    it('creates a POST request with JSON body', async () => {
      const body = { title: 'Test RFP' }
      const req = createMockNextRequest('/api/rfps', {
        method: 'POST',
        body,
      })
      expect(req.method).toBe('POST')
      const parsed = await req.json()
      expect(parsed).toEqual(body)
    })

    it('appends search params', () => {
      const req = createMockNextRequest('/api/rfps', {
        searchParams: { status: 'draft', page: '1' },
      })
      expect(req.url).toContain('status=draft')
      expect(req.url).toContain('page=1')
    })

    it('accepts custom headers', () => {
      const req = createMockNextRequest('/api/rfps', {
        headers: { authorization: 'Bearer token123' },
      })
      expect(req.headers.get('authorization')).toBe('Bearer token123')
    })

    it('accepts full URLs', () => {
      const req = createMockNextRequest('https://example.com/api/test')
      expect(req.url).toBe('https://example.com/api/test')
    })
  })

  describe('parseResponse', () => {
    it('extracts status and JSON body from Response', async () => {
      const response = new Response(JSON.stringify({ id: '1', name: 'Test' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
      const { status, body } = await parseResponse<{ id: string; name: string }>(response)
      expect(status).toBe(201)
      expect(body).toEqual({ id: '1', name: 'Test' })
    })
  })

  describe('createMockAuthContext', () => {
    it('returns default auth values', () => {
      const auth = createMockAuthContext()
      expect(auth.userId).toBe('user_test123')
      expect(auth.orgId).toBe('org_test123')
      expect(auth.orgRole).toBe('org:admin')
    })

    it('allows overriding individual fields', () => {
      const auth = createMockAuthContext({ userId: 'user_custom', orgRole: 'org:member' })
      expect(auth.userId).toBe('user_custom')
      expect(auth.orgId).toBe('org_test123')
      expect(auth.orgRole).toBe('org:member')
    })
  })
})
