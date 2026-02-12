import { z } from 'zod'

// NOTE: Zod v4 uses z.string().uuid() not z.string().cuid2()
// Our DB uses UUIDs, so validate with z.string().uuid()

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
 * Schema for updating tenant settings
 */
export const updateTenantSettingsSchema = z.object({
  llmProvider: z.enum(['claude', 'openai', 'azure']).optional(),
  llmApiKey: z.string().min(1).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  autoLearnEnabled: z.boolean().optional(),
})

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>

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
