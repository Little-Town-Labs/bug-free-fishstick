import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core'
import { rfps } from './rfps'

export const rfpVersions = pgTable('rfp_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  rfpId: uuid('rfp_id')
    .references(() => rfps.id, { onDelete: 'cascade' })
    .notNull(),
  version: text('version').notNull(),
  status: text('status').notNull(),
  fileUrl: text('file_url'),
  changes: jsonb('changes'), // Array of change descriptions
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type RfpVersion = typeof rfpVersions.$inferSelect
export type NewRfpVersion = typeof rfpVersions.$inferInsert
