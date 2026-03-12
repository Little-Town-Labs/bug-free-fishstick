import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDbFrom = vi.fn()
const mockDbWhere = vi.fn()
const mockDbLimit = vi.fn()
const mockDbSet = vi.fn()
const mockDbUpdateWhere = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: mockDbFrom }),
    update: () => ({ set: mockDbSet }),
  },
}))

vi.mock('@/lib/db/schema/proposal-content-library', () => ({
  proposalContentLibrary: {
    id: 'id',
    organizationId: 'organizationId',
    embedding: 'embedding',
    category: 'category',
    name: 'name',
    content: 'content',
    createdBy: 'createdBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}))

vi.mock('@/lib/db/schema', () => ({
  tenantSettings: {
    organizationId: 'organizationId',
    openaiApiKeyEncrypted: 'openaiApiKeyEncrypted',
  },
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config, _trigger, handler) => handler),
    send: vi.fn(),
  },
}))

vi.mock('@/lib/services/encryption', () => ({
  decrypt: vi.fn((val: string) => val),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}))

import { generateContentLibraryEmbedding, batchEmbedContentLibrary } from '@/lib/inngest/functions/content-library-embedding'
import { inngest } from '@/lib/inngest/client'

// Helper to create a mock step object matching Inngest's step interface
function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  }
}

describe('generateContentLibraryEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The handler's step.run('fetch-entry-and-key') does two selects:
    // 1. select().from(proposalContentLibrary).where(...).limit(1) for the entry
    // 2. select({...}).from(tenantSettings).where(...).limit(1) for the API key
    // Since we use a single mockDbFrom -> mockDbWhere -> mockDbLimit chain,
    // we set up sequential calls.
    mockDbFrom.mockReturnValue({ where: mockDbWhere })
    mockDbWhere.mockReturnValue({ limit: mockDbLimit })
    mockDbSet.mockReturnValue({ where: mockDbUpdateWhere })
    mockDbUpdateWhere.mockResolvedValue([])
  })

  it('generates embedding for an existing entry', async () => {
    // First limit call: entry found; Second limit call: tenant settings (no encrypted key)
    mockDbLimit
      .mockResolvedValueOnce([{
        id: 'entry-1',
        category: 'Security',
        name: 'SOC2 Overview',
        content: 'Our SOC2 compliance...',
        organizationId: 'org1',
      }])
      .mockResolvedValueOnce([{ openaiApiKeyEncrypted: null }])

    // Set OPENAI_API_KEY so the handler doesn't bail
    process.env.OPENAI_API_KEY = 'test-key'

    const step = createMockStep()
    const handler = generateContentLibraryEmbedding as unknown as (args: {
      event: { data: { entryId: string; organizationId: string } }
      step: typeof step
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { entryId: 'entry-1', organizationId: 'org1' } },
      step,
    })

    expect(result).toEqual({ status: 'embedded', entryId: 'entry-1' })
    expect(mockDbSet).toHaveBeenCalledWith({ embedding: expect.any(Array) })
  })

  it('returns not_found for missing entry', async () => {
    // First limit call: no entry; Second limit call: tenant settings
    mockDbLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ openaiApiKeyEncrypted: null }])

    const step = createMockStep()
    const handler = generateContentLibraryEmbedding as unknown as (args: {
      event: { data: { entryId: string; organizationId: string } }
      step: typeof step
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { entryId: 'missing', organizationId: 'org1' } },
      step,
    })

    expect(result).toEqual({ status: 'not_found', entryId: 'missing' })
  })
})

describe('batchEmbedContentLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbFrom.mockReturnValue({ where: mockDbWhere })
  })

  it('fans out embedding events for unembedded entries', async () => {
    const unembedded = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]
    mockDbWhere.mockResolvedValueOnce(unembedded)

    const step = createMockStep()
    const handler = batchEmbedContentLibrary as unknown as (args: {
      event: { data: { organizationId: string } }
      step: typeof step
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { organizationId: 'org1' } },
      step,
    })

    expect(result).toEqual({ status: 'queued', count: 3 })
    expect(inngest.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'content-library/generate-embedding', data: { entryId: 'e1', organizationId: 'org1' } }),
      ])
    )
  })

  it('returns no_entries when all are already embedded', async () => {
    mockDbWhere.mockResolvedValueOnce([])

    const step = createMockStep()
    const handler = batchEmbedContentLibrary as unknown as (args: {
      event: { data: { organizationId: string } }
      step: typeof step
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { organizationId: 'org1' } },
      step,
    })

    expect(result).toEqual({ status: 'no_entries', count: 0 })
  })
})
