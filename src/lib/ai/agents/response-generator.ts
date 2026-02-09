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

  const result = await generateObject({
    model,
    schema: responseSchema,
    prompt: `Generate responses for the following RFP fields based on the knowledge context provided.\n\nFields:\n${JSON.stringify(input.fields)}\n\nKnowledge Context:\n${JSON.stringify(input.knowledgeContext)}`,
  })

  return {
    responses: result.object.responses.map(r => ({
      ...r,
      status: r.confidenceScore >= threshold ? 'auto_filled' as const : 'needs_input' as const,
    })),
  }
}
