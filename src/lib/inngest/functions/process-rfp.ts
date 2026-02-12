import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { learnings } from '@/lib/db/schema'
import { downloadFile } from '@/lib/storage/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'
import { analyzeDocument } from '@/lib/ai/agents/document-analyzer'
import { generateResponses } from '@/lib/ai/agents/response-generator'
import { checkQuality } from '@/lib/ai/agents/quality-checker'
import { searchSimilar } from '@/lib/services/vector-search'
import { eq } from 'drizzle-orm'

export const processRfp = inngest.createFunction(
  { id: 'process-rfp' },
  { event: 'rfp/process' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'rfp/process'>) => {
    const { rfpId, organizationId } = event.data

    // Step 1: Fetch RFP and update status to processing (parallel)
    const rfp = await step.run('fetch-rfp', async () => {
      const [results] = await Promise.all([
        db.select().from(rfps).where(eq(rfps.id, rfpId)),
        db.update(rfps).set({ status: 'processing' }).where(eq(rfps.id, rfpId)),
      ])

      if (!results || results.length === 0) {
        throw new Error(`RFP not found: ${rfpId}`)
      }

      return results[0]!
    })

    // Step 2: Download document
    // Note: Inngest serializes Buffer as { type: "Buffer", data: number[] }
    const documentBufferData = await step.run('download-document', async () => {
      if (!rfp.originalFileUrl) {
        throw new Error('RFP has no document URL')
      }
      const buf = await downloadFile(rfp.originalFileUrl)
      return { data: Array.from(buf) }
    })

    // Step 3: Parse document
    const parsedDoc = await step.run('parse-document', async () => {
      const buf = Buffer.from(documentBufferData.data)
      if (rfp.originalFileType === 'pdf') {
        return await parsePdf(buf)
      } else if (rfp.originalFileType === 'docx') {
        return await parseWord(buf)
      } else {
        throw new Error(`Unsupported document type: ${rfp.originalFileType}`)
      }
    })

    // Step 4: Analyze document
    const analyzed = await step.run('analyze-document', async () => {
      return await analyzeDocument({
        text: parsedDoc.text,
        pages: 'pages' in parsedDoc ? parsedDoc.pages : 1,
        providerConfig: { provider: 'claude' },
      })
    })

    // Step 5: Generate responses
    const generatedResponses = await step.run('generate-responses', async () => {
      // Fetch knowledge context and learnings in parallel
      const [knowledgeContext, orgLearnings] = await Promise.all([
        rfp.customerId
          ? searchSimilar(rfp.name, rfp.customerId, organizationId, 10).then((results) =>
              results.map((r) => ({ content: r.content, relevanceScore: r.similarity, source: r.title }))
            )
          : Promise.resolve([]),
        db.select().from(learnings).where(eq(learnings.organizationId, organizationId)),
      ])
      const learningsContext = orgLearnings.map((l) => l.content)

      return await generateResponses({
        fields: analyzed.fields.map(f => ({
          id: f.id,
          type: f.type,
          question: f.question,
        })),
        knowledgeContext,
        learningsContext,
        providerConfig: { provider: 'claude' },
      })
    })

    // Step 6: Check quality
    const qualityResults = await step.run('check-quality', async () => {
      const fieldMap = new Map(analyzed.fields.map(f => [f.id, f]))
      return await checkQuality({
        responses: generatedResponses.responses.map(r => ({
          fieldId: r.fieldId,
          question: fieldMap.get(r.fieldId)?.question || '',
          fieldType: fieldMap.get(r.fieldId)?.type || 'text',
          responseText: r.responseText,
          confidenceScore: r.confidenceScore,
        })),
        providerConfig: { provider: 'claude' },
      })
    })

    // Step 7: Save responses
    await step.run('save-responses', async () => {
      const fieldMap = new Map(analyzed.fields.map(f => [f.id, f]))
      const qualityMap = new Map(qualityResults.results.map(q => [q.fieldId, q]))
      const responseValues = generatedResponses.responses.map(r => {
        const field = fieldMap.get(r.fieldId)
        const quality = qualityMap.get(r.fieldId)
        return {
          rfpId,
          fieldId: r.fieldId,
          fieldType: (field?.type || 'text') as 'text' | 'paragraph' | 'checkbox' | 'table' | 'date' | 'number',
          question: field?.question || '',
          responseText: r.responseText,
          confidenceScore: quality?.adjustedConfidence ?? r.confidenceScore,
          status: r.status as 'auto_filled' | 'needs_input',
          position: field?.position,
          aiMetadata: {
            sources: r.sources,
            generatedAt: new Date().toISOString(),
          },
        }
      })
      return await db
        .insert(rfpResponses)
        .values(responseValues)
        .returning()
    })

    // Step 8: Update RFP with final status and metadata
    await step.run('update-rfp', async () => {
      const fields = analyzed.fields || []
      const autoFilledCount = generatedResponses.responses.filter(
        r => r.status === 'auto_filled'
      ).length
      const automationPercentage =
        fields.length > 0
          ? Math.round((autoFilledCount / fields.length) * 100)
          : 0

      return await db
        .update(rfps)
        .set({
          status: 'draft' as const,
          parsedStructure: {
            pages: 'pages' in parsedDoc ? parsedDoc.pages : 1,
            fields: fields.map(f => ({
              id: f.id,
              type: f.type as 'text' | 'paragraph' | 'checkbox' | 'table',
              question: f.question,
              position: f.position,
            })),
          },
          automationPercentage,
        })
        .where(eq(rfps.id, rfpId))
        .returning()
    })
  }
)
