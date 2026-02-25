import { pgTable, text, real, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const llmProviders = ['claude', 'openai', 'azure'] as const
export type LlmProvider = (typeof llmProviders)[number]

// ---------------------------------------------------------------------------
// JSONB types for rate card and proposal defaults
// ---------------------------------------------------------------------------

export interface RateCardDiscount {
  name: string
  type: 'percentage' | 'fixed'
  value: number
  appliesTo: 'subtotal' | 'total'
  customerIds: string[] | null
}

export interface RateCardRole {
  name: string
  unit: 'hour' | 'day' | 'fixed'
  rate: number
}

export interface RateCard {
  mode: 'blended' | 'by_role'
  blendedRate: number | null
  roles: RateCardRole[]
  defaultMarginPct: number
  currency: string
  discounts: RateCardDiscount[]
}

export interface ProposalDefaults {
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: number
  warrantyPeriodDays: number
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

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

  // Bid engine — pricing configuration
  rateCard: jsonb('rate_card').$type<RateCard>(),
  proposalDefaults: jsonb('proposal_defaults').$type<ProposalDefaults>(),
  // Plain markdown/text blob authored by org admins describing the company for
  // proposal preambles. Intentionally unstructured text (not JSONB) so admins
  // can write freeform prose without a schema. Max ~10 000 chars enforced at
  // the API layer via updateTenantSettingsSchema.
  companyProfile: text('company_profile'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type TenantSetting = typeof tenantSettings.$inferSelect
export type NewTenantSetting = typeof tenantSettings.$inferInsert
