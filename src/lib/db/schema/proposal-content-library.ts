import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'

export const proposalContentLibrary = pgTable(
  'proposal_content_library',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('content_library_org_idx').on(table.organizationId),
    index('content_library_category_idx').on(table.organizationId, table.category),
  ]
)

export type ProposalContentLibraryEntry = typeof proposalContentLibrary.$inferSelect
export type NewProposalContentLibraryEntry = typeof proposalContentLibrary.$inferInsert
