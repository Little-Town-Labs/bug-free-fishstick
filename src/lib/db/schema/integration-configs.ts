import { pgTable, text, boolean, uuid, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const integrationTypes = ['slack', 'salesforce', 'hubspot'] as const
export type IntegrationType = (typeof integrationTypes)[number]

export const integrationStatuses = ['active', 'error', 'requires_reconnect'] as const
export type IntegrationStatus = (typeof integrationStatuses)[number]

export const integrationConfigs = pgTable(
  'integration_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    integrationType: text('integration_type', { enum: integrationTypes }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    credentialsEncrypted: text('credentials_encrypted').notNull(),
    configJson: jsonb('config_json')
      .notNull()
      .$type<{
        notifyOnStatus?: string[]
        channelId?: string
        fieldMappings?: Record<string, string>
      }>()
      .default({}),
    status: text('status', { enum: integrationStatuses }).notNull().default('active'),
    lastVerifiedAt: timestamp('last_verified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('integration_configs_unique_idx').on(table.organizationId, table.integrationType),
    index('integration_configs_org_idx').on(table.organizationId),
  ]
)

export type IntegrationConfig = typeof integrationConfigs.$inferSelect
export type NewIntegrationConfig = typeof integrationConfigs.$inferInsert
