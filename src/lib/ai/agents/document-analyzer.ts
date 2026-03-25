import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModel } from '@/lib/ai/providers'
import type { ProviderConfig } from '@/lib/ai/providers'

export interface DocumentAnalysisInput {
  text: string
  pages: number
  providerConfig: ProviderConfig
}

export interface DocumentAnalysisMetadata {
  title: string | null
  issuingOrganization: string | null
  referenceNumber: string | null
  submissionDeadline: string | null
  projectStartDate: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
}

export interface DocumentAnalysisResult {
  fields: Array<{
    id: string
    type: 'text' | 'paragraph' | 'checkbox' | 'table' | 'date' | 'number'
    question: string
    position: { page: number; x: number; y: number; width: number; height: number }
  }>
  summary: string
  metadata?: DocumentAnalysisMetadata
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

// Zod schema for extracted RFP metadata
const metadataSchema = z.object({
  title: z.string().nullable(),
  issuingOrganization: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  submissionDeadline: z.string().nullable(),
  projectStartDate: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
})

// Zod schema for the complete result
const resultSchema = z.object({
  fields: z.array(fieldSchema),
  summary: z.string(),
  metadata: metadataSchema.optional(),
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
      system: `You are an expert RFP analyst. Your job is to identify every section in an RFP document that requires a response from a vendor/bidder.

INCLUDE as response fields:
- Direct questions (e.g., "Describe your approach to...")
- Fillable form fields (text boxes, checkboxes, tables, date fields)
- Sections where the RFP expects the vendor to provide NEW information (qualifications, methodology, staffing, references, pricing, technical approach, etc.)
- Compliance or certification requirements that need confirmation
- Any section with instructions like "provide", "describe", "explain", "list", "demonstrate", "submit", or "include"

DO NOT INCLUDE as response fields:
- Informational sections that describe the buyer's organization, project background, or context (these are reference material, not questions)
- Terms and conditions the vendor must accept (not a response field)
- Table of contents, headers, page numbers, or administrative boilerplate
- Evaluation criteria descriptions (these explain how responses will be scored, not what to respond to)

When a section is not phrased as a question but clearly expects vendor input, rewrite it as a question. For example: "Section B describes qualifications needed" should become "What are your qualifications for the requirements described in Section B?"

METADATA EXTRACTION:
Extract the exact document title, issuing organization, reference number, submission deadline, project start date, and contact details (name, email, phone). Return null for any field not clearly stated in the document — never fabricate or guess metadata values. Preserve non-English text exactly as written.`,
      prompt: `Analyze the following ${input.pages}-page document and identify all sections requiring a vendor response.

For each identified requirement, provide:
- A unique ID (field-1, field-2, ...)
- The field type (text, paragraph, checkbox, table, date, or number)
- The question or requirement text (rewritten as a question if the original is not phrased as one)
- The approximate position in the document (page number and coordinates)

Also provide a brief summary of the document's purpose, the issuing organization, and the type of services or goods being requested.

Document text:

${input.text}`,
    })

    // Validate and return the result
    const parsed = resultSchema.parse(result.object)
    return parsed
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    // Re-throw errors that are already wrapped
    if (message.includes('document analysis')) {
      throw error
    }
    // Wrap all other errors with context
    throw new Error(`Document analysis failed: ${message}`)
  }
}
