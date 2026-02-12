import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/providers'
import type { ProviderConfig } from '@/lib/ai/providers'

export interface QualityCheckInput {
  responses: Array<{
    fieldId: string
    question: string
    fieldType: string // 'text' | 'paragraph' | 'date' | 'number' | 'table' | 'checkbox'
    responseText: string
    confidenceScore: number
  }>
  providerConfig: ProviderConfig
}

export interface QualityCheckResult {
  results: Array<{
    fieldId: string
    passed: boolean
    adjustedConfidence: number
    issues: string[]
    suggestion?: string // undefined when no issues
  }>
}

const qualityResultSchema = z.object({
  results: z.array(
    z.object({
      fieldId: z.string(),
      passed: z.boolean(),
      adjustedConfidence: z.number(),
      issues: z.array(z.string()),
      suggestion: z.string().optional(),
    })
  ),
})

export async function checkQuality(input: QualityCheckInput): Promise<QualityCheckResult> {
  if (input.responses.length === 0) {
    throw new Error('No responses provided for quality check')
  }

  const model = getLanguageModel(input.providerConfig)

  const result = await generateObject({
    model,
    schema: qualityResultSchema,
    prompt: `You are a quality assurance AI reviewing RFP (Request for Proposal) responses for accuracy, completeness, and formatting.

For each response provided, evaluate:
1. **Field Type Match**: Does the response match the expected field type?
   - text: Short, concise text (not multi-paragraph)
   - paragraph: Longer descriptive text
   - date: ISO format (YYYY-MM-DD)
   - number: Numeric value (not ranges or text descriptions)
   - table: Structured data with rows/columns
   - checkbox: Boolean-like values

2. **Content Quality**: Is the response:
   - Specific and detailed enough for the question?
   - Accurate and professional?
   - Complete (not truncated or vague)?

3. **Special Cases**:
   - [NEEDS INPUT] placeholder: Mark as passed=true, adjustedConfidence=0.0, no issues
   - Empty responses: Mark as failed with appropriate issue
   - High confidence but wrong format: Adjust confidence down significantly

For each response, return:
- passed: true if all checks pass, false otherwise
- adjustedConfidence: Your confidence in the response (0.0-1.0)
- issues: Array of specific problems (empty if passed)
- suggestion: How to fix the response (only if failed, otherwise omit)

Responses to review:
${JSON.stringify(input.responses, null, 2)}`,
  })

  return result.object
}
