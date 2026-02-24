import { db } from '@/lib/db'
import { proposalContentLibrary } from '@/lib/db/schema/proposal-content-library'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { sql, eq, and, isNotNull, ilike } from 'drizzle-orm'
import type { ProposalContentLibraryEntry } from '@/lib/db/schema/proposal-content-library'

export type ContentLibraryEntryWithSimilarity = Omit<ProposalContentLibraryEntry, 'embedding'> & {
  similarity: number
}

export async function searchContentLibrary(
  query: string,
  organizationId: string,
  limit: number = 5,
  openaiApiKey?: string
): Promise<ContentLibraryEntryWithSimilarity[]> {
  // Check if any entries have embeddings
  const embeddedCount = await db
    .select({ id: proposalContentLibrary.id })
    .from(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.organizationId, organizationId),
        isNotNull(proposalContentLibrary.embedding)
      )
    )
    .limit(1)

  if (embeddedCount.length === 0) {
    // Fallback: return all entries (no semantic ranking)
    return fallbackCategorySearch(organizationId, limit)
  }

  // If no OpenAI key is available, skip semantic search and use fallback
  if (!openaiApiKey && !process.env.OPENAI_API_KEY) {
    return fallbackCategorySearch(organizationId, limit)
  }

  let queryEmbedding: number[]
  try {
    queryEmbedding = await generateEmbedding(query, openaiApiKey)
  } catch {
    return fallbackCategorySearch(organizationId, limit)
  }

  const results = await db
    .select({
      id: proposalContentLibrary.id,
      organizationId: proposalContentLibrary.organizationId,
      category: proposalContentLibrary.category,
      name: proposalContentLibrary.name,
      content: proposalContentLibrary.content,
      createdBy: proposalContentLibrary.createdBy,
      createdAt: proposalContentLibrary.createdAt,
      updatedAt: proposalContentLibrary.updatedAt,
      similarity:
        sql<number>`1 - (${proposalContentLibrary.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`.as(
          'similarity'
        ),
    })
    .from(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.organizationId, organizationId),
        isNotNull(proposalContentLibrary.embedding)
      )
    )
    .orderBy(sql`${proposalContentLibrary.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
    .limit(limit)

  return results as ContentLibraryEntryWithSimilarity[]
}

async function fallbackCategorySearch(
  organizationId: string,
  limit: number
): Promise<ContentLibraryEntryWithSimilarity[]> {
  const results = await db
    .select({
      id: proposalContentLibrary.id,
      organizationId: proposalContentLibrary.organizationId,
      category: proposalContentLibrary.category,
      name: proposalContentLibrary.name,
      content: proposalContentLibrary.content,
      createdBy: proposalContentLibrary.createdBy,
      createdAt: proposalContentLibrary.createdAt,
      updatedAt: proposalContentLibrary.updatedAt,
    })
    .from(proposalContentLibrary)
    .where(eq(proposalContentLibrary.organizationId, organizationId))
    .limit(limit)

  return results.map((r) => ({ ...r, similarity: 0 }))
}

export async function searchContentLibraryByCategory(
  organizationId: string,
  category: string,
  limit: number = 10
): Promise<ProposalContentLibraryEntry[]> {
  return db
    .select()
    .from(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.organizationId, organizationId),
        ilike(proposalContentLibrary.category, category)
      )
    )
    .limit(limit)
}
