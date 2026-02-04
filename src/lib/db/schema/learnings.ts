import { pgTable, text, timestamp, uuid, real } from 'drizzle-orm/pg-core'
import { customers } from './customers'
import { rfps } from './rfps'

export const learnings = pgTable('learnings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  rfpId: uuid('rfp_id').references(() => rfps.id, { onDelete: 'set null' }),
  questionPattern: text('question_pattern').notNull(),
  approvedResponse: text('approved_response').notNull(),
  confidenceBoost: real('confidence_boost').default(0.1),
  usageCount: text('usage_count').default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Learning = typeof learnings.$inferSelect
export type NewLearning = typeof learnings.$inferInsert
