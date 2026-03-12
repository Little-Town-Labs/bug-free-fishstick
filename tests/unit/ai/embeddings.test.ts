import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateEmbedding, generateEmbeddings, EMBEDDING_DIMENSIONS } from '@/lib/ai/embeddings'

// Mock AI SDK modules
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(),
}))

vi.mock('ai', () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
}))

import { createOpenAI } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'

describe('Embedding Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.OPENAI_API_KEY
  })

  describe('generateEmbedding', () => {
    it('should generate embedding vector of correct dimensions', async () => {
      const mockEmbedding = new Array(1536).fill(0).map((_, i) => i * 0.001)
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embed).mockResolvedValue({ embedding: mockEmbedding } as never)

      const text = 'Test document content for embedding generation'
      const result = await generateEmbedding(text)

      expect(result).toHaveLength(EMBEDDING_DIMENSIONS)
      expect(result).toEqual(mockEmbedding)
      expect(embed).toHaveBeenCalledWith({
        model: mockEmbeddingModel,
        value: text,
      })
    })

    it('should use OpenAI embedding model text-embedding-ada-002', async () => {
      const mockEmbedding = new Array(1536).fill(0)
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embed).mockResolvedValue({ embedding: mockEmbedding } as never)

      await generateEmbedding('test text')

      expect(mockOpenAI.embedding).toHaveBeenCalledWith('text-embedding-ada-002')
    })

    it('should use provided API key when given', async () => {
      const mockEmbedding = new Array(1536).fill(0)
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embed).mockResolvedValue({ embedding: mockEmbedding } as never)

      await generateEmbedding('test text', 'custom-api-key')

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'custom-api-key',
      })
    })

    it('should use environment variable when no API key provided', async () => {
      process.env.OPENAI_API_KEY = 'env-openai-key'
      const mockEmbedding = new Array(1536).fill(0)
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embed).mockResolvedValue({ embedding: mockEmbedding } as never)

      await generateEmbedding('test text')

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'env-openai-key',
      })
    })

    it('should handle empty text', async () => {
      const mockEmbedding = new Array(1536).fill(0)
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embed).mockResolvedValue({ embedding: mockEmbedding } as never)

      const result = await generateEmbedding('')

      expect(result).toHaveLength(EMBEDDING_DIMENSIONS)
      expect(embed).toHaveBeenCalledWith({
        model: mockEmbeddingModel,
        value: '',
      })
    })
  })

  describe('generateEmbeddings', () => {
    it('should generate embeddings for batch of texts', async () => {
      const mockEmbeddings = [
        new Array(1536).fill(0).map((_, i) => i * 0.001),
        new Array(1536).fill(0).map((_, i) => i * 0.002),
        new Array(1536).fill(0).map((_, i) => i * 0.003),
      ]
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embedMany).mockResolvedValue({ embeddings: mockEmbeddings } as never)

      const texts = [
        'First document content',
        'Second document content',
        'Third document content',
      ]
      const results = await generateEmbeddings(texts)

      expect(results).toHaveLength(3)
      expect(results[0]).toHaveLength(EMBEDDING_DIMENSIONS)
      expect(results[1]).toHaveLength(EMBEDDING_DIMENSIONS)
      expect(results[2]).toHaveLength(EMBEDDING_DIMENSIONS)
      expect(embedMany).toHaveBeenCalledWith({
        model: mockEmbeddingModel,
        values: texts,
      })
    })

    it('should return empty array for empty input', async () => {
      const result = await generateEmbeddings([])

      expect(result).toEqual([])
      expect(embedMany).not.toHaveBeenCalled()
    })

    it('should use provided API key for batch generation', async () => {
      const mockEmbeddings = [new Array(1536).fill(0)]
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embedMany).mockResolvedValue({ embeddings: mockEmbeddings } as never)

      await generateEmbeddings(['test text'], 'custom-batch-key')

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'custom-batch-key',
      })
    })

    it('should handle single text in batch', async () => {
      const mockEmbeddings = [new Array(1536).fill(0)]
      const mockEmbeddingModel = { type: 'embedding-model' }
      const mockOpenAI = {
        embedding: vi.fn(() => mockEmbeddingModel),
      }
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)
      vi.mocked(embedMany).mockResolvedValue({ embeddings: mockEmbeddings } as never)

      const result = await generateEmbeddings(['single text'])

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveLength(EMBEDDING_DIMENSIONS)
    })
  })

  describe('EMBEDDING_DIMENSIONS', () => {
    it('should export correct dimension constant', () => {
      expect(EMBEDDING_DIMENSIONS).toBe(1536)
    })
  })
})
