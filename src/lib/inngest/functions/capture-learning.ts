import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { learnings } from '@/lib/db/schema/learnings'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { eq, and } from 'drizzle-orm'

export const captureLearning = inngest.createFunction(
  { id: 'capture-learning' },
  { event: 'rfp/capture-learning' },
  async ({ event }: GetFunctionInput<typeof inngest, 'rfp/capture-learning'>) => {
    const {
      type,
      rfpId,
      fieldId,
      organizationId,
      customerId,
      userId,
      originalText,
      correctedText,
      questionType,
      confidence,
    } = event.data

    // Fetch the response for context
    const responses = await db
      .select()
      .from(rfpResponses)
      .where(and(eq(rfpResponses.rfpId, rfpId), eq(rfpResponses.fieldId, fieldId)))
      .limit(1)

    const response = responses[0]
    const question = response?.question ?? 'Unknown question'

    let content: string
    let sourceType: 'accept_signal' | 'edit_correction' | 'reject_signal'

    switch (type) {
      case 'accept':
        sourceType = 'accept_signal'
        content = `Accepted response for "${question}": ${response?.responseText ?? originalText ?? ''}`
        break
      case 'edit':
        sourceType = 'edit_correction'
        content = `Corrected response for "${question}": Changed from "${originalText ?? ''}" to "${correctedText ?? ''}"`
        break
      case 'reject':
        sourceType = 'reject_signal'
        content = `Rejected response for "${question}": Original response was not appropriate`
        break
      default:
        throw new Error(`Unknown learning type: ${type}`)
    }

    await db.insert(learnings).values({
      organizationId,
      customerId: customerId ?? null,
      content,
      sourceType,
      createdBy: userId,
      fieldId,
      questionType: questionType ?? response?.fieldType ?? null,
      confidence: confidence ?? response?.confidenceScore ?? null,
      sourceMetadata: {
        rfpId,
        fieldId,
        originalText: originalText ?? response?.responseText ?? undefined,
        correctedText: correctedText ?? undefined,
      },
    })

    return { captured: true, type: sourceType }
  }
)
