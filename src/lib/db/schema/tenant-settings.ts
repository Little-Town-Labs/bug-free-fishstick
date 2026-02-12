import { pgTable, text, real, boolean, timestamp } from 'drizzle-orm/pg-core'

export const llmProviders = ['claude', 'openai', 'azure'] as const
export type LlmProvider = (typeof llmProviders)[number]

export const tenantSettings = pgTable('tenant_settings', {
  organizationId: text('organization_id').primaryKey(),

  // LLM configuration
  llmProvider: text('llm_provider', { enum: llmProviders }).notNull().default('claude'),
  llmApiKeyEncrypted: text('llm_api_key_encrypted'),
  openaiApiKeyEncrypted: text('openai_api_key_encrypted'),
  anthropicApiKeyEncrypted: text('anthropic_api_key_encrypted'),

  // AI behavior settings
  confidenceThreshold: real('confidence_threshold').notNull().default(0.7),
  autoLearnEnabled: boolean('auto_learn_enabled').notNull().default(true),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type TenantSetting = typeof tenantSettings.$inferSelect
export type NewTenantSetting = typeof tenantSettings.$inferInsert
