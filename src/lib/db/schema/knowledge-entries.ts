import { pgTable, text, timestamp, uuid, vector, index } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const knowledgeEntries = pgTable(
  'knowledge_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    customerId: uuid('customer_id').references(() => customers.id),
    title: text('title').notNull(),
    content: text('content').notNull(),
    type: text('type').notNull(), // 'rfp_response', 'case_study', 'certification', 'document'
    sourceUrl: text('source_url'),
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: text('metadata'), // JSON string for additional data
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('knowledge_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops'))]
)

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert
