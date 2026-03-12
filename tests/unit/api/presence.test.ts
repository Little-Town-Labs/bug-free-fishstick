import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockScan, mockMget, mockSet: mockKvSet } = vi.hoisted(() => {
  const mockScan = vi.fn()
  const mockMget = vi.fn()
  const mockSet = vi.fn()
  return { mockScan, mockMget, mockSet }
})

vi.mock('@/lib/storage/kv', () => ({
  getRedis: vi.fn(() => ({
    scan: mockScan,
    mget: mockMget,
    set: mockKvSet,
  })),
}))

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    statusCode: number
    constructor(msg: string, code: number) {
      super(msg)
      this.statusCode = code
    }
  },
}))

import { GET, POST } from '@/app/api/rfps/[rfpId]/presence/route'
import { requireAuth, AuthError } from '@/lib/utils/auth'

const mockRequireAuth = vi.mocked(requireAuth)

describe('GET /api/rfps/[rfpId]/presence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' })
    // Default: empty scan result
    mockScan.mockResolvedValue([0, []])
  })

  it('returns empty viewers when no presence keys found', async () => {
    mockScan.mockResolvedValue([0, []])

    const req = new Request('http://localhost/api/rfps/rfp-1/presence')
    const res = await GET(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { viewers: unknown[] }
    expect(body.viewers).toEqual([])
  })

  it('returns viewers from KV scan results', async () => {
    const entry = { userId: 'user-2', displayName: 'Alice', avatarUrl: null, color: '#6366f1', lastSeenAt: '2024-01-01T00:00:00Z' }
    mockScan.mockResolvedValue([0, ['presence:rfp-1:user-2']])
    mockMget.mockResolvedValue([entry])

    const req = new Request('http://localhost/api/rfps/rfp-1/presence')
    const res = await GET(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { viewers: typeof entry[] }
    expect(body.viewers).toHaveLength(1)
    expect(body.viewers[0]!.userId).toBe('user-2')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Unauthorized', 401))

    const req = new Request('http://localhost/api/rfps/rfp-1/presence')
    const res = await GET(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/rfps/[rfpId]/presence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1', orgRole: 'org:member' })
    mockKvSet.mockResolvedValue('OK')
  })

  it('stores presence with 30-second TTL', async () => {
    const req = new Request('http://localhost/api/rfps/rfp-1/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Alice', color: '#ec4899' }),
    })

    const res = await POST(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)

    expect(mockKvSet).toHaveBeenCalledOnce()
    const [key, , options] = mockKvSet.mock.calls[0] as [string, string, { ex: number }]
    expect(key).toBe('presence:rfp-1:user-1')
    expect(options.ex).toBe(30)
  })

  it('uses auth.userId as displayName fallback', async () => {
    const req = new Request('http://localhost/api/rfps/rfp-1/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    await POST(req as never, { params: Promise.resolve({ rfpId: 'rfp-1' }) })

    const [, valueStr] = mockKvSet.mock.calls[0] as [string, string]
    const value = JSON.parse(valueStr) as { displayName: string }
    expect(value.displayName).toBe('user-1')
  })
})
