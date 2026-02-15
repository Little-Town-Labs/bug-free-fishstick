import { pgTable, text, timestamp, uuid, real, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { rfps } from './rfps'

export const responseStatuses = ['auto_filled', 'needs_input', 'manually_filled', 'approved'] as const
export type ResponseStatus = (typeof responseStatuses)[number]

export const fieldTypes = ['text', 'paragraph', 'checkbox', 'table', 'date', 'number'] as const
export type FieldType = (typeof fieldTypes)[number]

export const rfpResponses = pgTable(
  'rfp_responses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rfpId: uuid('rfp_id')
      .notNull()
      .references(() => rfps.id, { onDelete: 'cascade' }),

    // Field identification
    fieldId: text('field_id').notNull(),
    fieldType: text('field_type', { enum: fieldTypes }).notNull(),
    question: text('question').notNull(),

    // Response content
    responseText: text('response_text'),
    confidenceScore: real('confidence_score'),
    status: text('status', { enum: responseStatuses }).notNull().default('needs_input'),

    // Position for overlay output
    position: jsonb('position').$type<{
      page: number
      x: number
      y: number
      width: number
      height: number
      fontSize?: number
    }>(),

    // AI generation metadata
    aiMetadata: jsonb('ai_metadata').$type<{
      originalResponse?: string
      sources?: string[]
      modelUsed?: string
      generatedAt?: string
    }>(),

    // Optimistic locking for real-time conflict detection
    version: integer('version').notNull().default(1),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('responses_rfp_idx').on(table.rfpId),
    index('responses_status_idx').on(table.status),
  ]
)

export type RfpResponse = typeof rfpResponses.$inferSelect
export type NewRfpResponse = typeof rfpResponses.$inferInsert
