import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { rfps, proposalDrafts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { searchSimilar } from '@/lib/services/vector-search'
import { searchContentLibrary } from '@/lib/services/content-library-search'
import { listEntries } from '@/lib/services/proposal-content-library'
import { writeProposal } from '@/lib/ai/agents/proposal-writer'
import { updateDraftContent } from '@/lib/services/proposal-draft'

export const generateProposal = inngest.createFunction(
  { id: 'generate-proposal', name: 'Generate Proposal Draft' },
  { event: 'proposal/generate' },
  async ({
    event,
    step,
  }: GetFunctionInput<typeof inngest, 'proposal/generate'>) => {
    const { draftId, rfpId, organizationId } = event.data

    try {
      // Step 1: Fetch draft and RFP
      const { draft, rfp } = await step.run('fetch-draft-and-rfp', async () => {
        const [d] = await db
          .select()
          .from(proposalDrafts)
          .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, organizationId)))
          .limit(1)

        const [r] = await db
          .select()
          .from(rfps)
          .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, organizationId)))
          .limit(1)

        return { draft: d, rfp: r }
      })

      if (!draft || !rfp) {
        throw new Error('Draft or RFP not found')
      }

      // Step 2: Search knowledge base for relevant context
      const knowledgeContext = await step.run('search-knowledge-base', async () => {
        const rfpText = rfp.name
        return searchSimilar(rfpText, organizationId, 10)
      })

      // Step 3: Search content library using semantic search (fallback to listing all)
      const contentLibraryEntries = await step.run('fetch-content-library', async () => {
        const query = rfp.name
        const results = await searchContentLibrary(query, organizationId, 5)
        if (results.length > 0) return results

        // Fallback to listing all entries if no semantic results
        const all = await listEntries(organizationId)
        return all.slice(0, 10).map(e => ({ ...e, similarity: 0 }))
      })

      // Step 4: Build RFP sections from parsed structure
      const rfpSections = rfp.parsedStructure
        ? rfp.parsedStructure.fields.map(f => ({
            title: f.question,
            content: f.question,
          }))
        : [{ title: rfp.name, content: rfp.name }]

      // Step 5: Generate the proposal
      const { markdownContent } = await step.run('generate-proposal-content', async () => {
        return writeProposal({
          rfpSections,
          knowledgeContext: knowledgeContext.map(k => ({
            content: k.content,
            source: k.title ?? 'knowledge base',
          })),
          contentLibraryEntries: contentLibraryEntries.map(e => ({
            id: e.id,
            name: e.name,
            category: e.category,
            content: e.content,
            similarity: 'similarity' in e ? (e as { similarity: number }).similarity : undefined,
          })),
          clarifyingAnswers: draft.clarifyingQuestions ?? [],
          organizationId,
        })
      })

      // Step 6: Save the result
      await step.run('save-proposal-content', async () => {
        return updateDraftContent(draftId, organizationId, markdownContent)
      })

      return { draftId, status: 'draft' }
    } catch (err) {
      // On any failure: set draft to error state with the error message
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during generation'
      await db
        .update(proposalDrafts)
        .set({ status: 'error', generationError: errorMessage, updatedAt: new Date() })
        .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, organizationId)))

      return { draftId, status: 'error', error: errorMessage }
    }
  }
)
