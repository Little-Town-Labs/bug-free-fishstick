import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { downloadFile } from '@/lib/storage/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'
import { analyzeDocument } from '@/lib/ai/agents/document-analyzer'
import { generateResponses } from '@/lib/ai/agents/response-generator'
import { checkQuality } from '@/lib/ai/agents/quality-checker'
import { eq } from 'drizzle-orm'

export const processRfp = inngest.createFunction(
  { id: 'process-rfp' },
  { event: 'rfp/process' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'rfp/process'>) => {
    const { rfpId, organizationId } = event.data

    // Step 1: Fetch RFP and update status to processing
    const rfp = await step.run('fetch-rfp', async () => {
      const results = await db
        .select()
        .from(rfps)
        .where(eq(rfps.id, rfpId))

      if (!results || results.length === 0) {
        throw new Error(`RFP not found: ${rfpId}`)
      }

      // Update status to processing
      await db
        .update(rfps)
        .set({ status: 'processing' })
        .where(eq(rfps.id, rfpId))
        .returning()

      return results[0]
    })

    // Step 2: Download document
    const documentBuffer = await step.run('download-document', async () => {
      return await downloadFile(rfp.documentUrl)
    })

    // Step 3: Parse document
    const parsedText = await step.run('parse-document', async () => {
      if (rfp.documentType === 'pdf') {
        return await parsePdf(documentBuffer)
      } else if (rfp.documentType === 'docx') {
        return await parseWord(documentBuffer)
      } else {
        throw new Error(`Unsupported document type: ${rfp.documentType}`)
      }
    })

    // Step 4: Analyze document
    const analyzed = await step.run('analyze-document', async () => {
      return await analyzeDocument(parsedText)
    })

    // Step 5: Generate responses
    const generatedResponses = await step.run('generate-responses', async () => {
      return await generateResponses(analyzed.fields, {
        organizationId,
        rfpId,
      })
    })

    // Step 6: Check quality
    const qualityResults = await step.run('check-quality', async () => {
      return await checkQuality(generatedResponses)
    })

    // Step 7: Save responses
    await step.run('save-responses', async () => {
      return await db
        .insert(rfpResponses)
        .values(qualityResults)
        .returning()
    })

    // Step 8: Update RFP with final status and metadata
    await step.run('update-rfp', async () => {
      const fields = analyzed.fields || []
      const automationPercentage =
        fields.length > 0
          ? Math.round(
              (generatedResponses.length / fields.length) * 100
            )
          : 0

      const updateData = {
        status: 'draft' as const,
        parsedStructure: { fields },
        automationPercentage,
      }

      return await db
        .update(rfps)
        .set(updateData)
        .where(eq(rfps.id, rfpId))
        .returning()
    })
  }
)
