import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()
const mockDbUpdate = vi.fn()
const mockDbFrom = vi.fn()
const mockDbWhere = vi.fn()
const mockDbLimit = vi.fn()
const mockDbSet = vi.fn()
const mockDbValues = vi.fn()
const mockDbReturning = vi.fn()
const mockDbUpdateWhere = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: mockDbFrom }),
    insert: () => ({ values: mockDbValues }),
    update: () => ({ set: mockDbSet }),
  },
}))

vi.mock('@/lib/db/schema/knowledge-entries', () => ({
  knowledgeEntries: {
    id: 'id',
    organizationId: 'organizationId',
    processingStatus: 'processingStatus',
    totalChunks: 'totalChunks',
    chunkIndex: 'chunkIndex',
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config, _trigger, handler) => handler),
    send: vi.fn(),
  },
}))

vi.mock('@/lib/services/document-chunker', () => ({
  chunkDocument: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))

import { chunkDocumentFunction } from '@/lib/inngest/functions/chunk-document'
import { chunkDocument } from '@/lib/services/document-chunker'
import { inngest } from '@/lib/inngest/client'

const mockEntry = {
  id: 'entry-1',
  organizationId: 'org-1',
  type: 'company_doc',
  title: 'Large Document',
  content: 'A'.repeat(10000),
  processingStatus: 'pending',
}

describe('chunkDocumentFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbFrom.mockReturnValue({ where: mockDbWhere })
    mockDbWhere.mockReturnValue({ limit: mockDbLimit })
    mockDbSet.mockReturnValue({ where: mockDbUpdateWhere })
    mockDbUpdateWhere.mockResolvedValue([])
    mockDbValues.mockReturnValue({ returning: mockDbReturning })
  })

  it('creates child entries for multi-chunk documents', async () => {
    mockDbLimit.mockResolvedValueOnce([mockEntry])
    vi.mocked(chunkDocument).mockReturnValue([
      { content: 'Chunk 1', sectionHeading: 'Intro', chunkIndex: 0, totalChunks: 2 },
      { content: 'Chunk 2', sectionHeading: 'Body', chunkIndex: 1, totalChunks: 2 },
    ])
    mockDbReturning.mockResolvedValueOnce([{ id: 'child-1' }])
    mockDbReturning.mockResolvedValueOnce([{ id: 'child-2' }])

    const handler = chunkDocumentFunction as unknown as (args: {
      event: { data: { knowledgeEntryId: string; organizationId: string; customerId?: string } }
      step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> }
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { knowledgeEntryId: 'entry-1', organizationId: 'org-1' } },
      step: { run: (_name: string, fn: () => Promise<unknown>) => fn() },
    })

    expect(result).toEqual({
      parentId: 'entry-1',
      chunkCount: 2,
      childIds: ['child-1', 'child-2'],
    })
    expect(inngest.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'rfp/generate-embeddings' }),
      ])
    )
  })

  it('skips chunking for single-chunk documents', async () => {
    mockDbLimit.mockResolvedValueOnce([mockEntry])
    vi.mocked(chunkDocument).mockReturnValue([
      { content: mockEntry.content, sectionHeading: null, chunkIndex: 0, totalChunks: 1 },
    ])

    const handler = chunkDocumentFunction as unknown as (args: {
      event: { data: { knowledgeEntryId: string; organizationId: string } }
      step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> }
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { knowledgeEntryId: 'entry-1', organizationId: 'org-1' } },
      step: { run: (_name: string, fn: () => Promise<unknown>) => fn() },
    })

    expect(result).toEqual({
      parentId: 'entry-1',
      chunkCount: 1,
      childIds: [],
    })
    // Should not fan out embeddings for single chunk
    expect(inngest.send).not.toHaveBeenCalled()
  })
})
