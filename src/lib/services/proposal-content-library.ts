import { db } from '@/lib/db'
import { proposalContentLibrary } from '@/lib/db/schema'
import { eq, and, ilike } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import type {
  ProposalContentLibraryEntry,
  NewProposalContentLibraryEntry,
} from '@/lib/db/schema/proposal-content-library'

export type { ProposalContentLibraryEntry }

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
  categoryFilter?: string
): Promise<ProposalContentLibraryEntry[]> {
  if (categoryFilter) {
    return db
      .select()
      .from(proposalContentLibrary)
      .where(
        and(
          eq(proposalContentLibrary.organizationId, orgId),
          ilike(proposalContentLibrary.category, categoryFilter)
        )
      )
  }

  return db
    .select()
    .from(proposalContentLibrary)
    .where(eq(proposalContentLibrary.organizationId, orgId))
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
  // Validate ownership first
  await getEntry(id, orgId)

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

  // Re-generate embedding for updated content
  await inngest.send({
    name: 'content-library/generate-embedding',
    data: { entryId: id, organizationId: orgId },
  })

  return updated!
}

export async function deleteEntry(id: string, orgId: string): Promise<void> {
  // Validate ownership first
  await getEntry(id, orgId)

  await db
    .delete(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.id, id),
        eq(proposalContentLibrary.organizationId, orgId)
      )
    )
}
