import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMockCustomer,
  createMockRfp,
  createMockKnowledgeEntry,
  createMockRfpResponse,
  createMockRfpVersion,
  createMockLearning,
  createMockTenantSettings,
  resetFactoryCounter,
} from './index'

describe('mock factories', () => {
  beforeEach(() => {
    resetFactoryCounter()
  })

  describe('createMockCustomer', () => {
    it('returns valid default customer data', () => {
      const customer = createMockCustomer()
      expect(customer.id).toBeDefined()
      expect(customer.organizationId).toBe('org_test123')
      expect(customer.name).toBe('Acme Corporation')
      expect(customer.description).toBeDefined()
      expect(customer.settings).toHaveProperty('preferredTone', 'formal')
      expect(customer.createdAt).toBeInstanceOf(Date)
    })

    it('allows overriding fields', () => {
      const customer = createMockCustomer({ name: 'Custom Inc', description: 'Finance company' })
      expect(customer.name).toBe('Custom Inc')
      expect(customer.description).toBe('Finance company')
    })

    it('generates unique IDs', () => {
      const a = createMockCustomer()
      const b = createMockCustomer()
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('createMockRfp', () => {
    it('returns valid default RFP data', () => {
      const rfp = createMockRfp()
      expect(rfp.name).toBe('Sample RFP')
      expect(rfp.status).toBe('draft')
      expect(rfp.assignedUserId).toBe('user_test123')
      expect(rfp.automationPercentage).toBe(0)
      expect(rfp.version).toBe(1)
    })

    it('allows overriding status', () => {
      const rfp = createMockRfp({ status: 'processing' })
      expect(rfp.status).toBe('processing')
    })
  })

  describe('createMockKnowledgeEntry', () => {
    it('returns valid default knowledge entry', () => {
      const entry = createMockKnowledgeEntry()
      expect(entry.title).toBe('Sample Knowledge Entry')
      expect(entry.type).toBe('company_doc')
      expect(entry.embedding).toBeNull()
      expect(entry.customerId).toBeDefined()
    })
  })

  describe('createMockRfpResponse', () => {
    it('returns valid default RFP response', () => {
      const response = createMockRfpResponse()
      expect(response.fieldId).toBe('field-1')
      expect(response.fieldType).toBe('text')
      expect(response.question).toBe('What is your company name?')
      expect(response.confidenceScore).toBe(0.95)
      expect(response.status).toBe('auto_filled')
      expect(response.rfpId).toBeDefined()
    })

    it('links to provided rfpId', () => {
      const response = createMockRfpResponse({ rfpId: 'rfp-123' })
      expect(response.rfpId).toBe('rfp-123')
    })
  })

  describe('createMockRfpVersion', () => {
    it('returns valid default RFP version', () => {
      const version = createMockRfpVersion()
      expect(version.versionNumber).toBe(1)
      expect(version.createdBy).toBe('user_test123')
      expect(version.snapshot).toBeDefined()
      expect(version.snapshot?.responses).toHaveLength(1)
    })
  })

  describe('createMockLearning', () => {
    it('returns valid default learning', () => {
      const learning = createMockLearning()
      expect(learning.content).toContain('founded in 2010')
      expect(learning.sourceType).toBe('manual_entry')
      expect(learning.createdBy).toBe('user_test123')
    })
  })

  describe('createMockTenantSettings', () => {
    it('returns valid default tenant settings', () => {
      const settings = createMockTenantSettings()
      expect(settings.organizationId).toBe('org_test123')
      expect(settings.llmProvider).toBe('claude')
      expect(settings.confidenceThreshold).toBe(0.7)
      expect(settings.autoLearnEnabled).toBe(true)
      expect(settings.llmApiKeyEncrypted).toBeNull()
    })
  })
})
