import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDbInsert = vi.fn()
const mockDbSelect = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbSelect(),
        }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        mockDbInsert(v)
        return { returning: () => Promise.resolve([v]) }
      },
    }),
  },
}))

vi.mock('@/lib/db/schema/learnings', () => ({
  learnings: {},
}))

vi.mock('@/lib/db/schema/rfp-responses', () => ({
  rfpResponses: { rfpId: 'rfp_id', fieldId: 'field_id' },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: (_config: unknown, _event: unknown, handler: (...args: unknown[]) => unknown) => handler,
  },
}))

// Import after mocks
import { captureLearning } from '@/lib/inngest/functions/capture-learning'

describe('capture-learning Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbSelect.mockResolvedValue([{
      question: 'What is your compliance framework?',
      responseText: 'We follow SOC2',
      fieldType: 'text',
      confidenceScore: 0.85,
    }])
  })

  const makeEvent = (type: 'accept' | 'edit' | 'reject', extra = {}) => ({
    data: {
      type,
      rfpId: 'rfp1',
      fieldId: 'f1',
      organizationId: 'org1',
      customerId: 'cust1',
      userId: 'user1',
      ...extra,
    },
  })

  it('creates accept_signal learning on accept', async () => {
    const handler = captureLearning as unknown as (args: { event: ReturnType<typeof makeEvent> }) => Promise<unknown>
    await handler({ event: makeEvent('accept') })

    expect(mockDbInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'accept_signal',
        organizationId: 'org1',
        customerId: 'cust1',
        fieldId: 'f1',
      })
    )
    const inserted = mockDbInsert.mock.calls[0]![0]
    expect(inserted.content).toContain('Accepted')
    expect(inserted.content).toContain('compliance framework')
  })

  it('creates edit_correction learning on edit', async () => {
    const handler = captureLearning as unknown as (args: { event: ReturnType<typeof makeEvent> }) => Promise<unknown>
    await handler({
      event: makeEvent('edit', { originalText: 'We follow SOC2', correctedText: 'We follow SOC2 Type II and HIPAA' }),
    })

    expect(mockDbInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'edit_correction',
      })
    )
    const inserted = mockDbInsert.mock.calls[0]![0]
    expect(inserted.content).toContain('Corrected')
    expect(inserted.content).toContain('SOC2 Type II and HIPAA')
  })

  it('creates reject_signal learning on reject', async () => {
    const handler = captureLearning as unknown as (args: { event: ReturnType<typeof makeEvent> }) => Promise<unknown>
    await handler({ event: makeEvent('reject') })

    expect(mockDbInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'reject_signal',
      })
    )
    const inserted = mockDbInsert.mock.calls[0]![0]
    expect(inserted.content).toContain('Rejected')
  })
})
