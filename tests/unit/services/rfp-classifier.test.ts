import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: mockFrom }),
  },
}))

import { suggestAssignee } from '@/lib/services/rfp-classifier'

describe('suggestAssignee', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue([])
  })

  it('returns null for empty memberIds', async () => {
    const result = await suggestAssignee('org-1', 'technical', [])
    expect(result).toBeNull()
  })

  it('returns the only member when single memberIds', async () => {
    const result = await suggestAssignee('org-1', 'technical', ['user-1'])
    expect(result).toBe('user-1')
  })

  it('prefers member with more type experience and less workload', async () => {
    // user-a: 3 past same-type (score: 6), 0 in-progress (score: 6)
    // user-b: 0 past same-type (score: 0), 2 in-progress (score: -6)
    mockLimit
      .mockResolvedValueOnce([{ id: '1' }, { id: '2' }, { id: '3' }]) // user-a past type
      .mockResolvedValueOnce([]) // user-a in-progress
      .mockResolvedValueOnce([]) // user-b past type
      .mockResolvedValueOnce([{ id: '4' }, { id: '5' }]) // user-b in-progress

    const result = await suggestAssignee('org-1', 'technical', ['user-a', 'user-b'])
    expect(result).toBe('user-a')
  })

  it('skips type scoring when rfpType is null', async () => {
    // With null type, only workload matters
    // user-a: 1 in-progress (score: -3), user-b: 0 in-progress (score: 0)
    mockLimit
      .mockResolvedValueOnce([{ id: '1' }]) // user-a in-progress
      .mockResolvedValueOnce([]) // user-b in-progress

    const result = await suggestAssignee('org-1', null, ['user-a', 'user-b'])
    expect(result).toBe('user-b')
  })
})
