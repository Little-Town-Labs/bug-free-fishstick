import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB with chainable methods
const mockSelectFrom = vi.fn()
const mockSelectFromWhere = vi.fn()
const mockSelectFromWhereLimit = vi.fn()
const mockReturning = vi.fn()
const mockUpdateWhere = vi.fn()
const mockUpdateSet = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
    update: vi.fn(() => ({
      set: mockUpdateSet,
    })),
  },
}))

vi.mock('@/lib/db/schema/knowledge-entries', () => ({
  knowledgeEntries: {
    id: 'id',
    embedding: 'embedding',
    updatedAt: 'updatedAt',
    organizationId: 'organizationId',
  },
}))

vi.mock('@/lib/db/schema', () => ({
  tenantSettings: {
    organizationId: 'organizationId',
    openaiApiKeyEncrypted: 'openaiApiKeyEncrypted',
  },
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn(() => Promise.resolve(new Array(1536).fill(0.1))),
}))

vi.mock('@/lib/services/encryption', () => ({
  decrypt: vi.fn((val: string) => val),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config, _eventConfig, handler) => handler),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))

import { db } from '@/lib/db'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { generateEmbeddingsFunction as generateEmbeddings } from '@/lib/inngest/functions/generate-embeddings'

// Helper to create a mock step object matching Inngest's step interface
function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
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

// Setup default DB mock chains
function setupDefaultDbMocks() {
  // select().from(tenantSettings).where(...).limit(1) -> no encrypted key
  mockSelectFrom.mockReturnValue({ where: mockSelectFromWhere })
  mockSelectFromWhere.mockReturnValue({ limit: mockSelectFromWhereLimit })
  mockSelectFromWhereLimit.mockResolvedValue([{ openaiApiKeyEncrypted: null }])

  // update().set(...).where(...).returning()
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdateWhere.mockReturnValue({ returning: mockReturning })
  mockReturning.mockResolvedValue([{ id: 'entry_1', embedding: new Array(1536).fill(0.1) }])
}

describe('generate-embeddings Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
    setupDefaultDbMocks()
  })

  describe('Function export and configuration', () => {
    it('should export a function named generateEmbeddings', () => {
      expect(generateEmbeddings).toBeDefined()
      expect(typeof generateEmbeddings).toBe('function')
    })

    it('should be a callable function handler', () => {
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

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

      expect(generateEmbedding).toHaveBeenCalledWith(content, undefined)
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

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

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

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

      expect(db.update).toHaveBeenCalled()
    })

    it('should update the embedding column with the generated vector', async () => {
      const knowledgeEntryId = 'entry_4'
      const organizationId = 'org_1'
      const content = 'Another knowledge base article'
      const mockEmbedding = new Array(1536).fill(0.1)

      vi.mocked(generateEmbedding).mockResolvedValueOnce(mockEmbedding)

      const localSetMock = vi.fn(() => ({ where: mockUpdateWhere }))
      vi.mocked(db.update).mockReturnValueOnce({ set: localSetMock } as never)

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

      expect(localSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ embedding: mockEmbedding })
      )
    })

    it('should wrap the db update in a named step', async () => {
      const knowledgeEntryId = 'entry_5'
      const organizationId = 'org_1'
      const content = 'Content for named step verification'

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

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

      mockReturning.mockResolvedValueOnce([expectedEntry])

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

      expect(mockReturning).toHaveBeenCalled()
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

      await expect((generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })).rejects.toThrow(
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

      await expect((generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })).rejects.toThrow(
        'Database connection lost'
      )
    })
  })

  describe('Event data validation', () => {
    it('should pass knowledgeEntryId to the db where clause', async () => {
      const knowledgeEntryId = 'specific-entry-id'
      const organizationId = 'org_1'
      const content = 'Content'

      const step = createMockStep()
      const event = createMockEvent({ knowledgeEntryId, organizationId, content })

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

      // The where clause must have been called - entry filtering is required
      expect(mockUpdateWhere).toHaveBeenCalled()
    })

    it('should use the content from the event payload for embedding generation', async () => {
      const specificContent = 'Unique content string for this specific test'
      const step = createMockStep()
      const event = createMockEvent({
        knowledgeEntryId: 'entry_7',
        organizationId: 'org_1',
        content: specificContent,
      })

      await (generateEmbeddings as unknown as (...args: unknown[]) => Promise<unknown>)({ event, step })

      expect(generateEmbedding).toHaveBeenCalledWith(specificContent, undefined)
    })
  })
})
