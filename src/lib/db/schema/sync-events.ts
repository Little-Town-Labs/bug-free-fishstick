import { pgTable, text, uuid, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { integrationConfigs } from './integration-configs'

export const syncEventStatuses = ['pending', 'success', 'failed', 'skipped'] as const
export type SyncEventStatus = (typeof syncEventStatuses)[number]

export const syncEventTypes = [
  'rfp_assigned',
  'approval_required',
  'rfp_approved',
  'rfp_returned',
  'rfp_won',
  'rfp_lost',
] as const
export type SyncEventType = (typeof syncEventTypes)[number]

export const syncEvents = pgTable(
  'sync_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    integrationConfigId: uuid('integration_config_id')
      .notNull()
      .references(() => integrationConfigs.id),
    integrationType: text('integration_type').notNull(),
    eventType: text('event_type').notNull(),
    referenceId: text('reference_id').notNull(),
    status: text('status', { enum: syncEventStatuses }).notNull().default('pending'),
    inngestEventId: text('inngest_event_id'),
    requestPayload: jsonb('request_payload').$type<Record<string, unknown>>(),
    responsePayload: jsonb('response_payload').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('sync_events_org_status_idx').on(table.organizationId, table.status),
    index('sync_events_reference_idx').on(table.referenceId),
    index('sync_events_org_idx').on(table.organizationId),
  ]
)

export type SyncEvent = typeof syncEvents.$inferSelect
export type NewSyncEvent = typeof syncEvents.$inferInsert
