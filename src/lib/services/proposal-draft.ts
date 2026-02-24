import { db } from '@/lib/db'
import { rfps, proposalDrafts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { generateClarifyingQuestions } from '@/lib/ai/agents/proposal-question-generator'
import type {
  ProposalDraft,
  NewProposalDraft,
  ClarifyingQuestion,
} from '@/lib/db/schema/proposal-drafts'

export { ProposalDraft }

export async function createDraft(
  rfpId: string,
  orgId: string,
  userId: string
): Promise<ProposalDraft> {
  // Fetch RFP (scoped to org)
  const [rfp] = await db
    .select()
    .from(rfps)
    .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, orgId)))
    .limit(1)

  if (!rfp) {
    throw Object.assign(new Error('RFP not found'), { statusCode: 404 })
  }

  if (!rfp.parsedStructure) {
    throw Object.assign(new Error('RFP must be processed before generating a proposal'), {
      statusCode: 422,
    })
  }

  // Generate clarifying questions
  const { questions } = await generateClarifyingQuestions({
    rfpFields: rfp.parsedStructure.fields,
    rfpSummary: rfp.name,
    knowledgeTopics: [],
    contentLibraryCategories: [],
    organizationId: orgId,
  })

  // Persist draft
  const [draft] = await db
    .insert(proposalDrafts)
    .values({
      rfpId,
      organizationId: orgId,
      createdBy: userId,
      status: 'awaiting_answers',
      clarifyingQuestions: questions,
      version: 1,
    } satisfies Omit<NewProposalDraft, 'id' | 'createdAt' | 'updatedAt'>)
    .returning()

  return draft!
}

export async function submitAnswers(
  draftId: string,
  orgId: string,
  answers: Array<{ id: string; answer: string }>
): Promise<ProposalDraft> {
  const [draft] = await db
    .select()
    .from(proposalDrafts)
    .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
    .limit(1)

  if (!draft) {
    throw Object.assign(new Error('Draft not found'), { statusCode: 404 })
  }

  // Merge answers into questions
  const updatedQuestions: ClarifyingQuestion[] = (draft.clarifyingQuestions ?? []).map((q) => {
    const match = answers.find((a) => a.id === q.id)
    return match ? { ...q, answer: match.answer } : q
  })

  // Atomic conditional update — status predicate prevents double-submit race condition
  const [updated] = await db
    .update(proposalDrafts)
    .set({ status: 'generating', clarifyingQuestions: updatedQuestions, updatedAt: new Date() })
    .where(
      and(
        eq(proposalDrafts.id, draftId),
        eq(proposalDrafts.organizationId, orgId),
        eq(proposalDrafts.status, 'awaiting_answers')
      )
    )
    .returning()

  if (!updated) {
    throw Object.assign(new Error('Draft is not awaiting answers'), { statusCode: 409 })
  }

  // Fire Inngest event
  await inngest.send({
    name: 'proposal/generate',
    data: {
      draftId,
      rfpId: draft.rfpId,
      organizationId: orgId,
    },
  })

  return updated
}

export async function getDraft(draftId: string, orgId: string): Promise<ProposalDraft | null> {
  const [draft] = await db
    .select()
    .from(proposalDrafts)
    .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
    .limit(1)

  return draft ?? null
}

export async function listDrafts(rfpId: string, orgId: string): Promise<ProposalDraft[]> {
  return db
    .select()
    .from(proposalDrafts)
    .where(and(eq(proposalDrafts.rfpId, rfpId), eq(proposalDrafts.organizationId, orgId)))
}

export async function updateDraftContent(
  draftId: string,
  orgId: string,
  markdownContent: string
): Promise<ProposalDraft> {
  const [updated] = await db
    .update(proposalDrafts)
    .set({ status: 'draft', markdownContent, updatedAt: new Date() })
    .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
    .returning()

  if (!updated) {
    throw Object.assign(new Error('Draft not found or already deleted'), { statusCode: 404 })
  }

  return updated
}

export async function updateDraft(
  draftId: string,
  orgId: string,
  patch: { markdownContent?: string; status?: 'draft' | 'finalized' }
): Promise<ProposalDraft> {
  const [draft] = await db
    .select()
    .from(proposalDrafts)
    .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
    .limit(1)

  if (!draft) {
    throw Object.assign(new Error('Draft not found'), { statusCode: 404 })
  }

  if (draft.status === 'generating' || draft.status === 'awaiting_answers') {
    throw Object.assign(new Error('Cannot edit a draft that is still generating'), {
      statusCode: 409,
    })
  }

  const [updated] = await db
    .update(proposalDrafts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
    .returning()

  return updated!
}

export async function cancelDraft(draftId: string, orgId: string): Promise<ProposalDraft> {
  const [draft] = await db
    .select()
    .from(proposalDrafts)
    .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
    .limit(1)

  if (!draft) {
    throw Object.assign(new Error('Draft not found'), { statusCode: 404 })
  }

  if (draft.status !== 'generating') {
    throw Object.assign(new Error('Draft is not generating'), { statusCode: 409 })
  }

  const [updated] = await db
    .update(proposalDrafts)
    .set({ status: 'error', generationError: 'Cancelled by user', updatedAt: new Date() })
    .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
    .returning()

  return updated!
}
