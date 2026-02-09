import { describe, it, expect } from 'vitest'
import {
  createRfpSchema,
  updateRfpSchema,
  updateResponseSchema,
  createCustomerSchema,
  createKnowledgeEntrySchema,
  updateTenantSettingsSchema,
  createLearningSchema,
  knowledgeSearchSchema,
} from '@/lib/utils/validation'

describe('createRfpSchema', () => {
  it('should validate valid RFP creation data', () => {
    const validData = {
      name: 'Test RFP',
      customerId: '550e8400-e29b-41d4-a716-446655440000',
    }
    expect(createRfpSchema.parse(validData)).toEqual(validData)
  })

  it('should validate RFP with all optional fields', () => {
    const validData = {
      name: 'Test RFP',
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      customerCompanyName: 'Acme Corp',
      customerContactName: 'John Doe',
      customerContactInfo: {
        email: 'john@acme.com',
        phone: '+1-555-1234',
        address: '123 Main St, City, State 12345',
      },
      receiveDate: '2026-01-15',
      dueDate: '2026-02-15',
    }
    expect(createRfpSchema.parse(validData)).toEqual(validData)
  })

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
      customerId: '550e8400-e29b-41d4-a716-446655440000',
    }
    expect(() => createRfpSchema.parse(invalidData)).toThrow()
  })

  it('should reject name longer than 255 characters', () => {
    const invalidData = {
      name: 'x'.repeat(256),
      customerId: '550e8400-e29b-41d4-a716-446655440000',
    }
    expect(() => createRfpSchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid UUID for customerId', () => {
    const invalidData = {
      name: 'Test RFP',
      customerId: 'not-a-uuid',
    }
    expect(() => createRfpSchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid email in customerContactInfo', () => {
    const invalidData = {
      name: 'Test RFP',
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      customerContactInfo: {
        email: 'not-an-email',
      },
    }
    expect(() => createRfpSchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid date format', () => {
    const invalidData = {
      name: 'Test RFP',
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      dueDate: '2026-13-45', // Invalid date
    }
    expect(() => createRfpSchema.parse(invalidData)).toThrow()
  })

  it('should accept missing optional fields', () => {
    const validData = {
      name: 'Test RFP',
      customerId: '550e8400-e29b-41d4-a716-446655440000',
    }
    const result = createRfpSchema.parse(validData)
    expect(result.customerCompanyName).toBeUndefined()
    expect(result.receiveDate).toBeUndefined()
  })
})

describe('updateRfpSchema', () => {
  it('should validate partial RFP update', () => {
    const validData = {
      name: 'Updated RFP',
    }
    expect(updateRfpSchema.parse(validData)).toEqual(validData)
  })

  it('should validate update with multiple fields', () => {
    const validData = {
      name: 'Updated RFP',
      customerCompanyName: 'New Company',
      dueDate: '2026-03-01',
      assignedUserId: 'user_123',
    }
    expect(updateRfpSchema.parse(validData)).toEqual(validData)
  })

  it('should accept empty object', () => {
    expect(updateRfpSchema.parse({})).toEqual({})
  })

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
    }
    expect(() => updateRfpSchema.parse(invalidData)).toThrow()
  })

  it('should validate customerContactInfo update', () => {
    const validData = {
      customerContactInfo: {
        email: 'newemail@example.com',
      },
    }
    expect(updateRfpSchema.parse(validData)).toEqual(validData)
  })
})

describe('updateResponseSchema', () => {
  it('should validate valid response update', () => {
    const validData = {
      responseText: 'This is the response text',
      status: 'auto_filled' as const,
    }
    expect(updateResponseSchema.parse(validData)).toEqual(validData)
  })

  it('should validate all status types', () => {
    const statuses = ['auto_filled', 'needs_input', 'manually_filled', 'approved'] as const
    statuses.forEach((status) => {
      const validData = {
        responseText: 'Test',
        status,
      }
      expect(updateResponseSchema.parse(validData)).toEqual(validData)
    })
  })

  it('should reject invalid status', () => {
    const invalidData = {
      responseText: 'Test',
      status: 'invalid_status',
    }
    expect(() => updateResponseSchema.parse(invalidData)).toThrow()
  })

  it('should reject responseText longer than 50000 characters', () => {
    const invalidData = {
      responseText: 'x'.repeat(50001),
      status: 'auto_filled',
    }
    expect(() => updateResponseSchema.parse(invalidData)).toThrow()
  })

  it('should accept empty responseText', () => {
    const validData = {
      responseText: '',
      status: 'needs_input' as const,
    }
    expect(updateResponseSchema.parse(validData)).toEqual(validData)
  })
})

describe('createCustomerSchema', () => {
  it('should validate minimal customer data', () => {
    const validData = {
      name: 'Test Customer',
    }
    expect(createCustomerSchema.parse(validData)).toEqual(validData)
  })

  it('should validate customer with all fields', () => {
    const validData = {
      name: 'Test Customer',
      description: 'A test customer for validation',
      settings: {
        preferredTone: 'formal' as const,
        industryContext: 'Healthcare',
        customInstructions: 'Always mention HIPAA compliance',
      },
    }
    expect(createCustomerSchema.parse(validData)).toEqual(validData)
  })

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
    }
    expect(() => createCustomerSchema.parse(invalidData)).toThrow()
  })

  it('should reject name longer than 255 characters', () => {
    const invalidData = {
      name: 'x'.repeat(256),
    }
    expect(() => createCustomerSchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid preferredTone', () => {
    const invalidData = {
      name: 'Test',
      settings: {
        preferredTone: 'invalid',
      },
    }
    expect(() => createCustomerSchema.parse(invalidData)).toThrow()
  })

  it('should validate all tone types', () => {
    const tones = ['formal', 'casual', 'technical'] as const
    tones.forEach((tone) => {
      const validData = {
        name: 'Test',
        settings: {
          preferredTone: tone,
        },
      }
      expect(createCustomerSchema.parse(validData)).toEqual(validData)
    })
  })

  it('should reject description longer than 1000 characters', () => {
    const invalidData = {
      name: 'Test',
      description: 'x'.repeat(1001),
    }
    expect(() => createCustomerSchema.parse(invalidData)).toThrow()
  })
})

describe('createKnowledgeEntrySchema', () => {
  it('should validate minimal knowledge entry', () => {
    const validData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'past_rfp' as const,
      title: 'Test Entry',
      content: 'This is the knowledge content',
    }
    expect(createKnowledgeEntrySchema.parse(validData)).toEqual(validData)
  })

  it('should validate all knowledge entry types', () => {
    const types = ['past_rfp', 'case_study', 'certification', 'company_doc', 'manual_entry'] as const
    types.forEach((type) => {
      const validData = {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        type,
        title: 'Test',
        content: 'Content',
      }
      expect(createKnowledgeEntrySchema.parse(validData)).toEqual(validData)
    })
  })

  it('should validate with metadata', () => {
    const validData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'case_study' as const,
      title: 'Test Entry',
      content: 'Content',
      metadata: {
        tags: ['tag1', 'tag2', 'tag3'],
      },
    }
    expect(createKnowledgeEntrySchema.parse(validData)).toEqual(validData)
  })

  it('should reject empty title', () => {
    const invalidData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'past_rfp',
      title: '',
      content: 'Content',
    }
    expect(() => createKnowledgeEntrySchema.parse(invalidData)).toThrow()
  })

  it('should reject empty content', () => {
    const invalidData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'past_rfp',
      title: 'Test',
      content: '',
    }
    expect(() => createKnowledgeEntrySchema.parse(invalidData)).toThrow()
  })

  it('should reject content longer than 500000 characters', () => {
    const invalidData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'past_rfp' as const,
      title: 'Test',
      content: 'x'.repeat(500001),
    }
    expect(() => createKnowledgeEntrySchema.parse(invalidData)).toThrow()
  })

  it('should reject more than 20 tags', () => {
    const invalidData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'past_rfp' as const,
      title: 'Test',
      content: 'Content',
      metadata: {
        tags: Array(21).fill('tag'),
      },
    }
    expect(() => createKnowledgeEntrySchema.parse(invalidData)).toThrow()
  })

  it('should reject tags longer than 50 characters', () => {
    const invalidData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'past_rfp' as const,
      title: 'Test',
      content: 'Content',
      metadata: {
        tags: ['x'.repeat(51)],
      },
    }
    expect(() => createKnowledgeEntrySchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid UUID', () => {
    const invalidData = {
      customerId: 'not-a-uuid',
      type: 'past_rfp',
      title: 'Test',
      content: 'Content',
    }
    expect(() => createKnowledgeEntrySchema.parse(invalidData)).toThrow()
  })
})

describe('updateTenantSettingsSchema', () => {
  it('should validate partial settings update', () => {
    const validData = {
      confidenceThreshold: 0.8,
    }
    expect(updateTenantSettingsSchema.parse(validData)).toEqual(validData)
  })

  it('should validate all LLM providers', () => {
    const providers = ['claude', 'openai', 'azure'] as const
    providers.forEach((provider) => {
      const validData = {
        llmProvider: provider,
      }
      expect(updateTenantSettingsSchema.parse(validData)).toEqual(validData)
    })
  })

  it('should validate all fields', () => {
    const validData = {
      llmProvider: 'claude' as const,
      llmApiKey: 'sk-test-key',
      confidenceThreshold: 0.75,
      autoLearnEnabled: false,
    }
    expect(updateTenantSettingsSchema.parse(validData)).toEqual(validData)
  })

  it('should accept empty object', () => {
    expect(updateTenantSettingsSchema.parse({})).toEqual({})
  })

  it('should reject confidenceThreshold below 0', () => {
    const invalidData = {
      confidenceThreshold: -0.1,
    }
    expect(() => updateTenantSettingsSchema.parse(invalidData)).toThrow()
  })

  it('should reject confidenceThreshold above 1', () => {
    const invalidData = {
      confidenceThreshold: 1.1,
    }
    expect(() => updateTenantSettingsSchema.parse(invalidData)).toThrow()
  })

  it('should accept confidenceThreshold at boundaries', () => {
    expect(updateTenantSettingsSchema.parse({ confidenceThreshold: 0 })).toEqual({
      confidenceThreshold: 0,
    })
    expect(updateTenantSettingsSchema.parse({ confidenceThreshold: 1 })).toEqual({
      confidenceThreshold: 1,
    })
  })

  it('should reject empty llmApiKey', () => {
    const invalidData = {
      llmApiKey: '',
    }
    expect(() => updateTenantSettingsSchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid llmProvider', () => {
    const invalidData = {
      llmProvider: 'invalid',
    }
    expect(() => updateTenantSettingsSchema.parse(invalidData)).toThrow()
  })
})

describe('createLearningSchema', () => {
  it('should validate learning with customerId', () => {
    const validData = {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'This is learned content',
    }
    expect(createLearningSchema.parse(validData)).toEqual(validData)
  })

  it('should validate learning without customerId', () => {
    const validData = {
      content: 'General learning content',
    }
    expect(createLearningSchema.parse(validData)).toEqual(validData)
  })

  it('should validate learning with null customerId', () => {
    const validData = {
      customerId: null,
      content: 'General learning content',
    }
    expect(createLearningSchema.parse(validData)).toEqual(validData)
  })

  it('should reject empty content', () => {
    const invalidData = {
      content: '',
    }
    expect(() => createLearningSchema.parse(invalidData)).toThrow()
  })

  it('should reject content longer than 10000 characters', () => {
    const invalidData = {
      content: 'x'.repeat(10001),
    }
    expect(() => createLearningSchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid UUID', () => {
    const invalidData = {
      customerId: 'not-a-uuid',
      content: 'Content',
    }
    expect(() => createLearningSchema.parse(invalidData)).toThrow()
  })
})

describe('knowledgeSearchSchema', () => {
  it('should validate basic search query', () => {
    const validData = {
      query: 'search term',
    }
    const result = knowledgeSearchSchema.parse(validData)
    expect(result.query).toBe('search term')
    expect(result.limit).toBe(10) // default value
  })

  it('should validate with custom limit', () => {
    const validData = {
      query: 'search term',
      limit: 25,
    }
    expect(knowledgeSearchSchema.parse(validData)).toEqual(validData)
  })

  it('should reject empty query', () => {
    const invalidData = {
      query: '',
    }
    expect(() => knowledgeSearchSchema.parse(invalidData)).toThrow()
  })

  it('should reject query longer than 1000 characters', () => {
    const invalidData = {
      query: 'x'.repeat(1001),
    }
    expect(() => knowledgeSearchSchema.parse(invalidData)).toThrow()
  })

  it('should reject limit below 1', () => {
    const invalidData = {
      query: 'test',
      limit: 0,
    }
    expect(() => knowledgeSearchSchema.parse(invalidData)).toThrow()
  })

  it('should reject limit above 50', () => {
    const invalidData = {
      query: 'test',
      limit: 51,
    }
    expect(() => knowledgeSearchSchema.parse(invalidData)).toThrow()
  })

  it('should accept limit at boundaries', () => {
    expect(knowledgeSearchSchema.parse({ query: 'test', limit: 1 })).toEqual({
      query: 'test',
      limit: 1,
    })
    expect(knowledgeSearchSchema.parse({ query: 'test', limit: 50 })).toEqual({
      query: 'test',
      limit: 50,
    })
  })

  it('should reject non-integer limit', () => {
    const invalidData = {
      query: 'test',
      limit: 10.5,
    }
    expect(() => knowledgeSearchSchema.parse(invalidData)).toThrow()
  })
})
