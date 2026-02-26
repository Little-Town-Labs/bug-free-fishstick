import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModelForOrg } from '@/lib/ai/providers'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'
import type { ProposalDefaults } from '@/lib/db/schema/tenant-settings'

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
  pricingModel?: ProposalDefaults['pricingModel'] | null
}

export interface GenerateClarifyingQuestionsResult {
  questions: ClarifyingQuestion[]
}

// Stable IDs for mandatory questions — consumed by downstream F8 pipeline.
export const MANDATORY_QUESTION_IDS = {
  DELIVERABLES: 'scope-deliverables',
  EXCLUSIONS: 'scope-exclusions',
  TIMELINE: 'scope-timeline',
} as const

// Hardcoded label map — raw pricingModel value is never interpolated directly
// into the prompt (NFR-002: prompt injection prevention).
const PRICING_MODEL_LABELS: Record<ProposalDefaults['pricingModel'], string> = {
  time_and_materials: 'Time & Materials',
  fixed_price: 'Fixed Price',
  cost_plus: 'Cost-Plus',
}

/**
 * Build the three mandatory scope/commercial questions.
 * Pure function — no I/O, no side effects.
 * Exported for direct unit testing.
 */
export function buildMandatoryQuestions(
  pricingModel: ProposalDefaults['pricingModel'] | null | undefined
): ClarifyingQuestion[] {
  let deliverablesQuestion: string

  switch (pricingModel) {
    case 'fixed_price':
      deliverablesQuestion =
        'What is the total fixed engagement price or budget target for this project? Please provide the full scope included at that price.'
      break
    case 'cost_plus':
      deliverablesQuestion =
        'Please provide an estimated direct cost breakdown per deliverable and your target margin percentage for this engagement.'
      break
    case 'time_and_materials':
    default:
      deliverablesQuestion =
        'Please list each deliverable and the estimated hours required per deliverable for this engagement.'
      break
  }

  return [
    {
      id: MANDATORY_QUESTION_IDS.DELIVERABLES,
      question: deliverablesQuestion,
      rfpSection: 'Commercial Scope',
      answer: null,
    },
    {
      id: MANDATORY_QUESTION_IDS.EXCLUSIONS,
      question:
        'What items or work are explicitly out of scope for this engagement? Please list any exclusions you intend to document in the proposal.',
      rfpSection: 'Scope Exclusions',
      answer: null,
    },
    {
      id: MANDATORY_QUESTION_IDS.TIMELINE,
      question:
        'What is the expected project start date, key milestone dates, and final delivery deadline?',
      rfpSection: 'Delivery Timeline',
      answer: null,
    },
  ]
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
  const { rfpFields, rfpSummary, knowledgeTopics, contentLibraryCategories, organizationId, pricingModel } = input

  const fieldsText =
    rfpFields.length > 0
      ? rfpFields.map((f) => `- [${f.type}] ${f.question}`).join('\n')
      : '(No structured fields found — use the RFP summary to infer requirements.)'

  // Build the pricing model label from the hardcoded map — never interpolate
  // the raw pricingModel value to prevent prompt injection.
  const pricingModelLabel =
    pricingModel != null
      ? (PRICING_MODEL_LABELS[pricingModel] ?? 'Time & Materials (default — no model configured)')
      : 'Time & Materials (default — no model configured)'

  const model = await getLanguageModelForOrg(organizationId)

  const { object } = await generateObject({
    model,
    schema: questionsSchema,
    system: `You are a proposal writing assistant helping identify gaps before drafting a proposal.
Your task is to generate targeted clarifying questions that will improve the quality of the generated proposal.

Organization pricing model: ${pricingModelLabel}
When phrasing questions about effort or cost, use this model's terminology.

Focus on gaps between what the RFP requires and what the company has available in its knowledge base and content library.

Knowledge base topics available: ${knowledgeTopics.length > 0 ? knowledgeTopics.join(', ') : 'none'}
Content library categories available: ${contentLibraryCategories.length > 0 ? contentLibraryCategories.join(', ') : 'none'}

Rules:
- Each question must map to a specific RFP section or requirement.
- Questions should address missing business context (certifications, approach, compliance, dependencies).
- Do not ask about information already covered by the knowledge base topics or content library categories.
- Do NOT ask about: deliverables, effort, hours, pricing, cost, budget, timeline, milestones, or explicit exclusions. Those questions will be added separately.
- Return between 1 and 7 questions.
- Each question must have a unique id (q1, q2, ...), the question text, and the RFP section it relates to.`,
    prompt: `RFP Summary: ${rfpSummary}

RFP Fields/Requirements:
${fieldsText}

Generate clarifying questions to fill the gaps needed to write a complete proposal.`,
  })

  const mandatoryQuestions = buildMandatoryQuestions(pricingModel)
  const llmQuestions: ClarifyingQuestion[] = object.questions
    .slice(0, 7)
    .map((q) => ({ ...q, answer: null }))

  const questions = [...mandatoryQuestions, ...llmQuestions]

  return { questions }
}
