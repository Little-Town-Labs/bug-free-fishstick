import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModelForOrg: vi.fn().mockReturnValue({ type: 'mock-model' }),
}))

import { generateObject } from 'ai'
import { generateClarifyingQuestions } from '@/lib/ai/agents/proposal-question-generator'
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
})
