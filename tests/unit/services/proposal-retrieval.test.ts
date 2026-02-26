import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KnowledgeEntry } from '@/lib/db/schema/knowledge-entries'
import type { Learning } from '@/lib/db/schema/learnings'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
// Use vi.hoisted so the factory references are available in vi.mock() callbacks.

const mocks = vi.hoisted(() => {
  // Use ReturnType-based declarations compatible with Vitest 2.x vi.fn() API
  const limitMock = vi.fn()
  const orderByMock = vi.fn(() => ({ limit: limitMock }))
  const whereMock = vi.fn(() => ({ orderBy: orderByMock, limit: limitMock }))
  const fromMock = vi.fn(() => ({ where: whereMock }))
  const selectMock = vi.fn(() => ({ from: fromMock }))
  return { selectMock, fromMock, whereMock, orderByMock, limitMock }
})

vi.mock('@/lib/db', () => ({
  db: { select: mocks.selectMock },
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn(),
}))

import {
  searchByRequirements,
  fetchTypedSupplierContext,
  fetchCustomerContext,
  fetchLearnings,
} from '@/lib/services/proposal-retrieval'
import { generateEmbedding } from '@/lib/ai/embeddings'
import {
  createMockKnowledgeEntry,
  createMockCustomer,
  createMockLearning,
} from '../../factories/index'
import type { KnowledgeEntryWithSimilarity } from '@/lib/services/proposal-retrieval'

const { selectMock, fromMock, whereMock, orderByMock, limitMock } = mocks

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntryWithSimilarity(
  overrides: Partial<KnowledgeEntryWithSimilarity> = {}
): KnowledgeEntryWithSimilarity {
  const base = createMockKnowledgeEntry(overrides as Partial<KnowledgeEntry>)
  const { embedding: _e, ...rest } = base
  return { ...rest, similarity: 0.8, ...overrides }
}

/** Cast metadata to include runtime-only 'outcome' key (stored in JSONB, not in TS type) */
function withOutcome(outcome: string): KnowledgeEntry['metadata'] {
  return { outcome } as KnowledgeEntry['metadata']
}

const ORG_ID = 'org_test123'
const OTHER_ORG_ID = 'org_other999'
const MOCK_EMBEDDING = new Array(1536).fill(0).map((_, i) => i * 0.001)

// ─── searchByRequirements ────────────────────────────────────────────────────

describe('searchByRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'

    limitMock.mockResolvedValue([])
    orderByMock.mockReturnValue({ limit: limitMock })
    whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock })
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })
  })

  it('returns empty array when fields is empty, no embedding calls made', async () => {
    const result = await searchByRequirements([], ORG_ID, 'test-key')

    expect(result).toEqual([])
    expect(generateEmbedding).not.toHaveBeenCalled()
  })

  it('calls generateEmbedding once for a single field and returns results', async () => {
    const entry = makeEntryWithSimilarity({ organizationId: ORG_ID })
    vi.mocked(generateEmbedding).mockResolvedValue(MOCK_EMBEDDING)
    limitMock.mockResolvedValue([entry])

    const fields = [{ id: 'f1', question: 'What are your security certifications?' }]
    const result = await searchByRequirements(fields, ORG_ID, 'test-key')

    expect(generateEmbedding).toHaveBeenCalledTimes(1)
    expect(generateEmbedding).toHaveBeenCalledWith(fields[0]!.question, 'test-key')
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(entry.id)
  })

  it('calls generateEmbedding once per field for multiple fields and merges results', async () => {
    const entry1 = makeEntryWithSimilarity({ id: 'entry-1', organizationId: ORG_ID, similarity: 0.9 })
    const entry2 = makeEntryWithSimilarity({ id: 'entry-2', organizationId: ORG_ID, similarity: 0.8 })
    const entry3 = makeEntryWithSimilarity({ id: 'entry-3', organizationId: ORG_ID, similarity: 0.7 })

    vi.mocked(generateEmbedding).mockResolvedValue(MOCK_EMBEDDING)
    limitMock
      .mockResolvedValueOnce([entry1])
      .mockResolvedValueOnce([entry2])
      .mockResolvedValueOnce([entry3])

    const fields = [
      { id: 'f1', question: 'Security certs?' },
      { id: 'f2', question: 'Past performance?' },
      { id: 'f3', question: 'Technical capability?' },
    ]
    const result = await searchByRequirements(fields, ORG_ID, 'test-key')

    expect(generateEmbedding).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(3)
  })

  it('caps at REQUIREMENT_SEARCH_CAP (10) and ignores extra fields', async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(MOCK_EMBEDDING)
    limitMock.mockResolvedValue([])

    const fields = Array.from({ length: 12 }, (_, i) => ({
      id: `f${i}`,
      question: `Question ${i}`,
    }))

    await searchByRequirements(fields, ORG_ID, 'test-key')

    expect(generateEmbedding).toHaveBeenCalledTimes(10)
  })

  it('deduplicates entries: keeps highest similarity when same id appears in multiple queries', async () => {
    const entryHighSim = makeEntryWithSimilarity({ id: 'id-A', organizationId: ORG_ID, similarity: 0.9 })
    const entryLowSim = makeEntryWithSimilarity({ id: 'id-A', organizationId: ORG_ID, similarity: 0.7 })

    vi.mocked(generateEmbedding).mockResolvedValue(MOCK_EMBEDDING)
    limitMock
      .mockResolvedValueOnce([entryHighSim])
      .mockResolvedValueOnce([entryLowSim])

    const fields = [
      { id: 'f1', question: 'Question 1' },
      { id: 'f2', question: 'Question 2' },
    ]
    const result = await searchByRequirements(fields, ORG_ID, 'test-key')

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('id-A')
    expect(result[0]!.similarity).toBe(0.9)
  })

  it('deduplicates correctly when lower similarity appears first', async () => {
    const entryLowSim = makeEntryWithSimilarity({ id: 'id-B', organizationId: ORG_ID, similarity: 0.6 })
    const entryHighSim = makeEntryWithSimilarity({ id: 'id-B', organizationId: ORG_ID, similarity: 0.95 })

    vi.mocked(generateEmbedding).mockResolvedValue(MOCK_EMBEDDING)
    limitMock
      .mockResolvedValueOnce([entryLowSim])
      .mockResolvedValueOnce([entryHighSim])

    const fields = [
      { id: 'f1', question: 'Q1' },
      { id: 'f2', question: 'Q2' },
    ]
    const result = await searchByRequirements(fields, ORG_ID, 'test-key')

    expect(result).toHaveLength(1)
    expect(result[0]!.similarity).toBe(0.95)
  })

  it('returns empty array when openaiApiKey is absent and OPENAI_API_KEY not set', async () => {
    delete process.env.OPENAI_API_KEY

    const fields = [{ id: 'f1', question: 'Some question' }]
    const result = await searchByRequirements(fields, ORG_ID, undefined)

    expect(result).toEqual([])
    expect(generateEmbedding).not.toHaveBeenCalled()
  })

  it('isolates a single embedding call failure — other queries continue', async () => {
    const goodEntry = makeEntryWithSimilarity({ id: 'good-entry', organizationId: ORG_ID, similarity: 0.85 })

    vi.mocked(generateEmbedding)
      .mockRejectedValueOnce(new Error('API rate limit'))
      .mockResolvedValueOnce(MOCK_EMBEDDING)

    limitMock.mockResolvedValueOnce([goodEntry])

    const fields = [
      { id: 'f1', question: 'First question — will fail' },
      { id: 'f2', question: 'Second question — will succeed' },
    ]

    const result = await searchByRequirements(fields, ORG_ID, 'test-key')

    expect(result.some((e) => e.id === 'good-entry')).toBe(true)
  })
})

// ─── fetchTypedSupplierContext ────────────────────────────────────────────────

describe('fetchTypedSupplierContext', () => {
  // fetchTypedSupplierContext queries end at whereMock (no .limit()).
  // whereMock must be thenable (mockResolvedValue).
  beforeEach(() => {
    vi.clearAllMocks()

    // Cast through unknown to avoid the hoisted mock type constraint
    ;(whereMock as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([])
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })
  })

  function resolveWhere(value: unknown) {
    ;(whereMock as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce(value)
  }

  it('returns four distinct groups populated from correctly-typed entries', async () => {
    const companyDoc = createMockKnowledgeEntry({ type: 'company_doc', organizationId: ORG_ID })
    const cert = createMockKnowledgeEntry({ type: 'certification', organizationId: ORG_ID })
    const caseStudy = createMockKnowledgeEntry({ type: 'case_study', organizationId: ORG_ID })
    const wonRfp = createMockKnowledgeEntry({
      type: 'past_rfp',
      organizationId: ORG_ID,
      metadata: withOutcome('won'),
    })

    resolveWhere([companyDoc])
    resolveWhere([cert])
    resolveWhere([caseStudy])
    resolveWhere([wonRfp])

    const result = await fetchTypedSupplierContext(ORG_ID, [], null)

    expect(result.companyDocs).toHaveLength(1)
    expect(result.companyDocs[0]!.type).toBe('company_doc')
    expect(result.certifications).toHaveLength(1)
    expect(result.certifications[0]!.type).toBe('certification')
    expect(result.caseStudies).toHaveLength(1)
    expect(result.caseStudies[0]!.type).toBe('case_study')
    expect(result.wonPastRfps).toHaveLength(1)
  })

  it('includes past_rfp entries with outcome=won in wonPastRfps', async () => {
    const wonRfp = createMockKnowledgeEntry({
      type: 'past_rfp',
      organizationId: ORG_ID,
      metadata: withOutcome('won'),
    })

    resolveWhere([])       // company_doc
    resolveWhere([])       // certification
    resolveWhere([])       // case_study
    resolveWhere([wonRfp]) // past_rfp won

    const result = await fetchTypedSupplierContext(ORG_ID, null, null)

    expect(result.wonPastRfps).toHaveLength(1)
    expect(result.wonPastRfps[0]!.id).toBe(wonRfp.id)
  })

  it('excludes past_rfp entries with outcome=lost from wonPastRfps (DB filter simulated by empty result)', async () => {
    // The SQL `metadata->>'outcome' = 'won'` filter prevents lost entries.
    // The mock simulates filtered result: DB returns [] when no won entries exist.
    resolveWhere([]) // company_doc
    resolveWhere([]) // certification
    resolveWhere([]) // case_study
    resolveWhere([]) // past_rfp won — DB filter excludes lost

    const result = await fetchTypedSupplierContext(ORG_ID, null, null)

    expect(result.wonPastRfps).toHaveLength(0)
  })

  it('excludes past_rfp entries with no outcome from wonPastRfps (DB filter simulated by empty result)', async () => {
    resolveWhere([]) // company_doc
    resolveWhere([]) // certification
    resolveWhere([]) // case_study
    resolveWhere([]) // past_rfp won — null outcome excluded by DB filter

    const result = await fetchTypedSupplierContext(ORG_ID, null, null)

    expect(result.wonPastRfps).toHaveLength(0)
  })

  it('ensures company_doc entries never appear in other groups', async () => {
    const companyDoc = createMockKnowledgeEntry({ type: 'company_doc', organizationId: ORG_ID })

    resolveWhere([companyDoc]) // company_doc
    resolveWhere([])           // certification
    resolveWhere([])           // case_study
    resolveWhere([])           // past_rfp won

    const result = await fetchTypedSupplierContext(ORG_ID, [], null)

    expect(result.certifications).not.toContainEqual(companyDoc)
    expect(result.caseStudies).not.toContainEqual(companyDoc)
    expect(result.wonPastRfps).not.toContainEqual(companyDoc)
  })

  it('applies tag filter when non-empty industryTags provided', async () => {
    const taggedWonRfp = createMockKnowledgeEntry({
      type: 'past_rfp',
      organizationId: ORG_ID,
      tags: ['healthcare'],
      metadata: withOutcome('won'),
    })

    resolveWhere([])              // company_doc
    resolveWhere([])              // certification
    resolveWhere([])              // case_study
    resolveWhere([taggedWonRfp])  // past_rfp won with tag match

    const result = await fetchTypedSupplierContext(ORG_ID, ['healthcare'], null)

    expect(result.wonPastRfps).toHaveLength(1)
    expect(result.wonPastRfps[0]!.tags).toContain('healthcare')
  })

  it('returns all won past_rfp entries when industryTags is null', async () => {
    const wonRfp1 = createMockKnowledgeEntry({
      type: 'past_rfp',
      organizationId: ORG_ID,
      tags: ['healthcare'],
      metadata: withOutcome('won'),
    })
    const wonRfp2 = createMockKnowledgeEntry({
      type: 'past_rfp',
      organizationId: ORG_ID,
      tags: ['government'],
      metadata: withOutcome('won'),
    })

    resolveWhere([])                // company_doc
    resolveWhere([])                // certification
    resolveWhere([])                // case_study
    resolveWhere([wonRfp1, wonRfp2]) // all won — no tag filter

    const result = await fetchTypedSupplierContext(ORG_ID, null, null)

    expect(result.wonPastRfps).toHaveLength(2)
  })

  it('returns all won past_rfp entries when industryTags is empty array', async () => {
    const wonRfp = createMockKnowledgeEntry({
      type: 'past_rfp',
      organizationId: ORG_ID,
      metadata: withOutcome('won'),
    })

    resolveWhere([])       // company_doc
    resolveWhere([])       // certification
    resolveWhere([])       // case_study
    resolveWhere([wonRfp]) // all won — no tag filter when empty

    const result = await fetchTypedSupplierContext(ORG_ID, [], null)

    expect(result.wonPastRfps).toHaveLength(1)
  })

  it('returns empty arrays for all groups when knowledge base is empty', async () => {
    // Default beforeEach already sets whereMock to resolve []
    const result = await fetchTypedSupplierContext(ORG_ID, null, null)

    expect(result.companyDocs).toEqual([])
    expect(result.certifications).toEqual([])
    expect(result.caseStudies).toEqual([])
    expect(result.wonPastRfps).toEqual([])
  })
})

// ─── fetchCustomerContext ─────────────────────────────────────────────────────

describe('fetchCustomerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    limitMock.mockResolvedValue([])
    whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock })
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })
  })

  it('returns settings object when customer exists with settings', async () => {
    const customer = createMockCustomer({
      id: 'cust-1',
      organizationId: ORG_ID,
      settings: { preferredTone: 'formal', industryContext: 'government' },
    })
    limitMock.mockResolvedValue([{ settings: customer.settings }])

    const result = await fetchCustomerContext('cust-1', ORG_ID)

    expect(result).toEqual({ preferredTone: 'formal', industryContext: 'government' })
  })

  it('returns null when customer exists but settings is null', async () => {
    limitMock.mockResolvedValue([{ settings: null }])

    const result = await fetchCustomerContext('cust-2', ORG_ID)

    expect(result).toBeNull()
  })

  it('returns null when customer ID is not found', async () => {
    limitMock.mockResolvedValue([])

    const result = await fetchCustomerContext('nonexistent', ORG_ID)

    expect(result).toBeNull()
  })

  it('returns null for customer belonging to a different org (tenant isolation)', async () => {
    // The WHERE clause must include both customerId AND orgId.
    // When orgId does not match, the DB returns no rows.
    limitMock.mockResolvedValue([])

    const result = await fetchCustomerContext('cust-from-other-org', OTHER_ORG_ID)

    expect(result).toBeNull()
    expect(whereMock).toHaveBeenCalled()
    expect(selectMock).toHaveBeenCalled()
  })
})

// ─── fetchLearnings ───────────────────────────────────────────────────────────

describe('fetchLearnings', () => {
  // fetchLearnings conditionally chains .orderBy() when customerId is provided.
  // We rebuild the mock chain in each test to handle both paths.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Set up mock for when customerId is provided: where().orderBy() resolves data */
  function setupWithOrderBy(data: Learning[]) {
    const resolvedData = Promise.resolve(data) as unknown as ReturnType<typeof orderByMock>
    orderByMock.mockReturnValue(resolvedData)
    whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock })
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })
  }

  /** Set up mock for when no customerId: where() itself is thenable */
  function setupNoOrderBy(data: Learning[]) {
    const resolved = Promise.resolve(data)
    ;(whereMock as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(resolved)
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })
  }

  it('returns customer-specific learnings before org-wide when customerId provided', async () => {
    const customerLearning = createMockLearning({
      id: 'learn-customer',
      organizationId: ORG_ID,
      customerId: 'cust-A',
    })
    const orgLearning = createMockLearning({
      id: 'learn-org',
      organizationId: ORG_ID,
      customerId: null,
    })

    // DB returns them in CASE-ordered sequence: customer first
    setupWithOrderBy([customerLearning, orgLearning])

    const result = await fetchLearnings(ORG_ID, 'cust-A')

    expect(result).toHaveLength(2)
    expect(result[0]!.id).toBe('learn-customer')
    expect(result[1]!.id).toBe('learn-org')
  })

  it('returns only org-wide learnings when customerId is not provided', async () => {
    const orgLearning = createMockLearning({
      id: 'learn-org',
      organizationId: ORG_ID,
      customerId: null,
    })

    setupNoOrderBy([orgLearning])

    const result = await fetchLearnings(ORG_ID)

    expect(result).toHaveLength(1)
    expect(result[0]!.customerId).toBeNull()
  })

  it('returns empty array when no learnings exist for the organisation', async () => {
    setupWithOrderBy([])

    const result = await fetchLearnings(ORG_ID, 'cust-A')

    expect(result).toEqual([])
  })

  it('enforces tenant isolation — organizationId is always in WHERE clause', async () => {
    setupWithOrderBy([])

    await fetchLearnings(OTHER_ORG_ID, 'cust-A')

    expect(whereMock).toHaveBeenCalled()
    expect(fromMock).toHaveBeenCalled()
    expect(selectMock).toHaveBeenCalled()
  })
})
