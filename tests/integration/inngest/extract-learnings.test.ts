import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModelForOrg: vi.fn(),
}))

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(
      (_config: unknown, _eventConfig: unknown, handler: unknown) => handler
    ),
  },
}))

import { db } from '@/lib/db'
import { getLanguageModelForOrg } from '@/lib/ai/providers'
import { generateObject } from 'ai'
import { extractLearnings } from '@/lib/inngest/functions/extract-learnings'

function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  }
}

function createMockEvent(data: Record<string, unknown>) {
  return { data, name: 'rfp/extract-learnings' }
}

describe('extractLearnings Inngest function', () => {
  const orgId = 'org_123'
  const rfpId = 'rfp-456'

  const mockRfp = {
    id: rfpId,
    organizationId: orgId,
    customerId: 'cust-789',
    name: 'Test RFP',
    status: 'approved',
  }

  const mockResponses = [
    {
      id: 'resp-1',
      rfpId,
      question: 'What is your approach?',
      responseText: 'Our approach is comprehensive.',
    },
    {
      id: 'resp-2',
      rfpId,
      question: 'What is your pricing?',
      responseText: null, // no response, should be filtered
    },
  ]

  const mockModel = { id: 'claude-3-haiku', provider: 'anthropic' }
  const mockLearningsRow = {
    id: 'learn-001',
    organizationId: orgId,
    customerId: 'cust-789',
    content: 'Focus on comprehensive approaches',
    sourceType: 'rfp_approval',
    createdBy: 'system',
    sourceMetadata: { rfpId },
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // DB: select chain - limit resolves to rfp on first call, where resolves to responses on second
    let selectCallCount = 0
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++
      const callIndex = selectCallCount
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          if (callIndex === 1) {
            // First select: rfps query with .limit()
            return {
              limit: vi.fn().mockResolvedValue([mockRfp]),
            }
          }
          // Second select: rfpResponses query (no limit)
          return Promise.resolve(mockResponses)
        }),
      } as never
    })

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockLearningsRow]),
      }),
    } as never)

    vi.mocked(getLanguageModelForOrg).mockResolvedValue(mockModel as never)
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        learnings: [
          { insight: 'Focus on comprehensive approaches' },
          { insight: 'Pricing transparency is important' },
        ],
      },
    } as never)
  })

  it('fetches RFP data and approved responses', async () => {
    const step = createMockStep()
    const event = createMockEvent({ rfpId, organizationId: orgId })

    await (extractLearnings as unknown as (ctx: unknown) => Promise<unknown>)({
      event,
      step,
    })

    expect(db.select).toHaveBeenCalled()
  })

  it('calls generateObject to extract learnings', async () => {
    const step = createMockStep()
    const event = createMockEvent({ rfpId, organizationId: orgId })

    await (extractLearnings as unknown as (ctx: unknown) => Promise<unknown>)({
      event,
      step,
    })

    expect(getLanguageModelForOrg).toHaveBeenCalledWith(orgId)
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.anything(),
        prompt: expect.stringContaining('RFP'),
      })
    )
  })

  it('inserts learning records with sourceType rfp_approval', async () => {
    const step = createMockStep()
    const event = createMockEvent({ rfpId, organizationId: orgId })

    await (extractLearnings as unknown as (ctx: unknown) => Promise<unknown>)({
      event,
      step,
    })

    expect(db.insert).toHaveBeenCalled()
    // The values() call is chained off insert() — verify insert was called
    const insertMock = vi.mocked(db.insert)
    expect(insertMock).toHaveBeenCalled()
    // Verify via the returned mock's values call
    const valuesCall = (insertMock.mock.results[0]?.value as { values: ReturnType<typeof vi.fn> })?.values
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'rfp_approval' })
    )
  })

  it('returns count of learnings saved', async () => {
    const step = createMockStep()
    const event = createMockEvent({ rfpId, organizationId: orgId })

    const result = await (extractLearnings as unknown as (ctx: unknown) => Promise<unknown>)({
      event,
      step,
    })

    expect(result).toEqual(
      expect.objectContaining({
        rfpId,
        learningsSaved: expect.any(Number),
      })
    )
  })
})
