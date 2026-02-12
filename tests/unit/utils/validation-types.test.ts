import { describe, it, expect } from 'vitest'
import {
  createRfpSchema,
  type CreateRfpInput,
  updateRfpSchema,
  type UpdateRfpInput,
  createCustomerSchema,
  type CreateCustomerInput,
  createKnowledgeEntrySchema,
  type CreateKnowledgeEntryInput,
  updateTenantSettingsSchema,
  type UpdateTenantSettingsInput,
  createLearningSchema,
  type CreateLearningInput,
  knowledgeSearchSchema,
  type KnowledgeSearchInput,
} from '@/lib/utils/validation'

describe('Validation type inference', () => {
  it('should infer CreateRfpInput type correctly', () => {
    const input: CreateRfpInput = {
      name: 'Test RFP',
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      customerCompanyName: 'Acme Corp',
      customerContactInfo: {
        email: 'test@example.com',
      },
    }

    const result = createRfpSchema.parse(input)
    expect(result.name).toBe('Test RFP')
  })

  it('should infer UpdateRfpInput type correctly', () => {
    const input: UpdateRfpInput = {
      name: 'Updated RFP',
      assignedUserId: 'user_123',
    }

    const result = updateRfpSchema.parse(input)
    expect(result.name).toBe('Updated RFP')
  })

  it('should infer CreateCustomerInput type correctly', () => {
    const input: CreateCustomerInput = {
      name: 'Test Customer',
      settings: {
        preferredTone: 'formal',
        industryContext: 'Healthcare',
      },
    }

    const result = createCustomerSchema.parse(input)
    expect(result.name).toBe('Test Customer')
  })

  it('should infer CreateKnowledgeEntryInput type correctly', () => {
    const input: CreateKnowledgeEntryInput = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'case_study',
      title: 'Test Entry',
      content: 'Content',
      metadata: {
        tags: ['tag1', 'tag2'],
      },
    }

    const result = createKnowledgeEntrySchema.parse(input)
    expect(result.type).toBe('case_study')
  })

  it('should infer UpdateTenantSettingsInput type correctly', () => {
    const input: UpdateTenantSettingsInput = {
      llmProvider: 'claude',
      confidenceThreshold: 0.8,
      autoLearnEnabled: true,
    }

    const result = updateTenantSettingsSchema.parse(input)
    expect(result.llmProvider).toBe('claude')
  })

  it('should infer CreateLearningInput type correctly', () => {
    const input: CreateLearningInput = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Learning content',
    }

    const result = createLearningSchema.parse(input)
    expect(result.content).toBe('Learning content')
  })

  it('should infer KnowledgeSearchInput type correctly', () => {
    const input: KnowledgeSearchInput = {
      query: 'search term',
      limit: 20,
    }

    const result = knowledgeSearchSchema.parse(input)
    expect(result.query).toBe('search term')
    expect(result.limit).toBe(20)
  })

  it('should allow partial UpdateRfpInput', () => {
    const input: UpdateRfpInput = {}
    const result = updateRfpSchema.parse(input)
    expect(result).toEqual({})
  })

  it('should allow partial UpdateTenantSettingsInput', () => {
    const input: UpdateTenantSettingsInput = {
      confidenceThreshold: 0.9,
    }
    const result = updateTenantSettingsSchema.parse(input)
    expect(result.confidenceThreshold).toBe(0.9)
  })

  it('should allow null customerId in CreateLearningInput', () => {
    const input: CreateLearningInput = {
      customerId: null,
      content: 'General learning',
    }
    const result = createLearningSchema.parse(input)
    expect(result.customerId).toBeNull()
  })
})
