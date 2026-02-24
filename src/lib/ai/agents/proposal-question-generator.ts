import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModelForOrg } from '@/lib/ai/providers'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'

export interface GenerateClarifyingQuestionsInput {
  rfpFields: Array<{
    id: string
    type: 'text' | 'paragraph' | 'checkbox' | 'table'
    question: string
    position: { page: number; x: number; y: number; width: number; height: number }
  }>
  rfpSummary: string
  knowledgeTopics: string[]
  contentLibraryCategories: string[]
  organizationId: string
}

export interface GenerateClarifyingQuestionsResult {
  questions: ClarifyingQuestion[]
}

const questionsSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      rfpSection: z.string(),
    })
  ),
})

export async function generateClarifyingQuestions(
  input: GenerateClarifyingQuestionsInput
): Promise<GenerateClarifyingQuestionsResult> {
  const { rfpFields, rfpSummary, knowledgeTopics, contentLibraryCategories, organizationId } = input

  const fieldsText =
    rfpFields.length > 0
      ? rfpFields.map((f) => `- [${f.type}] ${f.question}`).join('\n')
      : '(No structured fields found — use the RFP summary to infer requirements.)'

  const model = await getLanguageModelForOrg(organizationId)

  const { object } = await generateObject({
    model,
    schema: questionsSchema,
    system: `You are a proposal writing assistant helping identify gaps before drafting a proposal.
Your task is to generate 3–10 targeted clarifying questions that will improve the quality of the generated proposal.

Focus on gaps between what the RFP requires and what the company has available in its knowledge base and content library.

Knowledge base topics available: ${knowledgeTopics.length > 0 ? knowledgeTopics.join(', ') : 'none'}
Content library categories available: ${contentLibraryCategories.length > 0 ? contentLibraryCategories.join(', ') : 'none'}

Rules:
- Each question must map to a specific RFP section or requirement.
- Questions should address missing business context (pricing, timelines, certifications, approach).
- Do not ask about information already covered by the knowledge base topics or content library categories.
- Return between 3 and 10 questions.
- Each question must have a unique id (q1, q2, ...), the question text, and the RFP section it relates to.`,
    prompt: `RFP Summary: ${rfpSummary}

RFP Fields/Requirements:
${fieldsText}

Generate clarifying questions to fill the gaps needed to write a complete proposal.`,
  })

  const questions: ClarifyingQuestion[] = object.questions.map((q) => ({
    id: q.id,
    question: q.question,
    rfpSection: q.rfpSection,
    answer: null,
  }))

  return { questions }
}
