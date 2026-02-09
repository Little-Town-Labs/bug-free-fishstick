import { pgTable, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { rfps } from './rfps'

export const rfpVersions = pgTable(
  'rfp_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rfpId: uuid('rfp_id')
      .notNull()
      .references(() => rfps.id, { onDelete: 'cascade' }),

    versionNumber: integer('version_number').notNull(),
    createdBy: text('created_by').notNull(),

    // Snapshot of all responses at this version
    snapshot: jsonb('snapshot').$type<{
      responses: Array<{
        fieldId: string
        responseText: string
        status: string
      }>
      automationPercentage: number
    }>(),

    // Change summary
    changeSummary: text('change_summary'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('versions_rfp_idx').on(table.rfpId),
    index('versions_number_idx').on(table.rfpId, table.versionNumber),
  ]
)

export type RfpVersion = typeof rfpVersions.$inferSelect
export type NewRfpVersion = typeof rfpVersions.$inferInsert
