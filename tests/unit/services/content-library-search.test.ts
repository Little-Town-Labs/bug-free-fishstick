import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build a chainable mock that tracks calls
let selectCallCount = 0
const mockResults: unknown[][] = []

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const idx = selectCallCount++
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockResults[idx] ?? [])),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(mockResults[idx] ?? [])),
            })),
          })),
        })),
      }
    }),
  },
}))

vi.mock('@/lib/db/schema/proposal-content-library', () => ({
  proposalContentLibrary: {
    id: 'id',
    organizationId: 'organizationId',
    category: 'category',
    name: 'name',
    content: 'content',
    createdBy: 'createdBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    embedding: 'embedding',
  },
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}))

vi.mock('drizzle-orm', () => {
  const sqlTag = (..._args: unknown[]) => ({ as: () => 'mock-aliased' })
  return {
    eq: vi.fn(),
    and: vi.fn(),
    isNotNull: vi.fn(),
    ilike: vi.fn(),
    sql: sqlTag,
  }
})

import { searchContentLibrary } from '@/lib/services/content-library-search'

describe('searchContentLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallCount = 0
    mockResults.length = 0
  })

  it('falls back to category search when no embeddings exist', async () => {
    // First select: check for embedded entries — empty
    mockResults[0] = []
    // Second select: fallback list
    mockResults[1] = [
      { id: '1', name: 'Entry 1', category: 'general', content: 'Content 1', organizationId: 'org1', createdBy: 'u1', createdAt: new Date(), updatedAt: new Date() },
    ]

    const results = await searchContentLibrary('test query', 'org1')
    expect(results).toHaveLength(1)
    expect(results[0]!.similarity).toBe(0)
  })

  it('uses vector search when embeddings exist', async () => {
    // First select: check for embedded entries — found
    mockResults[0] = [{ id: '1' }]
    // Second select: vector search results
    mockResults[1] = [
      { id: '1', name: 'Entry 1', category: 'general', content: 'Content 1', organizationId: 'org1', createdBy: 'u1', createdAt: new Date(), updatedAt: new Date(), similarity: 0.85 },
    ]

    const results = await searchContentLibrary('test query', 'org1')
    expect(results).toHaveLength(1)
    expect(results[0]!.similarity).toBe(0.85)
  })
})
