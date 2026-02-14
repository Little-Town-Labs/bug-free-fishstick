import { pgTable, text, timestamp, uuid, jsonb, index, real } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const learningSourceTypes = [
  'rfp_approval',
  'user_correction',
  'manual_entry',
  'accept_signal',
  'edit_correction',
  'reject_signal',
] as const
export type LearningSourceType = (typeof learningSourceTypes)[number]

export const learnings = pgTable(
  'learnings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),

    // Learning content
    content: text('content').notNull(),
    sourceType: text('source_type', { enum: learningSourceTypes }).notNull(),
    createdBy: text('created_by').notNull(),

    // Response context
    fieldId: text('field_id'),
    questionType: text('question_type'),
    confidence: real('confidence'),

    // Source reference
    sourceMetadata: jsonb('source_metadata').$type<{
      rfpId?: string
      fieldId?: string
      originalText?: string
      correctedText?: string
    }>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('learnings_org_idx').on(table.organizationId),
    index('learnings_customer_idx').on(table.customerId),
  ]
)

export type Learning = typeof learnings.$inferSelect
export type NewLearning = typeof learnings.$inferInsert
