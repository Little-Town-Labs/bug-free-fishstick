import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { proposalContentLibrary } from '@/lib/db/schema/proposal-content-library'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { eq, and, isNull } from 'drizzle-orm'

export const generateContentLibraryEmbedding = inngest.createFunction(
  { id: 'content-library-generate-embedding', name: 'Generate Content Library Entry Embedding' },
  { event: 'content-library/generate-embedding' },
  async ({ event }: GetFunctionInput<typeof inngest, 'content-library/generate-embedding'>) => {
    const { entryId, organizationId } = event.data

    const [entry] = await db
      .select()
      .from(proposalContentLibrary)
      .where(
        and(
          eq(proposalContentLibrary.id, entryId),
          eq(proposalContentLibrary.organizationId, organizationId)
        )
      )
      .limit(1)

    if (!entry) {
      return { status: 'not_found', entryId }
    }

    const textToEmbed = `${entry.category}: ${entry.name}\n\n${entry.content}`
    const embedding = await generateEmbedding(textToEmbed)

    await db
      .update(proposalContentLibrary)
      .set({ embedding })
      .where(eq(proposalContentLibrary.id, entryId))

    return { status: 'embedded', entryId }
  }
)

export const batchEmbedContentLibrary = inngest.createFunction(
  { id: 'content-library-batch-embed', name: 'Batch Embed Content Library Entries' },
  { event: 'content-library/batch-embed' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'content-library/batch-embed'>) => {
    const { organizationId } = event.data

    const unembedded = await step.run('find-unembedded', async () => {
      return db
        .select({ id: proposalContentLibrary.id })
        .from(proposalContentLibrary)
        .where(
          and(
            eq(proposalContentLibrary.organizationId, organizationId),
            isNull(proposalContentLibrary.embedding)
          )
        )
    })

    if (unembedded.length === 0) {
      return { status: 'no_entries', count: 0 }
    }

    await step.run('fan-out-embeddings', async () => {
      const events = unembedded.map(entry => ({
        name: 'content-library/generate-embedding' as const,
        data: { entryId: entry.id, organizationId },
      }))
      await inngest.send(events)
    })

    return { status: 'queued', count: unembedded.length }
  }
)
