import { db } from '@/lib/db'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import type { KnowledgeEntry } from '@/lib/db/schema/knowledge-entries'
import { customers } from '@/lib/db/schema/customers'
import type { Customer } from '@/lib/db/schema/customers'
import { learnings } from '@/lib/db/schema/learnings'
import { generateEmbedding } from '@/lib/ai/embeddings'
import type { KnowledgeEntryWithSimilarity } from '@/lib/services/vector-search'
import { eq, and, or, isNull, isNotNull, sql } from 'drizzle-orm'

// Re-export types consumed by F8
export type { KnowledgeEntryWithSimilarity } from '@/lib/services/vector-search'
export type { Learning } from '@/lib/db/schema/learnings'

// ─── Module constants ────────────────────────────────────────────────────────

const REQUIREMENT_SEARCH_CAP = 10
const RESULTS_PER_REQUIREMENT = 5

// ─── Exported types ──────────────────────────────────────────────────────────

export interface RequirementField {
  id: string
  question: string
  type?: string
}

export interface TypedSupplierContext {
  companyDocs: KnowledgeEntry[]
  certifications: KnowledgeEntry[]
  caseStudies: KnowledgeEntry[]
  wonPastRfps: KnowledgeEntry[]
}

export type CustomerContext = NonNullable<Customer['settings']> | null

// ─── searchByRequirements ────────────────────────────────────────────────────

/**
 * Performs one semantic similarity query per requirement field (capped at
 * REQUIREMENT_SEARCH_CAP), merges results, and deduplicates by entry ID —
 * keeping the instance with the highest similarity score.
 */
export async function searchByRequirements(
  fields: RequirementField[],
  orgId: string,
  openaiApiKey?: string
): Promise<KnowledgeEntryWithSimilarity[]> {
  if (!fields.length) return []
  if (!openaiApiKey && !process.env.OPENAI_API_KEY) return []

  const cappedFields = fields.slice(0, REQUIREMENT_SEARCH_CAP)

  const settled = await Promise.allSettled(
    cappedFields.map(async (field) => {
      const embedding = await generateEmbedding(field.question, openaiApiKey)
      const embeddingJson = JSON.stringify(embedding)

      return db
        .select({
          id: knowledgeEntries.id,
          organizationId: knowledgeEntries.organizationId,
          customerId: knowledgeEntries.customerId,
          type: knowledgeEntries.type,
          title: knowledgeEntries.title,
          content: knowledgeEntries.content,
          tags: knowledgeEntries.tags,
          metadata: knowledgeEntries.metadata,
          chunkIndex: knowledgeEntries.chunkIndex,
          totalChunks: knowledgeEntries.totalChunks,
          sectionHeading: knowledgeEntries.sectionHeading,
          sourceEntryId: knowledgeEntries.sourceEntryId,
          processingStatus: knowledgeEntries.processingStatus,
          createdAt: knowledgeEntries.createdAt,
          updatedAt: knowledgeEntries.updatedAt,
          similarity: sql<number>`1 - (${knowledgeEntries.embedding} <=> ${embeddingJson}::vector)`.as('similarity'),
        })
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.organizationId, orgId),
            isNotNull(knowledgeEntries.embedding)
          )
        )
        .orderBy(sql`${knowledgeEntries.embedding} <=> ${embeddingJson}::vector`)
        .limit(RESULTS_PER_REQUIREMENT)
    })
  )

  const dedupeMap = new Map<string, KnowledgeEntryWithSimilarity>()
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    for (const entry of result.value as KnowledgeEntryWithSimilarity[]) {
      const existing = dedupeMap.get(entry.id)
      if (!existing || entry.similarity > existing.similarity) {
        dedupeMap.set(entry.id, entry)
      }
    }
  }
  return Array.from(dedupeMap.values())
}

// ─── fetchTypedSupplierContext ───────────────────────────────────────────────

/**
 * Direct DB queries (no embeddings) for four knowledge entry types.
 * The past_rfp group additionally filters to outcome='won' and — when
 * industryTags is a non-empty array — to entries with overlapping tags.
 */
export async function fetchTypedSupplierContext(
  orgId: string,
  industryTags?: string[] | null,
   
  _rfpType?: string | null,
   
  _openaiApiKey?: string
): Promise<TypedSupplierContext> {
  const orgFilter = eq(knowledgeEntries.organizationId, orgId)

  const [companyDocsResult, certificationsResult, caseStudiesResult, wonPastRfpsResult] =
    await Promise.allSettled([
      db
        .select()
        .from(knowledgeEntries)
        .where(and(orgFilter, eq(knowledgeEntries.type, 'company_doc'))),
      db
        .select()
        .from(knowledgeEntries)
        .where(and(orgFilter, eq(knowledgeEntries.type, 'certification'))),
      db
        .select()
        .from(knowledgeEntries)
        .where(and(orgFilter, eq(knowledgeEntries.type, 'case_study'))),
      buildWonPastRfpsQuery(orgId, industryTags),
    ])

  return {
    companyDocs: companyDocsResult.status === 'fulfilled' ? companyDocsResult.value : [],
    certifications: certificationsResult.status === 'fulfilled' ? certificationsResult.value : [],
    caseStudies: caseStudiesResult.status === 'fulfilled' ? caseStudiesResult.value : [],
    wonPastRfps: wonPastRfpsResult.status === 'fulfilled' ? wonPastRfpsResult.value : [],
  }
}

function buildWonPastRfpsQuery(orgId: string, industryTags?: string[] | null) {
  const baseFilter = and(
    eq(knowledgeEntries.organizationId, orgId),
    eq(knowledgeEntries.type, 'past_rfp'),
    sql`${knowledgeEntries.metadata}->>'outcome' = 'won'`
  )

  if (industryTags && industryTags.length > 0) {
    const tagFilter = sql`${knowledgeEntries.tags} ?| array[${sql.join(
      industryTags.map((t) => sql`${t}`),
      sql`, `
    )}]`
    return db
      .select()
      .from(knowledgeEntries)
      .where(and(baseFilter, tagFilter))
  }

  return db.select().from(knowledgeEntries).where(baseFilter)
}

// ─── fetchCustomerContext ────────────────────────────────────────────────────

/**
 * Loads a customer's settings scoped strictly to orgId.
 * Returns null when the customer is not found or has no settings configured.
 */
export async function fetchCustomerContext(
  customerId: string,
  orgId: string
): Promise<CustomerContext> {
  const [customer] = await db
    .select({ settings: customers.settings })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.organizationId, orgId)))
    .limit(1)

  return customer?.settings ?? null
}

// ─── fetchLearnings ──────────────────────────────────────────────────────────

/**
 * Returns learnings for the organisation, ordered so customer-specific
 * entries appear before org-wide entries when customerId is provided.
 * When customerId is not provided, only org-wide learnings (null customerId)
 * are returned.
 */
export async function fetchLearnings(
  orgId: string,
  customerId?: string
): Promise<import('@/lib/db/schema/learnings').Learning[]> {
  const customerFilter = customerId
    ? or(eq(learnings.customerId, customerId), isNull(learnings.customerId))
    : isNull(learnings.customerId)

  const baseQuery = db
    .select()
    .from(learnings)
    .where(and(eq(learnings.organizationId, orgId), customerFilter))

  if (customerId) {
    return baseQuery.orderBy(
      sql`CASE WHEN ${learnings.customerId} = ${customerId} THEN 0 ELSE 1 END ASC`
    )
  }

  return baseQuery
}
