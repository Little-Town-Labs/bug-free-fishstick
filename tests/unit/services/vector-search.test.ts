import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to declare mocks that can be used in vi.mock factory
const { selectMock, fromMock, whereMock, orderByMock, limitMock } = vi.hoisted(() => {
  const limitMock = vi.fn()
  const orderByMock = vi.fn(() => ({ limit: limitMock }))
  const whereMock = vi.fn(() => ({ orderBy: orderByMock, limit: limitMock }))
  const fromMock = vi.fn(() => ({ where: whereMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))
  return { selectMock, fromMock, whereMock, orderByMock, limitMock }
})

vi.mock('@/lib/db', () => ({
  db: {
    select: selectMock,
  },
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn(),
}))

import { searchSimilar } from '@/lib/services/vector-search'
import { db } from '@/lib/db'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { createMockKnowledgeEntry } from '../../factories/index'

describe('Vector Search Service', () => {
  const customerId = '00000000-0000-4000-8000-000000000001'
  const organizationId = 'org_test123'
  const mockQuery = 'What are your security certifications?'
  const mockEmbedding = new Array(1536).fill(0).map((_, i) => i * 0.001)

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the chain for each test
    limitMock.mockResolvedValue([])
    orderByMock.mockReturnValue({ limit: limitMock })
    whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock })
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })
  })

  describe('searchSimilar', () => {
    it('should return entries with similarity scores sorted by relevance', async () => {
      const mockEntry1 = createMockKnowledgeEntry({ customerId, organizationId })
      const mockEntry2 = createMockKnowledgeEntry({ customerId, organizationId })

      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)
      limitMock.mockResolvedValue([
        { ...mockEntry1, embedding: undefined, similarity: 0.95 },
        { ...mockEntry2, embedding: undefined, similarity: 0.82 },
      ])

      const results = await searchSimilar(mockQuery, customerId, organizationId)

      expect(results).toHaveLength(2)
      expect(results[0]!.similarity).toBe(0.95)
      expect(results[1]!.similarity).toBe(0.82)
      expect(results[0]!.similarity).toBeGreaterThan(results[1]!.similarity)
    })

    it('should call generateEmbedding with the query text', async () => {
      const mockEntry = createMockKnowledgeEntry({ customerId, organizationId })

      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)
      limitMock.mockResolvedValue([
        { ...mockEntry, embedding: undefined, similarity: 0.9 },
      ])

      await searchSimilar(mockQuery, customerId, organizationId)

      expect(generateEmbedding).toHaveBeenCalledWith(mockQuery)
      expect(generateEmbedding).toHaveBeenCalledTimes(1)
    })

    it('should filter by customerId and organizationId', async () => {
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)
      limitMock.mockResolvedValue([])

      await searchSimilar(mockQuery, customerId, organizationId)

      expect(whereMock).toHaveBeenCalled()
      expect(selectMock).toHaveBeenCalled()
      expect(fromMock).toHaveBeenCalled()
    })

    it('should respect the limit parameter (default 10)', async () => {
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)
      limitMock.mockResolvedValue([])

      await searchSimilar(mockQuery, customerId, organizationId)

      expect(limitMock).toHaveBeenCalledWith(10)
    })

    it('should use the provided limit when specified', async () => {
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)
      limitMock.mockResolvedValue([])

      await searchSimilar(mockQuery, customerId, organizationId, 5)

      expect(limitMock).toHaveBeenCalledWith(5)
    })

    it('should return empty array when no entries match', async () => {
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)
      limitMock.mockResolvedValue([])

      const results = await searchSimilar(mockQuery, customerId, organizationId)

      expect(results).toEqual([])
      expect(Array.isArray(results)).toBe(true)
    })

    it('should throw error when embedding generation fails', async () => {
      const embeddingError = new Error('OpenAI API error: rate limit exceeded')
      vi.mocked(generateEmbedding).mockRejectedValue(embeddingError)

      await expect(
        searchSimilar(mockQuery, customerId, organizationId)
      ).rejects.toThrow('OpenAI API error: rate limit exceeded')

      expect(selectMock).not.toHaveBeenCalled()
    })

    it('should exclude the embedding column from results', async () => {
      const mockEntry = createMockKnowledgeEntry({ customerId, organizationId })

      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)
      // Build result without embedding property (select excludes it)
      const { embedding: _removed, ...entryWithoutEmbedding } = mockEntry
      limitMock.mockResolvedValue([
        { ...entryWithoutEmbedding, similarity: 0.91 },
      ])

      const results = await searchSimilar(mockQuery, customerId, organizationId)

      expect(results).toHaveLength(1)
      expect(results[0]).not.toHaveProperty('embedding')
      expect(results[0]).toHaveProperty('similarity')
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('content')
      expect(results[0]).toHaveProperty('title')
    })
  })
})
