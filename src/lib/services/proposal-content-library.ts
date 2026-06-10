import { db } from '@/lib/db'
import { proposalContentLibrary } from '@/lib/db/schema'
import { eq, and, ilike, isNotNull, isNull } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { FIXED_SECTIONS } from '@/lib/constants/fixed-sections'
import type {
  ProposalContentLibraryEntry,
  NewProposalContentLibraryEntry,
} from '@/lib/db/schema/proposal-content-library'

export type { ProposalContentLibraryEntry }

// ─── ensureFixedSections ───────────────────────────────────────────────────
// Idempotent: concurrent calls may race but onConflictDoNothing + partial
// unique index (org_id, section_type) WHERE section_type IS NOT NULL
// guarantees exactly one row per section per org. After first call, subsequent
// calls are read-only (all sections already exist).

export async function ensureFixedSections(
  orgId: string,
  userId: string
): Promise<void> {
  const existing = await db
    .select({ sectionType: proposalContentLibrary.sectionType })
    .from(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.organizationId, orgId),
        isNotNull(proposalContentLibrary.sectionType)
      )
    )

  const existingTypes = new Set(existing.map((r) => r.sectionType))

  for (const section of FIXED_SECTIONS) {
    if (existingTypes.has(section.sectionType)) continue

    await db
      .insert(proposalContentLibrary)
      .values({
        organizationId: orgId,
        createdBy: userId,
        category: section.displayName,
        name: section.displayName,
        content: '',
        sectionType: section.sectionType,
      } satisfies Omit<NewProposalContentLibraryEntry, 'id' | 'createdAt' | 'updatedAt'>)
      .onConflictDoNothing()
  }
}

// ─── CRUD operations ───────────────────────────────────────────────────────

export async function createEntry(
  orgId: string,
  userId: string,
  data: { category: string; name: string; content: string }
): Promise<ProposalContentLibraryEntry> {
  const [entry] = await db
    .insert(proposalContentLibrary)
    .values({
      organizationId: orgId,
      createdBy: userId,
      category: data.category,
      name: data.name,
      content: data.content,
    } satisfies Omit<NewProposalContentLibraryEntry, 'id' | 'createdAt' | 'updatedAt'>)
    .returning()

  // Trigger embedding generation asynchronously
  await inngest.send({
    name: 'content-library/generate-embedding',
    data: { entryId: entry!.id, organizationId: orgId },
  })

  return entry!
}

export async function listEntries(
  orgId: string,
  categoryFilter?: string,
  typeFilter?: 'fixed' | 'custom'
): Promise<ProposalContentLibraryEntry[]> {
  const conditions = [eq(proposalContentLibrary.organizationId, orgId)]

  if (categoryFilter) {
    conditions.push(ilike(proposalContentLibrary.category, categoryFilter))
  }

  if (typeFilter === 'fixed') {
    conditions.push(isNotNull(proposalContentLibrary.sectionType))
  } else if (typeFilter === 'custom') {
    conditions.push(isNull(proposalContentLibrary.sectionType))
  }

  return db
    .select()
    .from(proposalContentLibrary)
    .where(and(...conditions))
}

export async function getEntry(
  id: string,
  orgId: string
): Promise<ProposalContentLibraryEntry> {
  const [entry] = await db
    .select()
    .from(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.id, id),
        eq(proposalContentLibrary.organizationId, orgId)
      )
    )
    .limit(1)

  if (!entry) {
    throw Object.assign(new Error('Content library entry not found'), { statusCode: 404 })
  }

  return entry
}

export async function updateEntry(
  id: string,
  orgId: string,
  patch: Partial<{ category: string; name: string; content: string }>
): Promise<ProposalContentLibraryEntry> {
  const entry = await getEntry(id, orgId)

  // Guard: fixed sections cannot have category or name changed
  if (entry.sectionType) {
    if (patch.category !== undefined || patch.name !== undefined) {
      throw Object.assign(
        new Error('Cannot change category or name of a fixed section'),
        { statusCode: 400 }
      )
    }
  }

  const [updated] = await db
    .update(proposalContentLibrary)
    .set({ ...patch, embedding: null, updatedAt: new Date() })
    .where(
      and(
        eq(proposalContentLibrary.id, id),
        eq(proposalContentLibrary.organizationId, orgId)
      )
    )
    .returning()

  // Re-generate embedding for updated content (skip if content is empty)
  if (updated!.content.trim()) {
    await inngest.send({
      name: 'content-library/generate-embedding',
      data: { entryId: id, organizationId: orgId },
    })
  }

  return updated!
}

export async function deleteEntry(id: string, orgId: string): Promise<void> {
  const entry = await getEntry(id, orgId)

  // Guard: fixed sections cannot be deleted
  if (entry.sectionType) {
    throw Object.assign(
      new Error('Fixed sections cannot be deleted'),
      { statusCode: 403 }
    )
  }

  await db
    .delete(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.id, id),
        eq(proposalContentLibrary.organizationId, orgId)
      )
    )
}
