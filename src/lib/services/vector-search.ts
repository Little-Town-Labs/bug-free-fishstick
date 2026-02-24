import { db } from '@/lib/db'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { sql, eq, and, isNotNull, isNull, or } from 'drizzle-orm'
import type { KnowledgeEntry } from '@/lib/db/schema/knowledge-entries'

export type KnowledgeEntryWithSimilarity = Omit<KnowledgeEntry, 'embedding'> & {
  similarity: number
}

export async function searchSimilar(
  query: string,
  organizationId: string,
  limit: number = 10,
  customerId?: string,
  openaiApiKey?: string
): Promise<KnowledgeEntryWithSimilarity[]> {
  // If no OpenAI key is available, embeddings won't work — skip silently
  if (!openaiApiKey && !process.env.OPENAI_API_KEY) return []

  let queryEmbedding: number[]
  try {
    queryEmbedding = await generateEmbedding(query, openaiApiKey)
  } catch {
    return []
  }

  const customerFilter = customerId
    ? or(eq(knowledgeEntries.customerId, customerId), isNull(knowledgeEntries.customerId))
    : isNull(knowledgeEntries.customerId)

  const results = await db
    .select({
      id: knowledgeEntries.id,
      organizationId: knowledgeEntries.organizationId,
      customerId: knowledgeEntries.customerId,
      type: knowledgeEntries.type,
      title: knowledgeEntries.title,
      content: knowledgeEntries.content,
      metadata: knowledgeEntries.metadata,
      createdAt: knowledgeEntries.createdAt,
      updatedAt: knowledgeEntries.updatedAt,
      similarity:
        sql<number>`1 - (${knowledgeEntries.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`.as(
          'similarity'
        ),
    })
    .from(knowledgeEntries)
    .where(
      and(
        eq(knowledgeEntries.organizationId, organizationId),
        customerFilter,
        isNotNull(knowledgeEntries.embedding)
      )
    )
    .orderBy(sql`${knowledgeEntries.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
    .limit(limit)

  return results as KnowledgeEntryWithSimilarity[]
}
