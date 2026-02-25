import { pgTable, text, timestamp, uuid, integer, jsonb, boolean, index } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------

export const proposalTemplateSections = [
  'assumptions',
  'exclusions',
  'payment_terms',
  'change_management',
  'ip_ownership',
  'liability',
  'force_majeure',
  'warranty',
] as const
export type ProposalTemplateSection = (typeof proposalTemplateSections)[number]

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const proposalTemplates = pgTable(
  'proposal_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    section: text('section', { enum: proposalTemplateSections }).notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    isRequired: boolean('is_required').notNull().default(false),
    triggerRfpTypes: jsonb('trigger_rfp_types').$type<string[]>(),
    triggerIndustryTags: jsonb('trigger_industry_tags').$type<string[]>(),
    evaluateCoverage: boolean('evaluate_coverage').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('proposal_templates_org_idx').on(table.organizationId),
    index('proposal_templates_org_section_idx').on(table.organizationId, table.section),
    index('proposal_templates_org_required_idx').on(table.organizationId, table.isRequired),
  ]
)

export type ProposalTemplate = typeof proposalTemplates.$inferSelect
export type NewProposalTemplate = typeof proposalTemplates.$inferInsert
