import { pgTable, text, timestamp, uuid, vector, jsonb, index, integer } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const knowledgeEntryTypes = [
  'past_rfp',
  'case_study',
  'certification',
  'company_doc',
  'manual_entry',
] as const
export type KnowledgeEntryType = (typeof knowledgeEntryTypes)[number]

export const knowledgeEntries = pgTable(
  'knowledge_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    customerId: uuid('customer_id')
      .references(() => customers.id, { onDelete: 'set null' }),

    // Content
    type: text('type', { enum: knowledgeEntryTypes }).notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),

    // Vector embedding for semantic search (1536 dimensions)
    embedding: vector('embedding', { dimensions: 1536 }),

    // Chunking (for auto-indexed documents)
    chunkIndex: integer('chunk_index'),
    totalChunks: integer('total_chunks'),
    sectionHeading: text('section_heading'),
    tags: jsonb('tags').$type<string[]>(),
    sourceEntryId: uuid('source_entry_id'),
    processingStatus: text('processing_status', {
      enum: ['pending', 'chunking', 'embedding', 'complete', 'error'] as const,
    }).notNull().default('complete'),

    // Source metadata
    metadata: jsonb('metadata').$type<{
      sourceFile?: string
      sourceUrl?: string
      pageNumbers?: number[]
      tags?: string[]
    }>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('knowledge_org_idx').on(table.organizationId),
    index('knowledge_customer_idx').on(table.customerId),
    index('knowledge_source_entry_idx').on(table.sourceEntryId),
    index('knowledge_processing_idx').on(table.organizationId, table.processingStatus),
  ]
)

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert
