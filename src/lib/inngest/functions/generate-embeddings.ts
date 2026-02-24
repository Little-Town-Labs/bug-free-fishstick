import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import { tenantSettings } from '@/lib/db/schema'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { decrypt } from '@/lib/services/encryption'
import { eq } from 'drizzle-orm'

export const generateEmbeddingsFunction = inngest.createFunction(
  { id: 'generate-embeddings' },
  { event: 'rfp/generate-embeddings' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'rfp/generate-embeddings'>) => {
    const { knowledgeEntryId, organizationId, content } = event.data

    // Fetch org's OpenAI BYOK key using the organizationId already in the event
    const openaiApiKey = await (async () => {
      const [row] = await db
        .select({ openaiApiKeyEncrypted: tenantSettings.openaiApiKeyEncrypted })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, organizationId))
        .limit(1)
      return row?.openaiApiKeyEncrypted ? decrypt(row.openaiApiKeyEncrypted) : undefined
    })()

    if (!openaiApiKey && !process.env.OPENAI_API_KEY) {
      return { status: 'skipped', reason: 'no_openai_key', knowledgeEntryId }
    }

    // Step 1: Generate embedding from content
    const embedding = await step.run('generate-embedding', async () => {
      return await generateEmbedding(content, openaiApiKey)
    })

    // Step 2: Update knowledge entry with the generated embedding
    await step.run('update-entry', async () => {
      return await db
        .update(knowledgeEntries)
        .set({ embedding, updatedAt: new Date() })
        .where(eq(knowledgeEntries.id, knowledgeEntryId))
        .returning()
    })
  }
)
