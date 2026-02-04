import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core'

export const tenantSettings = pgTable('tenant_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().unique(),
  defaultLlmProvider: text('default_llm_provider').default('anthropic'),
  llmApiKeyEncrypted: text('llm_api_key_encrypted'),
  brandingSettings: jsonb('branding_settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type TenantSetting = typeof tenantSettings.$inferSelect
export type NewTenantSetting = typeof tenantSettings.$inferInsert
