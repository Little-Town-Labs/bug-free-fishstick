import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { proposalContentLibrary } from '@/lib/db/schema/proposal-content-library'
import { tenantSettings } from '@/lib/db/schema'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { decrypt } from '@/lib/services/encryption'
import { eq, and, isNull } from 'drizzle-orm'

export const generateContentLibraryEmbedding = inngest.createFunction(
  { id: 'content-library-generate-embedding', name: 'Generate Content Library Entry Embedding' },
  { event: 'content-library/generate-embedding' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'content-library/generate-embedding'>) => {
    const { entryId, organizationId } = event.data

    // Step 1: Fetch entry and org API key
    const { entry, openaiApiKey } = await step.run('fetch-entry-and-key', async () => {
      const [found] = await db
        .select()
        .from(proposalContentLibrary)
        .where(
          and(
            eq(proposalContentLibrary.id, entryId),
            eq(proposalContentLibrary.organizationId, organizationId)
          )
        )
        .limit(1)

      const [settings] = await db
        .select({ openaiApiKeyEncrypted: tenantSettings.openaiApiKeyEncrypted })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, organizationId))
        .limit(1)

      const key = settings?.openaiApiKeyEncrypted
        ? decrypt(settings.openaiApiKeyEncrypted)
        : undefined

      return { entry: found ?? null, openaiApiKey: key }
    })

    if (!entry) {
      return { status: 'not_found', entryId }
    }

    if (!openaiApiKey && !process.env.OPENAI_API_KEY) {
      return { status: 'skipped', reason: 'no_openai_key', entryId }
    }

    // Step 2: Generate embedding
    const embedding = await step.run('generate-embedding', async () => {
      const textToEmbed = `${entry.category}: ${entry.name}\n\n${entry.content}`
      return generateEmbedding(textToEmbed, openaiApiKey)
    })

    // Step 3: Save embedding
    await step.run('save-embedding', async () => {
      return db
        .update(proposalContentLibrary)
        .set({ embedding })
        .where(eq(proposalContentLibrary.id, entryId))
    })

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
      const events = unembedded.map((entry) => ({
        name: 'content-library/generate-embedding' as const,
        data: { entryId: entry.id, organizationId },
      }))
      await inngest.send(events)
    })

    return { status: 'queued', count: unembedded.length }
  }
)
