import { db } from '@/lib/db'
import {
  proposalTemplates,
  proposalTemplateSections,
  type ProposalTemplate,
  type ProposalTemplateSection,
} from '@/lib/db/schema'
import { eq, and, asc, inArray, sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateProposalTemplateInput {
  section: ProposalTemplateSection
  title: string
  content: string
  isRequired?: boolean
  triggerRfpTypes?: string[] | null
  triggerIndustryTags?: string[] | null
  evaluateCoverage?: boolean
  sortOrder?: number
}

export interface UpdateProposalTemplateInput {
  title?: string
  content?: string
  isRequired?: boolean
  triggerRfpTypes?: string[] | null
  triggerIndustryTags?: string[] | null
  evaluateCoverage?: boolean
  sortOrder?: number
}

export interface ReorderItem {
  id: string
  sortOrder: number
}

// ---------------------------------------------------------------------------
// listProposalTemplates
// ---------------------------------------------------------------------------

export async function listProposalTemplates(orgId: string): Promise<ProposalTemplate[]> {
  const rows = await db
    .select()
    .from(proposalTemplates)
    .where(eq(proposalTemplates.organizationId, orgId))
    .orderBy(asc(proposalTemplates.section), asc(proposalTemplates.sortOrder))

  return rows
}

// ---------------------------------------------------------------------------
// listProposalTemplatesBySection
// ---------------------------------------------------------------------------

export async function listProposalTemplatesBySection(
  orgId: string
): Promise<Record<ProposalTemplateSection, ProposalTemplate[]>> {
  const flat = await listProposalTemplates(orgId)

  const grouped = proposalTemplateSections.reduce(
    (acc, section) => {
      acc[section] = []
      return acc
    },
    {} as Record<ProposalTemplateSection, ProposalTemplate[]>
  )

  for (const template of flat) {
    grouped[template.section as ProposalTemplateSection].push(template)
  }

  return grouped
}

// ---------------------------------------------------------------------------
// createProposalTemplate
// ---------------------------------------------------------------------------

export async function createProposalTemplate(
  orgId: string,
  createdBy: string,
  input: CreateProposalTemplateInput
): Promise<ProposalTemplate> {
  return await db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({ maxSort: sql<number>`COALESCE(MAX(${proposalTemplates.sortOrder}), -1)` })
      .from(proposalTemplates)
      .where(
        and(
          eq(proposalTemplates.organizationId, orgId),
          eq(proposalTemplates.section, input.section)
        )
      )
      .limit(1)

    const nextSortOrder = input.sortOrder ?? ((maxRow?.maxSort ?? -1) + 1)

    const [created] = await tx
      .insert(proposalTemplates)
      .values({
        organizationId: orgId,
        section: input.section,
        title: input.title,
        content: input.content,
        isRequired: input.isRequired ?? false,
        triggerRfpTypes: input.triggerRfpTypes ?? null,
        triggerIndustryTags: input.triggerIndustryTags ?? null,
        evaluateCoverage: input.evaluateCoverage ?? false,
        sortOrder: nextSortOrder,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return created
  })
}

// ---------------------------------------------------------------------------
// updateProposalTemplate
// ---------------------------------------------------------------------------

export async function updateProposalTemplate(
  orgId: string,
  templateId: string,
  input: UpdateProposalTemplateInput
): Promise<ProposalTemplate | null> {
  // Wrap in transaction to prevent TOCTOU race on the isRequired/evaluateCoverage
  // constraint — two concurrent PATCHes could both pass the guard independently.
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(proposalTemplates)
      .where(
        and(
          eq(proposalTemplates.id, templateId),
          eq(proposalTemplates.organizationId, orgId)
        )
      )

    if (!existing) return null

    const merged = { ...existing, ...input }

    if (merged.isRequired && merged.evaluateCoverage) {
      throw new Error('isRequired and evaluateCoverage cannot both be true')
    }

    const [updated] = await tx
      .update(proposalTemplates)
      .set({
        title: merged.title,
        content: merged.content,
        isRequired: merged.isRequired,
        triggerRfpTypes: merged.triggerRfpTypes,
        triggerIndustryTags: merged.triggerIndustryTags,
        evaluateCoverage: merged.evaluateCoverage,
        sortOrder: merged.sortOrder,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(proposalTemplates.id, templateId),
          eq(proposalTemplates.organizationId, orgId)
        )
      )
      .returning()

    return updated ?? null
  })
}

// ---------------------------------------------------------------------------
// deleteProposalTemplate
// ---------------------------------------------------------------------------

export async function deleteProposalTemplate(
  orgId: string,
  templateId: string
): Promise<boolean> {
  const deleted = await db
    .delete(proposalTemplates)
    .where(
      and(
        eq(proposalTemplates.id, templateId),
        eq(proposalTemplates.organizationId, orgId)
      )
    )
    .returning()

  return deleted.length > 0
}

// ---------------------------------------------------------------------------
// reorderProposalTemplates
// ---------------------------------------------------------------------------

export async function reorderProposalTemplates(
  orgId: string,
  items: ReorderItem[]
): Promise<void> {
  await db.transaction(async (tx) => {
    const ids = items.map((i) => i.id)

    const existing = await tx
      .select({ id: proposalTemplates.id })
      .from(proposalTemplates)
      .where(
        and(
          inArray(proposalTemplates.id, ids),
          eq(proposalTemplates.organizationId, orgId)
        )
      )

    if (existing.length !== ids.length) {
      throw new Error('INVALID_IDS')
    }

    // Single bulk UPDATE using a CASE expression — avoids N+1 round-trips.
    const updatedAt = new Date()
    let caseExpr = sql`CASE`
    for (const item of items) {
      caseExpr = sql`${caseExpr} WHEN ${proposalTemplates.id} = ${item.id}::uuid THEN ${item.sortOrder}`
    }
    caseExpr = sql`${caseExpr} END`

    await tx
      .update(proposalTemplates)
      .set({ sortOrder: caseExpr as unknown as number, updatedAt })
      .where(
        and(
          inArray(proposalTemplates.id, ids),
          eq(proposalTemplates.organizationId, orgId)
        )
      )
  })
}

// ---------------------------------------------------------------------------
// fetchTemplatesForPipeline
// ---------------------------------------------------------------------------

export async function fetchTemplatesForPipeline(
  orgId: string,
  input: { rfpType: string; industryTags: string[] }
): Promise<ProposalTemplate[]> {
  const rfpTypeJson = JSON.stringify([input.rfpType])
  const industryTagsJson = JSON.stringify(input.industryTags)

  const rows = await db
    .select()
    .from(proposalTemplates)
    .where(
      and(
        eq(proposalTemplates.organizationId, orgId),
        sql`(
          ${proposalTemplates.isRequired} = true
          OR ${proposalTemplates.triggerRfpTypes} @> ${rfpTypeJson}::jsonb
          OR ${proposalTemplates.triggerIndustryTags} && ${industryTagsJson}::jsonb
        )`
      )
    )
    .orderBy(asc(proposalTemplates.section), asc(proposalTemplates.sortOrder))

  return rows
}
