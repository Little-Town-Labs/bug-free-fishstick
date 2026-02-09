import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/providers'
import type { ProviderConfig } from '@/lib/ai/providers'

export interface DocumentAnalysisInput {
  text: string
  pages: number
  providerConfig: ProviderConfig
}

export interface DocumentAnalysisResult {
  fields: Array<{
    id: string
    type: 'text' | 'paragraph' | 'checkbox' | 'table' | 'date' | 'number'
    question: string
    position: { page: number; x: number; y: number; width: number; height: number }
  }>
  summary: string
}

// Zod schema for field validation
const fieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'paragraph', 'checkbox', 'table', 'date', 'number']),
  question: z.string(),
  position: z.object({
    page: z.number(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
})

// Zod schema for the complete result
const resultSchema = z.object({
  fields: z.array(fieldSchema),
  summary: z.string(),
})

export async function analyzeDocument(
  input: DocumentAnalysisInput
): Promise<DocumentAnalysisResult> {
  // Validate input
  if (!input.text || !input.text.trim()) {
    throw new Error('Document text cannot be empty')
  }

  // Get the language model based on provider config
  const model = getLanguageModel(input.providerConfig)

  try {
    // Call the AI model to analyze the document
    const result = await generateObject({
      model,
      schema: resultSchema,
      prompt: `Analyze the following ${input.pages}-page document and identify all fillable fields, questions, and form elements.

For each identified field, provide:
- A unique ID
- The field type (text, paragraph, checkbox, table, date, or number)
- The question or label text
- The approximate position in the document (page number and coordinates)

Also provide a brief summary of the document's purpose and content.

Document text:

${input.text}`,
    })

    // Validate and return the result
    const parsed = resultSchema.parse(result.object)
    return parsed
  } catch (error: any) {
    // Re-throw errors that are already wrapped
    if (error.message?.includes('document analysis')) {
      throw error
    }
    // Wrap all other errors with context
    throw new Error(`Document analysis failed: ${error.message}`)
  }
}
