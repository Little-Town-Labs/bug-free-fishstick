import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/providers'
import type { ProviderConfig } from '@/lib/ai/providers'

export interface GenerateResponsesInput {
  fields: Array<{
    id: string
    type: string  // 'text' | 'paragraph' | 'number' | 'date' | 'checkbox' | 'table'
    question: string
  }>
  knowledgeContext: Array<{
    content: string
    relevanceScore: number
    source: string
  }>
  providerConfig: ProviderConfig
  confidenceThreshold?: number  // default 0.7
  learningsContext?: string[]  // insights from past approved RFPs
  customerContext?: {
    preferredTone?: 'formal' | 'casual' | 'technical'
    industryContext?: string
    customInstructions?: string
  }
}

export interface GenerateResponsesResult {
  responses: Array<{
    fieldId: string
    responseText: string
    confidenceScore: number  // 0-1
    sources: string[]
    status: 'auto_filled' | 'needs_input'  // determined by confidenceScore vs threshold
  }>
}

const responseSchema = z.object({
  responses: z.array(z.object({
    fieldId: z.string(),
    responseText: z.string(),
    confidenceScore: z.number(),
    sources: z.array(z.string()),
  })),
})

export async function generateResponses(input: GenerateResponsesInput): Promise<GenerateResponsesResult> {
  if (input.fields.length === 0) {
    throw new Error('Fields array cannot be empty')
  }

  const model = getLanguageModel(input.providerConfig)
  const threshold = input.confidenceThreshold ?? 0.7

  const learningsSection = input.learningsContext?.length
    ? `\n\nPrevious learnings from approved RFPs:\n${input.learningsContext.map((l) => `- ${l}`).join('\n')}`
    : ''

  let customerSection = ''
  if (input.customerContext) {
    const parts: string[] = []
    if (input.customerContext.preferredTone) {
      parts.push(`Preferred tone: ${input.customerContext.preferredTone}`)
    }
    if (input.customerContext.industryContext) {
      parts.push(`Industry context: ${input.customerContext.industryContext}`)
    }
    if (input.customerContext.customInstructions) {
      parts.push(`Custom instructions: ${input.customerContext.customInstructions}`)
    }
    if (parts.length > 0) {
      customerSection = `\n\nCustomer-Specific Guidelines:\n${parts.join('\n')}`
    }
  }

  const fieldsText = input.fields
    .map((f) => `- [${f.id}] (${f.type}) ${f.question}`)
    .join('\n')

  const knowledgeText = input.knowledgeContext.length > 0
    ? input.knowledgeContext
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map((k) => `[${k.source}] (relevance: ${Math.round(k.relevanceScore * 100)}%)\n${k.content}`)
        .join('\n\n')
    : '(No knowledge base content available — generate reasonable drafts but flag for human review.)'

  const result = await generateObject({
    model,
    schema: responseSchema,
    system: `You are an expert RFP response writer. Generate high-quality, specific responses for each RFP field using the knowledge context provided.

CRITICAL RULES:
1. ALWAYS prefer knowledge base content over generic responses. If a knowledge entry is relevant (relevance > 50%), incorporate its content — paraphrase and adapt it to answer the specific question, do not copy verbatim.
2. For each response, list which knowledge sources you drew from in the sources array.
3. If no knowledge context is relevant to a field, write a reasonable draft response but set confidenceScore below 0.5 to flag it for human review.
4. Match the tone and detail level to the field type:
   - text: concise, 1-2 sentences
   - paragraph: detailed, 3-5 sentences minimum
   - checkbox: "Yes" or "No" with brief justification
   - table: structured data in markdown table format
   - date: specific date or "TBD — [reason]"
   - number: specific figure with units, or estimate with range
5. Never fabricate certifications, statistics, or specific claims not supported by the knowledge context.
6. Prefix any uncertain response with [NEEDS REVIEW].`,
    prompt: `Generate responses for each RFP field below. Use the knowledge context to inform your answers — prioritize entries with higher relevance scores.

Fields requiring responses:
${fieldsText}

Available Knowledge Context (sorted by relevance):
${knowledgeText}${learningsSection}${customerSection}

For each field, return: fieldId, responseText, confidenceScore (0-1), and sources (list of knowledge entry sources used).`,
  })

  return {
    responses: result.object.responses.map(r => ({
      ...r,
      status: r.confidenceScore >= threshold ? 'auto_filled' as const : 'needs_input' as const,
    })),
  }
}
