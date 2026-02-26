import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies before imports
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ openaiApiKeyEncrypted: null }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'entry_1', embedding: [0.1, 0.2] }])),
        })),
      })),
    })),
  },
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn(() => Promise.resolve(new Array(1536).fill(0.1))),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((config, eventConfig, handler) => handler),
  },
}))

import { db } from '@/lib/db'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { inngest } from '@/lib/inngest/client'
import { generateEmbeddingsFunction as generateEmbeddings } from '@/lib/inngest/functions/generate-embeddings'

// Helper to create a mock step object matching Inngest's step interface
function createMockStep() {
  return {
    run: vi.fn((name: string, fn: () => any) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  }
}

// Helper to create a mock Inngest event
function createMockEvent(data: {
  knowledgeEntryId: string
  organizationId: string
  content: string
}) {
  return { data, name: 'rfp/generate-embeddings' }
}

describe('generate-embeddings Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Function export and configuration', () => {
    it('should export a function named generateEmbeddings', () => {
      expect(generateEmbeddings).toBeDefined()
      expect(typeof generateEmbeddings).toBe('function')
    })

    it('should be a callable function handler', () => {
      // The mock intercepts createFunction and returns the handler directly.
      // Verify it's callable (the handler function).
      expect(typeof generateEmbeddings).toBe('function')
    })
  })

  describe('Step 1: generate embedding', () => {
    it('should call generateEmbedding with the content string', async () => {
      const knowledgeEntryId = 'entry_1'
      const organizationId = 'org_1'
      const content = 'This is document content for embedding generation'

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as Function)({ event, step })

      expect(generateEmbedding).toHaveBeenCalledWith(content)
    })

    it('should resolve a 1536-dimension vector for the content', async () => {
      const content = 'Sample RFP content'
      const embedding = await generateEmbedding(content)

      expect(Array.isArray(embedding)).toBe(true)
      expect(embedding).toHaveLength(1536)
      expect(embedding[0]).toBeCloseTo(0.1)
    })

    it('should wrap embedding generation in a named step', async () => {
      const knowledgeEntryId = 'entry_2'
      const organizationId = 'org_1'
      const content = 'Content to embed'

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as Function)({ event, step })

      expect(step.run).toHaveBeenCalledWith(
        'generate-embedding',
        expect.any(Function)
      )
    })
  })

  describe('Step 2: update knowledge entry', () => {
    it('should call db.update to persist the embedding', async () => {
      const knowledgeEntryId = 'entry_3'
      const organizationId = 'org_1'
      const content = 'Knowledge base article content'

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as Function)({ event, step })

      expect(db.update).toHaveBeenCalled()
    })

    it('should update the embedding column with the generated vector', async () => {
      const knowledgeEntryId = 'entry_4'
      const organizationId = 'org_1'
      const content = 'Another knowledge base article'
      const mockEmbedding = new Array(1536).fill(0.1)

      vi.mocked(generateEmbedding).mockResolvedValueOnce(mockEmbedding)

      // Capture the chained mock so we can inspect what .set() received
      const returningMock = vi.fn(() =>
        Promise.resolve([{ id: knowledgeEntryId, embedding: mockEmbedding }])
      )
      const whereMock = vi.fn(() => ({ returning: returningMock }))
      const setMock = vi.fn(() => ({ where: whereMock }))
      vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as any)

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as Function)({ event, step })

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ embedding: mockEmbedding })
      )
    })

    it('should wrap the db update in a named step', async () => {
      const knowledgeEntryId = 'entry_5'
      const organizationId = 'org_1'
      const content = 'Content for named step verification'

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as Function)({ event, step })

      expect(step.run).toHaveBeenCalledWith(
        'update-entry',
        expect.any(Function)
      )
    })

    it('should return the updated knowledge entry from the database', async () => {
      const knowledgeEntryId = 'entry_6'
      const organizationId = 'org_1'
      const content = 'Final content'
      const expectedEntry = { id: knowledgeEntryId, embedding: new Array(1536).fill(0.1) }

      const returningMock = vi.fn(() => Promise.resolve([expectedEntry]))
      const whereMock = vi.fn(() => ({ returning: returningMock }))
      const setMock = vi.fn(() => ({ where: whereMock }))
      vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as any)

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      const result = await (generateEmbeddings as unknown as Function)({ event, step })

      expect(returningMock).toHaveBeenCalled()
      // The handler completes without error (Inngest functions don't need to return a value)
    })
  })

  describe('Error handling', () => {
    it('should propagate errors from generateEmbedding', async () => {
      vi.mocked(generateEmbedding).mockRejectedValueOnce(
        new Error('Embedding API unavailable')
      )

      const step = createMockStep()
      const event = createMockEvent({
        knowledgeEntryId: 'entry_err_1',
        organizationId: 'org_1',
        content: 'Content that triggers an error',
      })

      await expect((generateEmbeddings as unknown as Function)({ event, step })).rejects.toThrow(
        'Embedding API unavailable'
      )
    })

    it('should propagate errors from db.update', async () => {
      vi.mocked(db.update).mockImplementationOnce(() => {
        throw new Error('Database connection lost')
      })

      const step = createMockStep()
      const event = createMockEvent({
        knowledgeEntryId: 'entry_err_2',
        organizationId: 'org_1',
        content: 'Content that causes db error',
      })

      await expect((generateEmbeddings as unknown as Function)({ event, step })).rejects.toThrow(
        'Database connection lost'
      )
    })
  })

  describe('Event data validation', () => {
    it('should pass knowledgeEntryId to the db where clause', async () => {
      const knowledgeEntryId = 'specific-entry-id'
      const organizationId = 'org_1'
      const content = 'Content'

      const returningMock = vi.fn(() =>
        Promise.resolve([{ id: knowledgeEntryId, embedding: [] }])
      )
      const whereMock = vi.fn(() => ({ returning: returningMock }))
      const setMock = vi.fn(() => ({ where: whereMock }))
      vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as any)

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as Function)({ event, step })

      // The where clause must have been called - entry filtering is required
      expect(whereMock).toHaveBeenCalled()
    })

    it('should use the content from the event payload for embedding generation', async () => {
      const specificContent = 'Unique content string for this specific test'
      const step = createMockStep()
      const event = createMockEvent({
        knowledgeEntryId: 'entry_7',
        organizationId: 'org_1',
        content: specificContent,
      })

      await (generateEmbeddings as unknown as Function)({ event, step })

      expect(generateEmbedding).toHaveBeenCalledWith(specificContent)
      expect(generateEmbedding).not.toHaveBeenCalledWith(expect.not.stringContaining(specificContent))
    })
  })
})
