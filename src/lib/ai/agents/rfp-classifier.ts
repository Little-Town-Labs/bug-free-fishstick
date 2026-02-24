import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/providers'
import type { ProviderConfig } from '@/lib/ai/providers'

export const classificationSchema = z.object({
  rfpType: z.enum(['technical', 'commercial', 'compliance', 'mixed']),
  complexity: z.enum(['simple', 'medium', 'complex']),
  industryTags: z.array(z.string()),
})

export type RfpClassification = z.infer<typeof classificationSchema>

export interface ClassifyRfpInput {
  documentText: string
  fieldCount: number
  fieldTypes: string[]
  providerConfig: ProviderConfig
}

export async function classifyRfp(input: ClassifyRfpInput): Promise<RfpClassification> {
  const model = getLanguageModel(input.providerConfig)

  const result = await generateObject({
    model,
    schema: classificationSchema,
    prompt: `Classify this RFP document.

Document text (first 2000 chars): ${input.documentText.slice(0, 2000)}

Number of fields: ${input.fieldCount}
Field types present: ${[...new Set(input.fieldTypes)].join(', ')}

Classify the RFP:
- rfpType: "technical" (specs, requirements), "commercial" (pricing, terms), "compliance" (regulations, certifications), or "mixed"
- complexity: "simple" (< 10 fields, straightforward), "medium" (10-30 fields), "complex" (> 30 fields or highly specialized)
- industryTags: up to 5 industry/domain tags (e.g., "healthcare", "government", "fintech", "manufacturing")`,
  })

  return result.object
}
