import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()
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

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config, _trigger, handler) => handler),
    send: vi.fn(),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}))

import { generateContentLibraryEmbedding, batchEmbedContentLibrary } from '@/lib/inngest/functions/content-library-embedding'
import { inngest } from '@/lib/inngest/client'

describe('generateContentLibraryEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbFrom.mockReturnValue({ where: mockDbWhere })
    mockDbWhere.mockReturnValue({ limit: mockDbLimit })
    mockDbSet.mockReturnValue({ where: mockDbUpdateWhere })
    mockDbUpdateWhere.mockResolvedValue([])
  })

  it('generates embedding for an existing entry', async () => {
    mockDbLimit.mockResolvedValueOnce([{
      id: 'entry-1',
      category: 'Security',
      name: 'SOC2 Overview',
      content: 'Our SOC2 compliance...',
      organizationId: 'org1',
    }])

    const handler = generateContentLibraryEmbedding as unknown as (args: { event: { data: { entryId: string; organizationId: string } } }) => Promise<unknown>
    const result = await handler({
      event: { data: { entryId: 'entry-1', organizationId: 'org1' } },
    })

    expect(result).toEqual({ status: 'embedded', entryId: 'entry-1' })
    expect(mockDbSet).toHaveBeenCalledWith({ embedding: expect.any(Array) })
  })

  it('returns not_found for missing entry', async () => {
    mockDbLimit.mockResolvedValueOnce([])

    const handler = generateContentLibraryEmbedding as unknown as (args: { event: { data: { entryId: string; organizationId: string } } }) => Promise<unknown>
    const result = await handler({
      event: { data: { entryId: 'missing', organizationId: 'org1' } },
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
    // find-unembedded step returns entries, fan-out step sends events
    mockDbWhere.mockResolvedValueOnce(unembedded)

    const handler = batchEmbedContentLibrary as unknown as (args: {
      event: { data: { organizationId: string } }
      step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> }
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { organizationId: 'org1' } },
      step: { run: (_name: string, fn: () => Promise<unknown>) => fn() },
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

    const handler = batchEmbedContentLibrary as unknown as (args: {
      event: { data: { organizationId: string } }
      step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> }
    }) => Promise<unknown>

    const result = await handler({
      event: { data: { organizationId: 'org1' } },
      step: { run: (_name: string, fn: () => Promise<unknown>) => fn() },
    })

    expect(result).toEqual({ status: 'no_entries', count: 0 })
  })
})
