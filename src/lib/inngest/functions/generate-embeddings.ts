import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { eq } from 'drizzle-orm'

export const generateEmbeddingsFunction = inngest.createFunction(
  { id: 'generate-embeddings' },
  { event: 'rfp/generate-embeddings' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'rfp/generate-embeddings'>) => {
    const { knowledgeEntryId, content } = event.data

    // Step 1: Generate embedding from content
    const embedding = await step.run('generate-embedding', async () => {
      return await generateEmbedding(content)
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
