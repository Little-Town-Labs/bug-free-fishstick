import { pgTable, text, timestamp, uuid, real, boolean, integer, jsonb } from 'drizzle-orm/pg-core'
import { rfps } from './rfps'

export const rfpResponses = pgTable('rfp_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  rfpId: uuid('rfp_id')
    .references(() => rfps.id, { onDelete: 'cascade' })
    .notNull(),
  fieldId: text('field_id').notNull(),
  fieldLabel: text('field_label'),
  fieldType: text('field_type'), // 'text', 'textarea', 'checkbox', 'radio', 'select'
  originalValue: text('original_value'),
  generatedValue: text('generated_value'),
  finalValue: text('final_value'),
  confidenceScore: real('confidence_score'),
  requiresReview: boolean('requires_review').default(false),
  isApproved: boolean('is_approved').default(false),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  pageNumber: integer('page_number'),
  coordinates: jsonb('coordinates'), // { x, y, width, height }
  sourceReferences: jsonb('source_references'), // [{ knowledgeEntryId, relevanceScore }]
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type RfpResponse = typeof rfpResponses.$inferSelect
export type NewRfpResponse = typeof rfpResponses.$inferInsert
