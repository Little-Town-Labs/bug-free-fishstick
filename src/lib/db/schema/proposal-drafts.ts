import { pgTable, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { rfps } from './rfps'

export const proposalDraftStatuses = [
  'awaiting_answers',
  'generating',
  'draft',
  'finalized',
  'error',
] as const
export type ProposalDraftStatus = (typeof proposalDraftStatuses)[number]

export interface ClarifyingQuestion {
  id: string
  question: string
  rfpSection: string
  answer: string | null
}

export interface CoverageRequirement {
  requirementId: string
  question: string
  addressed: boolean
  evidence: string | null
  gap: string | null
}

export interface CoverageReport {
  coverageScore: number
  evaluatedAt: string
  requirements: CoverageRequirement[]
}

export const proposalDrafts = pgTable(
  'proposal_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rfpId: uuid('rfp_id').notNull().references(() => rfps.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').notNull(),
    createdBy: text('created_by').notNull(),
    status: text('status', { enum: proposalDraftStatuses })
      .notNull()
      .default('awaiting_answers'),
    clarifyingQuestions: jsonb('clarifying_questions')
      .$type<ClarifyingQuestion[]>(),
    markdownContent: text('markdown_content'),
    generationError: text('generation_error'),
    version: integer('version').notNull().default(1),
    coverageReport: jsonb('coverage_report').$type<CoverageReport>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('proposal_drafts_rfp_idx').on(table.rfpId),
    index('proposal_drafts_org_idx').on(table.organizationId),
  ]
)

export type ProposalDraft = typeof proposalDrafts.$inferSelect
export type NewProposalDraft = typeof proposalDrafts.$inferInsert
