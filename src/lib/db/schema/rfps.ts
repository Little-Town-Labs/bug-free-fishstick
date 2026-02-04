import { pgTable, text, timestamp, uuid, integer, jsonb } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const rfps = pgTable('rfps', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'), // 'draft', 'processing', 'review', 'submitted', 'approved', 'finalized'
  originalFileUrl: text('original_file_url'),
  originalFileName: text('original_file_name'),
  completedFileUrl: text('completed_file_url'),
  totalFields: integer('total_fields').default(0),
  completedFields: integer('completed_fields').default(0),
  flaggedFields: integer('flagged_fields').default(0),
  dueDate: timestamp('due_date'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Rfp = typeof rfps.$inferSelect
export type NewRfp = typeof rfps.$inferInsert
