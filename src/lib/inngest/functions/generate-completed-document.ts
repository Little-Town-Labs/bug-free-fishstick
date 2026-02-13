import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { eq, and } from 'drizzle-orm'
import { downloadFile, uploadRfpDocument } from '@/lib/storage/blob'
import { generatePdfOutput } from '@/lib/documents/pdf-output'
import { generateWordOutput } from '@/lib/documents/word-output'

export const generateCompletedDocument = inngest.createFunction(
  {
    id: 'generate-completed-document',
    retries: 3,
  },
  { event: 'rfp/generate-completed-document' },
  async ({ event, step }) => {
    const { rfpId, organizationId } = event.data as {
      rfpId: string
      organizationId: string
    }

    // Step 1: Fetch RFP and validate
    const rfp = await step.run('fetch-rfp', async () => {
      const [result] = await db
        .select()
        .from(rfps)
        .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, organizationId)))
        .limit(1)

      if (!result) throw new Error(`RFP ${rfpId} not found`)
      if (result.status !== 'finalized') throw new Error(`RFP ${rfpId} is not finalized`)
      if (!result.originalFileUrl) throw new Error(`RFP ${rfpId} has no original file`)

      return {
        id: result.id,
        organizationId: result.organizationId,
        originalFileUrl: result.originalFileUrl,
        originalFileType: result.originalFileType,
      }
    })

    // Step 2: Download original document
    const originalBuffer = await step.run('download-original', async () => {
      const buffer = await downloadFile(rfp.originalFileUrl)
      return buffer.toString('base64')
    })

    // Step 3: Fetch responses
    const responses = await step.run('fetch-responses', async () => {
      const results = await db
        .select()
        .from(rfpResponses)
        .where(eq(rfpResponses.rfpId, rfpId))

      return results
        .filter((r) => r.responseText && r.position)
        .map((r) => ({
          fieldId: r.fieldId,
          responseText: r.responseText!,
          position: r.position!,
        }))
    })

    // Step 4: Generate output document
    try {
      const completedUrl = await step.run('generate-and-upload', async () => {
        const fileBuffer = Buffer.from(originalBuffer, 'base64')
        let outputBuffer: Buffer

        if (rfp.originalFileType === 'pdf') {
          const result = await generatePdfOutput({
            originalPdf: fileBuffer,
            responses,
          })
          outputBuffer = result.buffer
        } else {
          const result = await generateWordOutput({
            originalDocx: fileBuffer,
            responses,
          })
          outputBuffer = result.buffer
        }

        // Upload to Blob
        const ext = rfp.originalFileType === 'pdf' ? 'pdf' : 'docx'
        const { url } = await uploadRfpDocument(outputBuffer, {
          organizationId: rfp.organizationId,
          rfpId: rfp.id,
          fileName: `completed.${ext}`,
          fileType: rfp.originalFileType as 'pdf' | 'docx',
        })

        return url
      })

      // Step 5: Update RFP with completed URL
      await step.run('update-rfp', async () => {
        await db
          .update(rfps)
          .set({
            completedFileUrl: completedUrl,
            completedFileError: null,
            updatedAt: new Date(),
          })
          .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, organizationId)))
      })

      return { success: true, completedFileUrl: completedUrl }
    } catch (error) {
      // On failure, record the error
      await step.run('record-error', async () => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await db
          .update(rfps)
          .set({
            completedFileError: message,
            updatedAt: new Date(),
          })
          .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, organizationId)))
      })

      throw error
    }
  }
)
