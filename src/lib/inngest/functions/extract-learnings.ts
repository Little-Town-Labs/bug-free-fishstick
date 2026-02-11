import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { rfps, rfpResponses, learnings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModelForOrg } from '@/lib/ai/providers'

const learningsSchema = z.object({
  learnings: z.array(
    z.object({
      insight: z.string().describe('A specific reusable insight for future RFPs'),
    })
  ),
})

export const extractLearnings = inngest.createFunction(
  { id: 'extract-learnings', name: 'Extract Learnings from Approved RFP' },
  { event: 'rfp/extract-learnings' },
  async ({
    event,
    step,
  }: GetFunctionInput<typeof inngest, 'rfp/extract-learnings'>) => {
    const { rfpId, organizationId } = event.data

    // Step 1: Fetch the RFP and its responses
    const rfpData = await step.run('fetch-rfp-data', async () => {
      const [rfp] = await db
        .select()
        .from(rfps)
        .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, organizationId)))
        .limit(1)

      if (!rfp) throw new Error(`RFP not found: ${rfpId}`)

      const responses = await db
        .select()
        .from(rfpResponses)
        .where(eq(rfpResponses.rfpId, rfpId))

      return { rfp, responses }
    })

    // Step 2: Extract learnings with AI
    const extracted = await step.run('extract-with-ai', async () => {
      const completedPairs = rfpData.responses
        .filter((r) => r.responseText)
        .map((r) => `Q: ${r.question}\nA: ${r.responseText}`)
        .join('\n\n')

      if (!completedPairs) return { learnings: [] }

      const model = await getLanguageModelForOrg(organizationId)
      const result = await generateObject({
        model,
        schema: learningsSchema,
        prompt: `Extract 3-5 reusable insights from these completed RFP responses that would help answer similar questions in future RFPs:\n\n${completedPairs}`,
      })
      return result.object
    })

    // Step 3: Save learnings to DB
    const saved = await step.run('save-learnings', async () => {
      if (!extracted.learnings.length) return []

      const rows = await Promise.all(
        extracted.learnings.map((l) =>
          db
            .insert(learnings)
            .values({
              organizationId,
              customerId: rfpData.rfp.customerId ?? null,
              content: l.insight,
              sourceType: 'rfp_approval',
              createdBy: 'system',
              sourceMetadata: { rfpId },
            })
            .returning()
        )
      )
      return rows.flat()
    })

    return { rfpId, learningsSaved: saved.length }
  }
)
