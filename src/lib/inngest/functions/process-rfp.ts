import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { rfps, tenantSettings } from '@/lib/db/schema'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { learnings } from '@/lib/db/schema'
import { downloadFile } from '@/lib/storage/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'
import { analyzeDocument } from '@/lib/ai/agents/document-analyzer'
import { generateResponses } from '@/lib/ai/agents/response-generator'
import { checkQuality } from '@/lib/ai/agents/quality-checker'
import { searchSimilar } from '@/lib/services/vector-search'
import { classifyRfp } from '@/lib/ai/agents/rfp-classifier'
import { suggestAssignee } from '@/lib/services/rfp-classifier'
import { decrypt } from '@/lib/services/encryption'
import type { ProviderConfig } from '@/lib/ai/providers'
import { eq, and } from 'drizzle-orm'
import { customers } from '@/lib/db/schema/customers'

export const processRfp = inngest.createFunction(
  { id: 'process-rfp' },
  { event: 'rfp/process' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'rfp/process'>) => {
    const { rfpId, organizationId } = event.data

    // Fetch org's BYOK provider config outside of any step so the API key
    // is never serialized/stored by Inngest's step state.
    const providerConfig = await (async (): Promise<ProviderConfig> => {
      const [row] = await db
        .select()
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, organizationId))
        .limit(1)
      const provider = (row?.llmProvider ?? 'claude') as ProviderConfig['provider']
      // Resolve API key: prefer provider-specific columns (set by BYOK UI),
      // fall back to legacy generic llmApiKeyEncrypted column.
      const encryptedKey =
        provider === 'claude'
          ? (row?.anthropicApiKeyEncrypted ?? row?.llmApiKeyEncrypted)
          : provider === 'openai'
            ? (row?.openaiApiKeyEncrypted ?? row?.llmApiKeyEncrypted)
            : row?.llmApiKeyEncrypted
      const apiKey = encryptedKey ? decrypt(encryptedKey) : undefined
      return { provider, apiKey }
    })()

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
        providerConfig,
      })
    })

    // Step 4.5: Classify RFP
    const classification = await step.run('classify-rfp', async () => {
      try {
        const result = await classifyRfp({
          documentText: parsedDoc.text,
          fieldCount: analyzed.fields.length,
          fieldTypes: analyzed.fields.map((f) => f.type),
          providerConfig,
        })

        // Suggest assignee based on classification
        // For now, use existing assigned user as the only candidate
        const suggested = await suggestAssignee(organizationId, result.rfpType, [
          rfp.assignedUserId,
        ])

        await db
          .update(rfps)
          .set({
            rfpType: result.rfpType,
            complexity: result.complexity,
            industryTags: result.industryTags,
            suggestedAssigneeId: suggested,
          })
          .where(eq(rfps.id, rfpId))

        return result
      } catch {
        // Classification is non-critical — don't fail the pipeline
        return null
      }
    })

    // Step 5: Generate responses with customer context
    const generatedResponses = await step.run('generate-responses', async () => {
      // Fetch knowledge context, learnings, and customer settings in parallel
      const customerId = rfp.customerId ?? undefined
      const [knowledgeContext, orgLearnings, customerResults] = await Promise.all([
        searchSimilar(rfp.name, organizationId, 10, customerId).then((results) =>
          results.map((r) => ({
            content: r.content,
            relevanceScore: r.similarity,
            source: r.title,
          }))
        ),
        db.select().from(learnings).where(eq(learnings.organizationId, organizationId)),
        customerId
          ? db
              .select()
              .from(customers)
              .where(
                and(eq(customers.id, customerId), eq(customers.organizationId, organizationId))
              )
          : Promise.resolve([]),
      ])

      // Prioritize customer-specific learnings
      const customerLearnings = orgLearnings.filter((l) => l.customerId === customerId)
      const orgOnlyLearnings = orgLearnings.filter((l) => !l.customerId)
      const learningsContext = [
        ...customerLearnings.map((l) => l.content),
        ...orgOnlyLearnings.map((l) => l.content),
      ]

      // Build customer context from settings
      const customer = customerResults[0]
      const customerContext = customer?.settings
        ? {
            preferredTone: customer.settings.preferredTone,
            industryContext: customer.settings.industryContext,
            customInstructions: customer.settings.customInstructions,
          }
        : undefined

      return await generateResponses({
        fields: analyzed.fields.map((f) => ({
          id: f.id,
          type: f.type,
          question: f.question,
        })),
        knowledgeContext,
        learningsContext,
        customerContext,
        providerConfig,
      })
    })

    // Step 6: Check quality
    const qualityResults = await step.run('check-quality', async () => {
      const fieldMap = new Map(analyzed.fields.map((f) => [f.id, f]))
      return await checkQuality({
        responses: generatedResponses.responses.map((r) => ({
          fieldId: r.fieldId,
          question: fieldMap.get(r.fieldId)?.question || '',
          fieldType: fieldMap.get(r.fieldId)?.type || 'text',
          responseText: r.responseText,
          confidenceScore: r.confidenceScore,
        })),
        providerConfig,
      })
    })

    // Step 7: Save responses
    await step.run('save-responses', async () => {
      const fieldMap = new Map(analyzed.fields.map((f) => [f.id, f]))
      const qualityMap = new Map(qualityResults.results.map((q) => [q.fieldId, q]))
      const responseValues = generatedResponses.responses.map((r) => {
        const field = fieldMap.get(r.fieldId)
        const quality = qualityMap.get(r.fieldId)
        return {
          rfpId,
          fieldId: r.fieldId,
          fieldType: (field?.type || 'text') as
            | 'text'
            | 'paragraph'
            | 'checkbox'
            | 'table'
            | 'date'
            | 'number',
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
      return await db.insert(rfpResponses).values(responseValues).returning()
    })

    // Step 8: Update RFP with final status and metadata
    await step.run('update-rfp', async () => {
      const fields = analyzed.fields || []
      const autoFilledCount = generatedResponses.responses.filter(
        (r) => r.status === 'auto_filled'
      ).length
      const automationPercentage =
        fields.length > 0 ? Math.round((autoFilledCount / fields.length) * 100) : 0

      return await db
        .update(rfps)
        .set({
          status: 'draft' as const,
          parsedStructure: {
            pages: 'pages' in parsedDoc ? parsedDoc.pages : 1,
            fields: fields.map((f) => ({
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
