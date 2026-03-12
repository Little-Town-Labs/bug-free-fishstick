import { z } from 'zod'

// NOTE: Zod v4 uses z.string().uuid() not z.string().cuid2()
// Our DB uses UUIDs, so validate with z.string().uuid()

// Zod v4 compatibility shim: add `.errors` alias for `.issues` on ZodError.
// Zod v3 exposed `ZodError.errors`; Zod v4 renamed it to `ZodError.issues`.
// This shim restores the `.errors` getter so code and tests written for v3
// continue to work without modification.
;(function patchZodErrorCompat() {
  const sentinel = z.string().safeParse(0)
  if (!sentinel.success && sentinel.error) {
    const proto = Object.getPrototypeOf(sentinel.error) as object
    if (!Object.getOwnPropertyDescriptor(proto, 'errors')) {
      Object.defineProperty(proto, 'errors', {
        get(this: { issues: unknown }) { return this.issues },
        configurable: true,
        enumerable: false,
      })
    }
  }
})()

/**
 * Schema for creating a new RFP
 */
export const createRfpSchema = z.object({
  name: z.string().min(1).max(255),
  customerId: z.string().uuid(),
  customerCompanyName: z.string().max(255).optional(),
  customerContactName: z.string().max(255).optional(),
  customerContactInfo: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(500).optional(),
    })
    .optional(),
  receiveDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
})

export type CreateRfpInput = z.infer<typeof createRfpSchema>

/**
 * Schema for updating an existing RFP
 */
export const updateRfpSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  customerCompanyName: z.string().max(255).optional(),
  customerContactName: z.string().max(255).optional(),
  customerContactInfo: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(500).optional(),
    })
    .optional(),
  dueDate: z.string().date().optional(),
  assignedUserId: z.string().optional(),
})

export type UpdateRfpInput = z.infer<typeof updateRfpSchema>

/**
 * Schema for updating an RFP response
 */
export const updateResponseSchema = z.object({
  responseText: z.string().max(50000),
  status: z.enum(['auto_filled', 'needs_input', 'manually_filled', 'approved']),
})

export type UpdateResponseInput = z.infer<typeof updateResponseSchema>

/**
 * Schema for creating a new customer
 */
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  settings: z
    .object({
      preferredTone: z.enum(['formal', 'casual', 'technical']).optional(),
      industryContext: z.string().max(500).optional(),
      customInstructions: z.string().max(2000).optional(),
    })
    .optional(),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>

/**
 * Schema for updating an existing customer
 */
export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  settings: z
    .object({
      preferredTone: z.enum(['formal', 'casual', 'technical']).optional(),
      industryContext: z.string().max(500).optional(),
      customInstructions: z.string().max(2000).optional(),
    })
    .optional(),
})

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>

/**
 * Schema for creating a new knowledge entry
 */
export const createKnowledgeEntrySchema = z.object({
  customerId: z.string().uuid(),
  type: z.enum(['past_rfp', 'case_study', 'certification', 'company_doc', 'manual_entry']),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(500000),
  metadata: z
    .object({
      tags: z.array(z.string().max(50)).max(20).optional(),
    })
    .optional(),
})

export type CreateKnowledgeEntryInput = z.infer<typeof createKnowledgeEntrySchema>

/**
 * Schema for creating an org-level knowledge entry (no customerId)
 */
export const createOrgKnowledgeEntrySchema = z.object({
  type: z.enum(['past_rfp', 'case_study', 'certification', 'company_doc', 'manual_entry']),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(500000),
  metadata: z
    .object({
      tags: z.array(z.string().max(50)).max(20).optional(),
    })
    .optional(),
})

export type CreateOrgKnowledgeEntryInput = z.infer<typeof createOrgKnowledgeEntrySchema>

/**
 * Schema for creating a new learning entry
 */
export const createLearningSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(10000),
})

export type CreateLearningInput = z.infer<typeof createLearningSchema>

/**
 * Schema for searching knowledge entries
 */
export const knowledgeSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(50).default(10),
})

export type KnowledgeSearchInput = z.infer<typeof knowledgeSearchSchema>

// ---------------------------------------------------------------------------
// Proposal Bid Engine — Zod validation schemas
// ---------------------------------------------------------------------------

/**
 * A single role entry within a RateCard.
 */
export const rateCardRoleSchema = z.object({
  name: z.string().min(1),
  unit: z.enum(['hour', 'day', 'fixed']),
  rate: z.number().positive(),
}).strict()

export type RateCardRoleInput = z.infer<typeof rateCardRoleSchema>

/**
 * A discount rule within a RateCard.
 */
export const rateCardDiscountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['percentage', 'fixed']),
  // Percentage discounts use decimal fractions (0.15 = 15%). Fixed discounts
  // are currency amounts. The refine below enforces the decimal ≤ 1 constraint
  // for percentage type to prevent 150% discounts from silently passing.
  value: z.number().nonnegative(),
  appliesTo: z.enum(['subtotal', 'total']),
  customerIds: z.array(z.string()).nullable(),
}).strict()
  .refine(
    (d) => d.type !== 'percentage' || d.value <= 1,
    { message: 'Percentage discount value must be a decimal fraction ≤ 1 (e.g. 0.15 for 15%)', path: ['value'] }
  )
  .refine(
    (d) => d.customerIds === null || d.customerIds.length > 0,
    { message: 'customerIds must be null (universal) or a non-empty array; empty array is not valid', path: ['customerIds'] }
  )

export type RateCardDiscountInput = z.infer<typeof rateCardDiscountSchema>

/**
 * Schema for RateCard — the supplier's pricing rate configuration.
 * Strict mode: no extra keys allowed.
 */
export const rateCardSchema = z.object({
  mode: z.enum(['blended', 'by_role']),
  blendedRate: z.number().positive().nullable(),
  blendedRateUnit: z.enum(['hour', 'day', 'fixed']).nullable(),
  roles: z.array(rateCardRoleSchema),
  defaultMarginPct: z.number().min(0).max(1),
  currency: z.string().regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code (e.g. USD)'),
  discounts: z.array(rateCardDiscountSchema),
}).strict()
  .refine(
    (d) => d.mode !== 'blended' || (d.blendedRate !== null && d.blendedRate > 0),
    { message: 'blendedRate is required and must be positive when mode is blended', path: ['blendedRate'] }
  )
  .refine(
    (d) => d.mode !== 'blended' || d.blendedRateUnit !== null,
    { message: 'blendedRateUnit is required when mode is blended', path: ['blendedRateUnit'] }
  )
  .refine(
    (d) => d.mode !== 'by_role' || d.roles.length > 0,
    { message: 'at least one role is required when mode is by_role', path: ['roles'] }
  )

export type RateCardInput = z.infer<typeof rateCardSchema>

/**
 * Schema for ProposalDefaults — org-level pricing model defaults.
 * Strict mode: no extra keys allowed.
 */
export const proposalDefaultsSchema = z.object({
  pricingModel: z.enum(['time_and_materials', 'fixed_price', 'cost_plus']),
  paymentTermsDays: z.number().int().nonnegative(),
  warrantyPeriodDays: z.number().int().nonnegative(),
}).strict()

export type ProposalDefaultsInput = z.infer<typeof proposalDefaultsSchema>

/**
 * Schema for the PATCH /api/settings/rate-card request body.
 * Both rateCard and proposalDefaults are required (full replacement semantics).
 */
export const createRateCardPatchSchema = z.object({
  rateCard: rateCardSchema,
  proposalDefaults: proposalDefaultsSchema,
})

export type CreateRateCardPatchInput = z.infer<typeof createRateCardPatchSchema>

/**
 * Schema for updating tenant settings.
 * Placed after bid engine schemas so rateCardSchema / proposalDefaultsSchema
 * are in scope at the point of declaration.
 */
export const updateTenantSettingsSchema = z.object({
  llmProvider: z.enum(['claude', 'openai', 'azure']).optional(),
  llmApiKey: z.string().min(1).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  autoLearnEnabled: z.boolean().optional(),
  // Bid engine fields — complete the validation contract before API routes exist.
  rateCard: rateCardSchema.nullable().optional(),
  proposalDefaults: proposalDefaultsSchema.nullable().optional(),
  companyProfile: z.string().max(10000).nullable().optional(),
})

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>

export const updateCompanyProfileSchema = z.object({
  companyProfile: z.string().max(10000).nullable(),
})
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>

/**
 * A single requirement evaluation within a CoverageReport.
 */
export const coverageRequirementSchema = z.object({
  requirementId: z.string().min(1),
  question: z.string().min(1),
  addressed: z.boolean(),
  evidence: z.string().nullable(),
  gap: z.string().nullable(),
}).strict()

export type CoverageRequirementInput = z.infer<typeof coverageRequirementSchema>

/**
 * Schema for CoverageReport — output of the bid engine's coverage evaluation.
 * Strict mode: no extra keys allowed.
 */
export const coverageReportSchema = z.object({
  coverageScore: z.number().min(0).max(1),
  evaluatedAt: z.string().datetime(),
  requirements: z.array(coverageRequirementSchema),
}).strict()

export type CoverageReportInput = z.infer<typeof coverageReportSchema>

/**
 * Schema for ProposalTemplate section enum.
 * Exported as a standalone schema for reuse in forms and API routes.
 */
export const proposalTemplateSectionSchema = z.enum([
  'assumptions',
  'exclusions',
  'payment_terms',
  'change_management',
  'ip_ownership',
  'liability',
  'force_majeure',
  'warranty',
])

export type ProposalTemplateSectionInput = z.infer<typeof proposalTemplateSectionSchema>

/**
 * Schema for creating a new proposal template.
 * Enforces: isRequired and evaluateCoverage cannot both be true.
 */
export const createProposalTemplateSchema = z.object({
  section: proposalTemplateSectionSchema,
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50000),
  isRequired: z.boolean().default(false),
  triggerRfpTypes: z.array(z.string().min(1).max(100)).nullable().default(null),
  triggerIndustryTags: z.array(z.string().min(1).max(100)).nullable().default(null),
  evaluateCoverage: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
}).refine(
  (v) => !(v.isRequired && v.evaluateCoverage),
  { message: 'isRequired and evaluateCoverage cannot both be true', path: ['isRequired'] }
)

export type CreateProposalTemplateInput = z.infer<typeof createProposalTemplateSchema>

/**
 * Schema for updating an existing proposal template (all fields optional).
 * NOTE: section is validated against the enum if provided (invalid values are
 *       rejected at the schema boundary), but it is stripped from the output
 *       because section is immutable after creation — the API route ignores it.
 * NOTE: isRequired/evaluateCoverage constraint NOT enforced here — the service
 *       layer does a read-merge-validate check on the merged state.
 */
export const updateProposalTemplateSchema = z.object({
  section: proposalTemplateSectionSchema.optional(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(50000).optional(),
  isRequired: z.boolean().optional(),
  triggerRfpTypes: z.array(z.string().min(1).max(100)).nullable().optional(),
  triggerIndustryTags: z.array(z.string().min(1).max(100)).nullable().optional(),
  evaluateCoverage: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}).transform(({ section, ...rest }) => rest)

export type UpdateProposalTemplateInput = z.infer<typeof updateProposalTemplateSchema>

/**
 * Schema for reordering proposal templates within a section.
 */
export const reorderProposalTemplatesSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int(),
  })).min(1).max(500),
})

export type ReorderProposalTemplatesInput = z.infer<typeof reorderProposalTemplatesSchema>
