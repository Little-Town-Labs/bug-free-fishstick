import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { downloadFile, uploadRfpDocument } from '@/lib/storage/blob'
import { generatePdfOutput } from '@/lib/documents/pdf-output'
import { generateWordOutput } from '@/lib/documents/word-output'
import { eq } from 'drizzle-orm'

export const exportDocument = inngest.createFunction(
  { id: 'export-document' },
  { event: 'rfp/export' },
  async ({ event, step }) => {
    const { rfpId, organizationId, format } = event.data

    const rfp = await step.run('fetch-rfp', async () => {
      const results = await db.select().from(rfps).where(eq(rfps.id, rfpId))
      if (results.length === 0) throw new Error('RFP not found')
      return results[0]!
    })

    // Download and serialize as number array to survive Inngest step serialization
    const originalBufferData = await step.run('download-document', async () => {
      if (!rfp.originalFileUrl) {
        throw new Error('RFP has no original file URL')
      }
      const buf = await downloadFile(rfp.originalFileUrl)
      return { data: Array.from(buf) }
    })

    const responses = await step.run('fetch-responses', async () => {
      return await db.select().from(rfpResponses).where(eq(rfpResponses.rfpId, rfpId))
    })

    // Generate and serialize output buffer
    const outputBufferData = await step.run('generate-output', async () => {
      const originalBuffer = Buffer.from(originalBufferData.data)
      const responseData = responses.map(r => ({
        fieldId: r.fieldId,
        responseText: r.responseText || '',
        position: r.position || { page: 1, x: 0, y: 0, width: 100, height: 20 },
      }))

      if (format === 'pdf') {
        const result = await generatePdfOutput({ originalPdf: originalBuffer, responses: responseData })
        return { data: Array.from(result.buffer) }
      } else {
        const result = await generateWordOutput({ originalDocx: originalBuffer, responses: responseData })
        return { data: Array.from(result.buffer) }
      }
    })

    const uploadResult = await step.run('upload-completed', async () => {
      const outputBuffer = Buffer.from(outputBufferData.data)
      const fileName = `completed.${format}`
      return await uploadRfpDocument(outputBuffer, {
        organizationId,
        rfpId,
        fileName,
        fileType: format,
      })
    })

    await step.run('update-rfp', async () => {
      await db.update(rfps)
        .set({ completedFileUrl: uploadResult.url, status: 'finalized' })
        .where(eq(rfps.id, rfpId))
    })

    return { completedFileUrl: uploadResult.url }
  }
)
