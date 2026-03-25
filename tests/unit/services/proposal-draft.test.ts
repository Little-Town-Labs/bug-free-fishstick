import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/ai/agents/proposal-question-generator', () => ({
  generateClarifyingQuestions: vi.fn(),
  MANDATORY_QUESTION_IDS: {
    DELIVERABLES: 'scope-deliverables',
    EXCLUSIONS: 'scope-exclusions',
    TIMELINE: 'scope-timeline',
  },
}))

vi.mock('@/lib/services/rate-card', () => ({
  getRateCard: vi.fn(),
}))

vi.mock('@/lib/services/vector-search', () => ({
  searchSimilar: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db/schema/knowledge-entries', () => ({
  knowledgeEntries: { organizationId: 'organization_id', type: 'type', title: 'title' },
}))

import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'
import { generateClarifyingQuestions } from '@/lib/ai/agents/proposal-question-generator'
import { getRateCard } from '@/lib/services/rate-card'
import { searchSimilar } from '@/lib/services/vector-search'
import {
  createDraft,
  submitAnswers,
  getDraft,
  listDrafts,
  updateDraftContent,
  cancelDraft,
} from '@/lib/services/proposal-draft'

const mockRfp = {
  id: 'rfp-1',
  organizationId: 'org-1',
  name: 'Test RFP',
  parsedStructure: {
    pages: 2,
    fields: [
      { id: 'f1', type: 'text', question: 'Company name?', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
    ],
  },
}

const mockQuestions = [
  { id: 'q1', question: 'What pricing model?', rfpSection: 'Pricing', answer: null },
  { id: 'q2', question: 'Any certifications?', rfpSection: 'Standards', answer: null },
  { id: 'q3', question: 'Preferred timeline?', rfpSection: 'Schedule', answer: null },
]

const mockDraft = {
  id: 'draft-1',
  rfpId: 'rfp-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  status: 'awaiting_answers' as const,
  clarifyingQuestions: mockQuestions,
  markdownContent: null,
  generationError: null,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function mockSelectReturns<T>(rows: T[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never)
}

function mockSelectMulti<T>(rows: T[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never)
}

function mockInsertReturns<T>(row: T) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([row]),
    }),
  } as never)
}

function mockUpdateReturns<T>(row: T) {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([row]),
      }),
    }),
  } as never)
}

describe('proposal-draft service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDraft', () => {
    it('should create a draft record with awaiting_answers status', async () => {
      // RFP select
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRfp]),
          }),
        }),
      } as never)
      vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: mockQuestions })
      mockInsertReturns(mockDraft)

      const result = await createDraft('rfp-1', 'org-1', 'user-1')

      expect(result.status).toBe('awaiting_answers')
      expect(db.insert).toHaveBeenCalled()
    })

    it('should throw if RFP has no parsedStructure', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockRfp, parsedStructure: null }]),
          }),
        }),
      } as never)

      await expect(createDraft('rfp-1', 'org-1', 'user-1')).rejects.toThrow(
        'RFP must be processed before generating a proposal'
      )
    })

    it('should throw if RFP does not belong to org', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      await expect(createDraft('rfp-1', 'wrong-org', 'user-1')).rejects.toThrow()
    })

    it('should call generateClarifyingQuestions with RFP fields and summary', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRfp]),
          }),
        }),
      } as never)
      vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: mockQuestions })
      mockInsertReturns(mockDraft)

      await createDraft('rfp-1', 'org-1', 'user-1')

      expect(generateClarifyingQuestions).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' })
      )
    })

    // -----------------------------------------------------------------------
    // Task 3.1–3.3: pricing model forwarding tests
    // -----------------------------------------------------------------------
    describe('createDraft — pricing model forwarding', () => {
      function mockRfpSelect() {
        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockRfp]),
            }),
          }),
        } as never)
      }

      it('passes pricingModel from rate card settings to generateClarifyingQuestions', async () => {
        mockRfpSelect()
        vi.mocked(getRateCard).mockResolvedValue({
          rateCard: null,
          proposalDefaults: {
            pricingModel: 'fixed_price',
            paymentTermsDays: 30,
            warrantyPeriodDays: 90,
          },
        })
        vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: mockQuestions })
        mockInsertReturns(mockDraft)

        await createDraft('rfp-1', 'org-1', 'user-1')

        expect(generateClarifyingQuestions).toHaveBeenCalledWith(
          expect.objectContaining({ pricingModel: 'fixed_price' })
        )
      })

      it('passes pricingModel: null when proposalDefaults is null', async () => {
        mockRfpSelect()
        vi.mocked(getRateCard).mockResolvedValue({
          rateCard: null,
          proposalDefaults: null,
        })
        vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: mockQuestions })
        mockInsertReturns(mockDraft)

        await createDraft('rfp-1', 'org-1', 'user-1')

        expect(generateClarifyingQuestions).toHaveBeenCalledWith(
          expect.objectContaining({ pricingModel: null })
        )
      })

      it('proceeds with pricingModel: null and does not throw when getRateCard rejects', async () => {
        mockRfpSelect()
        vi.mocked(getRateCard).mockRejectedValue(new Error('DB timeout'))
        vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: mockQuestions })
        mockInsertReturns(mockDraft)

        await expect(createDraft('rfp-1', 'org-1', 'user-1')).resolves.toBeDefined()

        expect(generateClarifyingQuestions).toHaveBeenCalledWith(
          expect.objectContaining({ pricingModel: null })
        )
      })
    })

    describe('createDraft — KB pre-fill for clarifying questions', () => {
      const mockRfpWithCustomer = { ...mockRfp, customerId: 'cust-1' }

      function mockRfpAndKbSelect(rfpOverride = mockRfpWithCustomer) {
        let selectCallCount = 0
        vi.mocked(db.select).mockImplementation(() => {
          selectCallCount++
          if (selectCallCount === 1) {
            // First select: RFP fetch
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([rfpOverride]),
                }),
              }),
            } as never
          }
          // Subsequent selects: KB topics/categories query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          } as never
        })
      }

      it('should attach suggestedAnswer when KB match has similarity >= 0.7', async () => {
        mockRfpAndKbSelect()
        vi.mocked(getRateCard).mockResolvedValue({ rateCard: null, proposalDefaults: null })

        const generatedQuestions = [
          { id: 'scope-deliverables', question: 'What deliverables?', rfpSection: 'Scope', answer: null },
          { id: 'q-extra', question: 'Security certifications?', rfpSection: 'Security', answer: null },
        ]
        vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: generatedQuestions })

        // KB returns a strong match for the non-mandatory question
        vi.mocked(searchSimilar).mockResolvedValue([
          {
            id: 'kb-99', organizationId: 'org-1', customerId: null, type: 'certification',
            title: 'ISO 27001 Certification', content: 'We hold ISO 27001 certification since 2020.',
            similarity: 0.85, tags: null, metadata: null, chunkIndex: null, totalChunks: null,
            sectionHeading: null, sourceEntryId: null, processingStatus: 'complete' as const,
            createdAt: new Date(), updatedAt: new Date(),
          },
        ])

        mockInsertReturns({ ...mockDraft, clarifyingQuestions: generatedQuestions })

        await createDraft('rfp-1', 'org-1', 'user-1')

        // Verify the insert was called with enriched questions
        const insertCall = vi.mocked(db.insert).mock.results[0]
        const valuesCall = (insertCall as { value: { values: ReturnType<typeof vi.fn> } }).value.values
        const insertedData = valuesCall.mock.calls[0]![0]
        const questions = insertedData.clarifyingQuestions

        // Mandatory question should NOT have suggestions
        const mandatory = questions.find((q: { id: string }) => q.id === 'scope-deliverables')
        expect(mandatory.suggestedAnswer).toBeUndefined()

        // Non-mandatory question should have KB suggestion
        const extra = questions.find((q: { id: string }) => q.id === 'q-extra')
        expect(extra.suggestedAnswer).toBe('We hold ISO 27001 certification since 2020.')
        expect(extra.kbSourceId).toBe('kb-99')
        expect(extra.kbSourceTitle).toBe('ISO 27001 Certification')
        expect(extra.suggestionConfidence).toBe(0.85)
      })

      it('should not attach suggestion when KB match similarity < 0.7', async () => {
        mockRfpAndKbSelect()
        vi.mocked(getRateCard).mockResolvedValue({ rateCard: null, proposalDefaults: null })

        const generatedQuestions = [
          { id: 'q-extra', question: 'What is your approach?', rfpSection: 'Technical', answer: null },
        ]
        vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: generatedQuestions })

        // KB returns a weak match
        vi.mocked(searchSimilar).mockResolvedValue([
          {
            id: 'kb-1', organizationId: 'org-1', customerId: null, type: 'company_doc',
            title: 'About Us', content: 'We are a tech company.',
            similarity: 0.5, tags: null, metadata: null, chunkIndex: null, totalChunks: null,
            sectionHeading: null, sourceEntryId: null, processingStatus: 'complete' as const,
            createdAt: new Date(), updatedAt: new Date(),
          },
        ])

        mockInsertReturns({ ...mockDraft, clarifyingQuestions: generatedQuestions })

        await createDraft('rfp-1', 'org-1', 'user-1')

        const insertCall = vi.mocked(db.insert).mock.results[0]
        const valuesCall = (insertCall as { value: { values: ReturnType<typeof vi.fn> } }).value.values
        const insertedData = valuesCall.mock.calls[0]![0]
        const q = insertedData.clarifyingQuestions[0]

        expect(q.suggestedAnswer).toBeUndefined()
        expect(q.kbSourceId).toBeUndefined()
      })

      it('should handle empty KB gracefully — questions still generated, no suggestions', async () => {
        mockRfpAndKbSelect()
        vi.mocked(getRateCard).mockResolvedValue({ rateCard: null, proposalDefaults: null })

        const generatedQuestions = [
          { id: 'q-1', question: 'Timeline?', rfpSection: 'Schedule', answer: null },
        ]
        vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: generatedQuestions })
        vi.mocked(searchSimilar).mockResolvedValue([])

        mockInsertReturns({ ...mockDraft, clarifyingQuestions: generatedQuestions })

        const result = await createDraft('rfp-1', 'org-1', 'user-1')

        expect(result).toBeDefined()
        expect(result.status).toBe('awaiting_answers')
      })

      it('should degrade gracefully when searchSimilar throws', async () => {
        mockRfpAndKbSelect()
        vi.mocked(getRateCard).mockResolvedValue({ rateCard: null, proposalDefaults: null })

        const generatedQuestions = [
          { id: 'q-1', question: 'Approach?', rfpSection: 'Technical', answer: null },
        ]
        vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: generatedQuestions })
        vi.mocked(searchSimilar).mockRejectedValue(new Error('Embedding API down'))

        mockInsertReturns({ ...mockDraft, clarifyingQuestions: generatedQuestions })

        // Should not throw — questions are still saved without suggestions
        const result = await createDraft('rfp-1', 'org-1', 'user-1')
        expect(result).toBeDefined()
      })
    })
  })

  describe('submitAnswers', () => {
    it('should transition draft status to generating', async () => {
      mockSelectReturns([mockDraft])
      mockUpdateReturns({ ...mockDraft, status: 'generating', clarifyingQuestions: mockQuestions.map((q, i) => ({ ...q, answer: `answer ${i}` })) })

      const answers = mockQuestions.map(q => ({ id: q.id, answer: `Answer for ${q.id}` }))
      const result = await submitAnswers('draft-1', 'org-1', answers)

      expect(result.status).toBe('generating')
    })

    it('should fire the proposal/generate Inngest event', async () => {
      mockSelectReturns([mockDraft])
      mockUpdateReturns({ ...mockDraft, status: 'generating' })

      const answers = mockQuestions.map(q => ({ id: q.id, answer: 'some answer' }))
      await submitAnswers('draft-1', 'org-1', answers)

      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'proposal/generate' })
      )
    })

    it('should throw if draft is not in awaiting_answers state', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'generating' }])
      // Simulate the atomic UPDATE returning 0 rows (status predicate didn't match)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      await expect(submitAnswers('draft-1', 'org-1', [])).rejects.toThrow()
    })

    it('should throw if draft does not belong to org', async () => {
      mockSelectReturns([])

      await expect(submitAnswers('draft-1', 'wrong-org', [])).rejects.toThrow()
    })

    it('should preserve KB suggestion fields when merging answers', async () => {
      const questionsWithSuggestions = [
        {
          id: 'q1', question: 'Pricing model?', rfpSection: 'Pricing', answer: null,
          suggestedAnswer: 'We offer time and materials pricing.',
          kbSourceId: 'kb-1', kbSourceTitle: 'Pricing Guide', suggestionConfidence: 0.85,
        },
        {
          id: 'q2', question: 'Certifications?', rfpSection: 'Standards', answer: null,
          suggestedAnswer: null, kbSourceId: null, kbSourceTitle: null, suggestionConfidence: null,
        },
      ]
      const draftWithSuggestions = { ...mockDraft, clarifyingQuestions: questionsWithSuggestions }

      mockSelectReturns([draftWithSuggestions])

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...draftWithSuggestions, status: 'generating' }]),
        }),
      })
      vi.mocked(db.update).mockReturnValue({ set: setMock } as never)

      await submitAnswers('draft-1', 'org-1', [
        { id: 'q1', answer: 'User override answer' },
        { id: 'q2', answer: 'Manual answer' },
      ])

      const updatedQuestions = setMock.mock.calls[0]![0].clarifyingQuestions
      // q1: user answer overwrites, but suggestion fields preserved
      expect(updatedQuestions[0].answer).toBe('User override answer')
      expect(updatedQuestions[0].suggestedAnswer).toBe('We offer time and materials pricing.')
      expect(updatedQuestions[0].kbSourceId).toBe('kb-1')
      expect(updatedQuestions[0].kbSourceTitle).toBe('Pricing Guide')
      expect(updatedQuestions[0].suggestionConfidence).toBe(0.85)
      // q2: no suggestions, answer set
      expect(updatedQuestions[1].answer).toBe('Manual answer')
      expect(updatedQuestions[1].suggestedAnswer).toBeNull()
    })
  })

  describe('updateDraftContent', () => {
    it('should store markdown and transition status to draft', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'generating' }])
      mockUpdateReturns({ ...mockDraft, status: 'draft', markdownContent: '# Proposal\n\nContent here.' })

      const result = await updateDraftContent('draft-1', 'org-1', '# Proposal\n\nContent here.')

      expect(result.status).toBe('draft')
      expect(result.markdownContent).toBeTruthy()
    })
  })

  describe('updateDraftContent with coverageReport', () => {
    it('includes coverageReport in DB set payload when 4th arg provided', async () => {
      const coverageReport = {
        coverageScore: 85,
        evaluatedAt: '2026-02-26T00:00:00.000Z',
        requirements: [
          { requirementId: 'r1', question: 'Q?', addressed: true, evidence: 'Yes', gap: null },
        ],
      }
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockDraft, status: 'draft', markdownContent: '# Test', coverageReport }]),
        }),
      })
      vi.mocked(db.update).mockReturnValue({ set: setMock } as never)

      await updateDraftContent('draft-1', 'org-1', '# Test', coverageReport)

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ coverageReport })
      )
    })

    it('does NOT include coverageReport in DB set payload when 4th arg omitted', async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockDraft, status: 'draft', markdownContent: '# Test' }]),
        }),
      })
      vi.mocked(db.update).mockReturnValue({ set: setMock } as never)

      await updateDraftContent('draft-1', 'org-1', '# Test')

      const payload = setMock.mock.calls[0]![0]
      expect(payload).not.toHaveProperty('coverageReport')
    })
  })

  describe('getDraft', () => {
    it('should return draft with org scope check', async () => {
      mockSelectReturns([mockDraft])

      const result = await getDraft('draft-1', 'org-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('draft-1')
    })

    it('should return null when draft belongs to different org', async () => {
      mockSelectReturns([])

      const result = await getDraft('draft-1', 'wrong-org')

      expect(result).toBeNull()
    })
  })

  describe('listDrafts', () => {
    it('should return all drafts for an RFP scoped to org', async () => {
      mockSelectMulti([mockDraft, { ...mockDraft, id: 'draft-2', version: 2 }])

      const result = await listDrafts('rfp-1', 'org-1')

      expect(result).toHaveLength(2)
    })

    it('should return empty array when no drafts exist', async () => {
      mockSelectMulti([])

      const result = await listDrafts('rfp-1', 'org-1')

      expect(result).toHaveLength(0)
    })
  })

  describe('cancelDraft', () => {
    it('should set status to error with Cancelled by user message when draft is generating', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'generating' }])
      mockUpdateReturns({ ...mockDraft, status: 'error', generationError: 'Cancelled by user' })

      const result = await cancelDraft('draft-1', 'org-1')

      expect(result.status).toBe('error')
      expect(result.generationError).toBe('Cancelled by user')
    })

    it('should throw if draft is not in generating state', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'draft' }])

      await expect(cancelDraft('draft-1', 'org-1')).rejects.toThrow()
    })
  })
})
