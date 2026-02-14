import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import { eq } from 'drizzle-orm'
import { chunkDocument } from '@/lib/services/document-chunker'

export const chunkDocumentFunction = inngest.createFunction(
  { id: 'chunk-document', name: 'Chunk Knowledge Document' },
  { event: 'knowledge/chunk-document' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'knowledge/chunk-document'>) => {
    const { knowledgeEntryId, organizationId, customerId } = event.data

    // Step 1: Fetch parent entry
    const parentEntry = await step.run('fetch-parent', async () => {
      const [entry] = await db
        .select()
        .from(knowledgeEntries)
        .where(eq(knowledgeEntries.id, knowledgeEntryId))
        .limit(1)

      if (!entry) throw new Error(`Knowledge entry not found: ${knowledgeEntryId}`)
      return entry
    })

    // Step 2: Update status to chunking
    await step.run('set-chunking-status', async () => {
      await db
        .update(knowledgeEntries)
        .set({ processingStatus: 'chunking' })
        .where(eq(knowledgeEntries.id, knowledgeEntryId))
    })

    // Step 3: Chunk the document
    const chunks = await step.run('chunk-document', async () => {
      return chunkDocument(parentEntry.content)
    })

    // Step 4: Insert child entries
    const childIds = await step.run('insert-chunks', async () => {
      if (chunks.length <= 1) {
        // No chunking needed — just mark complete
        await db
          .update(knowledgeEntries)
          .set({ processingStatus: 'complete', totalChunks: 1, chunkIndex: 0 })
          .where(eq(knowledgeEntries.id, knowledgeEntryId))
        return []
      }

      const ids: string[] = []
      for (const chunk of chunks) {
        const [child] = await db
          .insert(knowledgeEntries)
          .values({
            organizationId,
            customerId: customerId ?? null,
            type: parentEntry.type,
            title: chunk.sectionHeading
              ? `${parentEntry.title} — ${chunk.sectionHeading}`
              : `${parentEntry.title} (chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks})`,
            content: chunk.content,
            sourceEntryId: knowledgeEntryId,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            sectionHeading: chunk.sectionHeading,
            processingStatus: 'embedding',
          })
          .returning()

        if (child) ids.push(child.id)
      }

      // Update parent with chunk count
      await db
        .update(knowledgeEntries)
        .set({ processingStatus: 'embedding', totalChunks: chunks.length })
        .where(eq(knowledgeEntries.id, knowledgeEntryId))

      return ids
    })

    // Step 5: Fan out embedding generation for each chunk
    if (childIds.length > 0) {
      await step.run('fan-out-embeddings', async () => {
        const events = childIds.map(id => ({
          name: 'rfp/generate-embeddings' as const,
          data: {
            knowledgeEntryId: id,
            organizationId,
            content: '', // The embedding function re-fetches content
          },
        }))
        await inngest.send(events)
      })
    }

    // Step 6: Mark parent as complete
    await step.run('mark-complete', async () => {
      await db
        .update(knowledgeEntries)
        .set({ processingStatus: 'complete' })
        .where(eq(knowledgeEntries.id, knowledgeEntryId))
    })

    return { parentId: knowledgeEntryId, chunkCount: chunks.length, childIds }
  }
)
