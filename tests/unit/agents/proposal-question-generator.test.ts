import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModelForOrg: vi.fn().mockReturnValue({ type: 'mock-model' }),
}))

import { generateObject } from 'ai'
import {
  generateClarifyingQuestions,
  buildMandatoryQuestions,
  MANDATORY_QUESTION_IDS,
} from '@/lib/ai/agents/proposal-question-generator'
import type { GenerateClarifyingQuestionsInput } from '@/lib/ai/agents/proposal-question-generator'

const mockRfpFields = [
  { id: 'f1', type: 'text' as const, question: 'What is your pricing model?', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
  { id: 'f2', type: 'paragraph' as const, question: 'Describe your security practices.', position: { page: 1, x: 0, y: 20, width: 100, height: 40 } },
  { id: 'f3', type: 'text' as const, question: 'Which certifications do you hold?', position: { page: 2, x: 0, y: 0, width: 100, height: 20 } },
]

const baseInput: GenerateClarifyingQuestionsInput = {
  rfpFields: mockRfpFields,
  rfpSummary: 'Government IT services RFP requiring pricing, security, and certification details.',
  knowledgeTopics: ['cloud hosting', 'ISO 27001'],
  contentLibraryCategories: ['Pricing', 'Standard'],
  organizationId: 'org-1',
}

describe('proposal-question-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateClarifyingQuestions', () => {
    describe('happy path', () => {
      it('should return between 3 and 10 clarifying questions', async () => {
        vi.mocked(generateObject).mockResolvedValue({
          object: {
            questions: [
              { id: 'q1', question: 'What is your preferred pricing model for this engagement?', rfpSection: 'Pricing' },
              { id: 'q2', question: 'Do you have ISO 27001 or SOC 2 certification?', rfpSection: 'Security' },
              { id: 'q3', question: 'What SLA terms apply for this contract?', rfpSection: 'Service Level' },
            ],
          },
        } as any)

        const result = await generateClarifyingQuestions(baseInput)

        expect(result.questions.length).toBeGreaterThanOrEqual(3)
        expect(result.questions.length).toBeLessThanOrEqual(10)
      })

      it('should return questions each with id, question, and rfpSection fields', async () => {
        vi.mocked(generateObject).mockResolvedValue({
          object: {
            questions: [
              { id: 'q1', question: 'What is your pricing model?', rfpSection: 'Section 4 — Pricing' },
            ],
          },
        } as any)

        const result = await generateClarifyingQuestions(baseInput)

        for (const q of result.questions) {
          expect(q).toHaveProperty('id')
          expect(q).toHaveProperty('question')
          expect(q).toHaveProperty('rfpSection')
          expect(typeof q.id).toBe('string')
          expect(typeof q.question).toBe('string')
          expect(typeof q.rfpSection).toBe('string')
        }
      })

      it('should return questions with null answer (not yet answered)', async () => {
        vi.mocked(generateObject).mockResolvedValue({
          object: {
            questions: [
              { id: 'q1', question: 'What pricing model?', rfpSection: 'Pricing' },
            ],
          },
        } as any)

        const result = await generateClarifyingQuestions(baseInput)

        for (const q of result.questions) {
          expect(q.answer).toBeNull()
        }
      })

      it('should incorporate knowledge topics and content library categories into prompt context', async () => {
        vi.mocked(generateObject).mockResolvedValue({
          object: {
            questions: [
              { id: 'q1', question: 'Question about cloud hosting?', rfpSection: 'Infrastructure' },
              { id: 'q2', question: 'Which pricing tier applies?', rfpSection: 'Pricing' },
              { id: 'q3', question: 'Can you confirm ISO 27001 scope?', rfpSection: 'Security' },
            ],
          },
        } as any)

        await generateClarifyingQuestions(baseInput)

        const callArgs = vi.mocked(generateObject).mock.calls[0]!
        const prompt = JSON.stringify(callArgs[0])
        expect(prompt).toContain('cloud hosting')
        expect(prompt).toContain('ISO 27001')
      })
    })

    describe('edge cases', () => {
      it('should handle empty rfpFields gracefully and still return 3–10 questions', async () => {
        vi.mocked(generateObject).mockResolvedValue({
          object: {
            questions: [
              { id: 'q1', question: 'What services are you proposing?', rfpSection: 'General' },
              { id: 'q2', question: 'What is the timeline?', rfpSection: 'General' },
              { id: 'q3', question: 'What is the budget range?', rfpSection: 'General' },
            ],
          },
        } as any)

        const result = await generateClarifyingQuestions({
          ...baseInput,
          rfpFields: [],
        })

        expect(result.questions.length).toBeGreaterThanOrEqual(3)
      })

      it('should handle empty knowledge topics and empty content library categories', async () => {
        vi.mocked(generateObject).mockResolvedValue({
          object: {
            questions: [
              { id: 'q1', question: 'What pricing applies?', rfpSection: 'Pricing' },
              { id: 'q2', question: 'What certifications?', rfpSection: 'Standards' },
              { id: 'q3', question: 'What is the delivery timeline?', rfpSection: 'Schedule' },
            ],
          },
        } as any)

        const result = await generateClarifyingQuestions({
          ...baseInput,
          knowledgeTopics: [],
          contentLibraryCategories: [],
        })

        expect(result.questions.length).toBeGreaterThanOrEqual(3)
      })

      it('should propagate LLM errors', async () => {
        vi.mocked(generateObject).mockRejectedValue(new Error('LLM timeout'))

        await expect(generateClarifyingQuestions(baseInput)).rejects.toThrow('LLM timeout')
      })
    })
  })

  // -------------------------------------------------------------------------
  // Task 1.1: buildMandatoryQuestions pure function
  // -------------------------------------------------------------------------
  describe('buildMandatoryQuestions', () => {
    it('returns exactly 3 questions for time_and_materials', () => {
      const result = buildMandatoryQuestions('time_and_materials')
      expect(result).toHaveLength(3)
    })

    it('returns exactly 3 questions for fixed_price', () => {
      const result = buildMandatoryQuestions('fixed_price')
      expect(result).toHaveLength(3)
    })

    it('returns exactly 3 questions for cost_plus', () => {
      const result = buildMandatoryQuestions('cost_plus')
      expect(result).toHaveLength(3)
    })

    it('returns exactly 3 questions when pricingModel is null (T&M fallback)', () => {
      const result = buildMandatoryQuestions(null)
      expect(result).toHaveLength(3)
    })

    it('scope-deliverables wording differs across T&M, fixed_price, cost_plus', () => {
      const tmQuestion = buildMandatoryQuestions('time_and_materials').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!
      const fpQuestion = buildMandatoryQuestions('fixed_price').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!
      const cpQuestion = buildMandatoryQuestions('cost_plus').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!

      expect(tmQuestion.question).not.toBe(fpQuestion.question)
      expect(tmQuestion.question).not.toBe(cpQuestion.question)
      expect(fpQuestion.question).not.toBe(cpQuestion.question)
    })

    it('scope-deliverables null wording matches T&M wording', () => {
      const tmQuestion = buildMandatoryQuestions('time_and_materials').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!
      const nullQuestion = buildMandatoryQuestions(null).find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!
      expect(nullQuestion.question).toBe(tmQuestion.question)
    })

    it('scope-exclusions wording is identical across all pricing models', () => {
      const models = ['time_and_materials', 'fixed_price', 'cost_plus', null] as const
      const wordings = models.map(
        (m) => buildMandatoryQuestions(m).find((q) => q.id === MANDATORY_QUESTION_IDS.EXCLUSIONS)!.question
      )
      expect(new Set(wordings).size).toBe(1)
    })

    it('scope-timeline wording is identical across all pricing models', () => {
      const models = ['time_and_materials', 'fixed_price', 'cost_plus', null] as const
      const wordings = models.map(
        (m) => buildMandatoryQuestions(m).find((q) => q.id === MANDATORY_QUESTION_IDS.TIMELINE)!.question
      )
      expect(new Set(wordings).size).toBe(1)
    })

    it('all questions have answer: null', () => {
      const result = buildMandatoryQuestions('time_and_materials')
      for (const q of result) {
        expect(q.answer).toBeNull()
      }
    })

    it('uses stable IDs from MANDATORY_QUESTION_IDS constants', () => {
      const result = buildMandatoryQuestions('fixed_price')
      const ids = result.map((q) => q.id)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.DELIVERABLES)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.EXCLUSIONS)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.TIMELINE)
    })

    it('T&M deliverables question asks about deliverables and estimated hours', () => {
      const q = buildMandatoryQuestions('time_and_materials').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!
      expect(q.question.toLowerCase()).toMatch(/deliverable|hours/i)
    })

    it('fixed_price deliverables question asks about budget or fixed price', () => {
      const q = buildMandatoryQuestions('fixed_price').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!
      expect(q.question.toLowerCase()).toMatch(/budget|fixed|price/i)
    })

    it('cost_plus deliverables question asks about direct costs and margin', () => {
      const q = buildMandatoryQuestions('cost_plus').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!
      expect(q.question.toLowerCase()).toMatch(/cost|margin/i)
    })
  })

  // -------------------------------------------------------------------------
  // Task 1.2: Mandatory IDs always present in generateClarifyingQuestions output
  // -------------------------------------------------------------------------
  describe('mandatory question injection — ID presence', () => {
    it('all three mandatory IDs present when pricingModel is time_and_materials', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'Q1', rfpSection: 'General' },
            { id: 'q2', question: 'Q2', rfpSection: 'General' },
            { id: 'q3', question: 'Q3', rfpSection: 'General' },
          ],
        },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'time_and_materials',
      })
      const ids = result.questions.map((q) => q.id)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.DELIVERABLES)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.EXCLUSIONS)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.TIMELINE)
    })

    it('all three mandatory IDs present when pricingModel is fixed_price', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'Q1', rfpSection: 'General' },
          ],
        },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'fixed_price',
      })
      const ids = result.questions.map((q) => q.id)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.DELIVERABLES)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.EXCLUSIONS)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.TIMELINE)
    })

    it('all three mandatory IDs present when pricingModel is cost_plus', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'Q1', rfpSection: 'General' },
          ],
        },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'cost_plus',
      })
      const ids = result.questions.map((q) => q.id)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.DELIVERABLES)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.EXCLUSIONS)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.TIMELINE)
    })

    it('all three mandatory IDs present when pricingModel is null', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'Q1', rfpSection: 'General' },
          ],
        },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: null,
      })
      const ids = result.questions.map((q) => q.id)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.DELIVERABLES)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.EXCLUSIONS)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.TIMELINE)
    })
  })

  // -------------------------------------------------------------------------
  // Task 1.3: Mandatory questions at front of output array
  // -------------------------------------------------------------------------
  describe('mandatory question injection — ordering', () => {
    it('mandatory questions are the first 3 elements in the result array', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'Q1', rfpSection: 'General' },
            { id: 'q2', question: 'Q2', rfpSection: 'General' },
            { id: 'q3', question: 'Q3', rfpSection: 'General' },
          ],
        },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'time_and_materials',
      })

      expect(result.questions[0]!.id).toBe(MANDATORY_QUESTION_IDS.DELIVERABLES)
      expect(result.questions[1]!.id).toBe(MANDATORY_QUESTION_IDS.EXCLUSIONS)
      expect(result.questions[2]!.id).toBe(MANDATORY_QUESTION_IDS.TIMELINE)
    })

    it('LLM-generated questions appear after mandatory questions (index >= 3)', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'Q1', rfpSection: 'General' },
            { id: 'q2', question: 'Q2', rfpSection: 'General' },
          ],
        },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'fixed_price',
      })

      const llmIds = ['q1', 'q2']
      for (let i = 3; i < result.questions.length; i++) {
        expect(llmIds).toContain(result.questions[i]!.id)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Task 1.4: LLM question count trimming and merge ceiling
  // -------------------------------------------------------------------------
  describe('mandatory question injection — count ceiling', () => {
    it('LLM returns 10 questions → trimmed to 7 → total result is 10', async () => {
      const tenQuestions = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i + 1}`,
        question: `Question ${i + 1}`,
        rfpSection: 'General',
      }))

      vi.mocked(generateObject).mockResolvedValue({
        object: { questions: tenQuestions },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'time_and_materials',
      })

      expect(result.questions.length).toBe(10)
      expect(result.questions[0]!.id).toBe(MANDATORY_QUESTION_IDS.DELIVERABLES)
    })

    it('LLM returns 3 questions → total result is 6', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'Q1', rfpSection: 'General' },
            { id: 'q2', question: 'Q2', rfpSection: 'General' },
            { id: 'q3', question: 'Q3', rfpSection: 'General' },
          ],
        },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'fixed_price',
      })

      expect(result.questions.length).toBe(6)
    })

    it('LLM returns 0 questions → total result is 3 (mandatory only)', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: { questions: [] },
      } as any)

      const result = await generateClarifyingQuestions({
        ...baseInput,
        pricingModel: 'cost_plus',
      })

      expect(result.questions.length).toBe(3)
      for (const q of result.questions) {
        expect(q.answer).toBeNull()
      }
    })
  })

  // -------------------------------------------------------------------------
  // Task 1.5: System prompt includes pricing model label and deduplication instruction
  // -------------------------------------------------------------------------
  describe('mandatory question injection — system prompt', () => {
    async function captureSystemPrompt(pricingModel: GenerateClarifyingQuestionsInput['pricingModel']): Promise<string> {
      vi.mocked(generateObject).mockResolvedValue({
        object: { questions: [{ id: 'q1', question: 'Q1', rfpSection: 'General' }] },
      } as any)
      await generateClarifyingQuestions({ ...baseInput, pricingModel })
      const callArgs = vi.mocked(generateObject).mock.calls[0]![0] as { system: string }
      return callArgs.system
    }

    it('system prompt includes "Time & Materials" label for time_and_materials model', async () => {
      const prompt = await captureSystemPrompt('time_and_materials')
      expect(prompt).toContain('Time & Materials')
    })

    it('system prompt includes "Fixed Price" label for fixed_price model', async () => {
      const prompt = await captureSystemPrompt('fixed_price')
      expect(prompt).toContain('Fixed Price')
    })

    it('system prompt includes "Cost-Plus" label for cost_plus model', async () => {
      const prompt = await captureSystemPrompt('cost_plus')
      expect(prompt).toContain('Cost-Plus')
    })

    it('system prompt includes fallback label when pricingModel is null', async () => {
      const prompt = await captureSystemPrompt(null)
      expect(prompt).toContain('Time & Materials')
    })

    it('system prompt contains deduplication instruction (deliverables, exclusions, timeline)', async () => {
      const prompt = await captureSystemPrompt('time_and_materials')
      expect(prompt).toContain('Do NOT ask about')
      // Check at least one of the forbidden keywords is mentioned
      expect(prompt.toLowerCase()).toMatch(/deliverable|exclusion|timeline/)
    })

    it('system prompt instructs LLM to return between 1 and 7 questions', async () => {
      const prompt = await captureSystemPrompt('fixed_price')
      expect(prompt).toContain('1 and 7')
    })
  })

  // -------------------------------------------------------------------------
  // Task 1.6: Backward compatibility — omitting pricingModel works
  // -------------------------------------------------------------------------
  describe('mandatory question injection — backward compatibility', () => {
    it('omitting pricingModel does not break existing callers; mandatory questions present with T&M wording', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          questions: [
            { id: 'q1', question: 'What is your pricing model?', rfpSection: 'Pricing' },
            { id: 'q2', question: 'Do you have ISO 27001 or SOC 2 certification?', rfpSection: 'Security' },
            { id: 'q3', question: 'What SLA terms apply for this contract?', rfpSection: 'Service Level' },
          ],
        },
      } as any)

      // baseInput has no pricingModel field — backward-compatible call
      const result = await generateClarifyingQuestions(baseInput)

      const ids = result.questions.map((q) => q.id)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.DELIVERABLES)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.EXCLUSIONS)
      expect(ids).toContain(MANDATORY_QUESTION_IDS.TIMELINE)

      const tmWording = buildMandatoryQuestions('time_and_materials').find(
        (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
      )!.question
      const deliverables = result.questions.find((q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES)!
      expect(deliverables.question).toBe(tmWording)
    })
  })
})
