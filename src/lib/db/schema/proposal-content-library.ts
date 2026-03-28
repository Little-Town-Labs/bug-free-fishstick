import { pgTable, text, timestamp, uuid, index, uniqueIndex, vector } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const proposalContentLibrary = pgTable(
  'proposal_content_library',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    sectionType: text('section_type'),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('content_library_org_idx').on(table.organizationId),
    index('content_library_category_idx').on(table.organizationId, table.category),
    index('content_library_section_type_idx').on(table.organizationId, table.sectionType),
    uniqueIndex('content_library_org_section_type_uniq')
      .on(table.organizationId, table.sectionType)
      .where(sql`section_type IS NOT NULL`),
  ]
)

export type ProposalContentLibraryEntry = typeof proposalContentLibrary.$inferSelect
export type NewProposalContentLibraryEntry = typeof proposalContentLibrary.$inferInsert
