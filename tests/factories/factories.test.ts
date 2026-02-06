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
      expect(customer.createdAt).toBeInstanceOf(Date)
    })

    it('allows overriding fields', () => {
      const customer = createMockCustomer({ name: 'Custom Inc', industry: 'Finance' })
      expect(customer.name).toBe('Custom Inc')
      expect(customer.industry).toBe('Finance')
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
      expect(rfp.title).toBe('Sample RFP')
      expect(rfp.status).toBe('draft')
      expect(rfp.totalFields).toBe(0)
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
      expect(entry.type).toBe('document')
      expect(entry.embedding).toBeNull()
    })
  })

  describe('createMockRfpResponse', () => {
    it('returns valid default RFP response', () => {
      const response = createMockRfpResponse()
      expect(response.fieldId).toBe('field-1')
      expect(response.confidenceScore).toBe(0.95)
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
      expect(version.version).toBe('1.0')
      expect(version.status).toBe('draft')
    })
  })

  describe('createMockLearning', () => {
    it('returns valid default learning', () => {
      const learning = createMockLearning()
      expect(learning.questionPattern).toBe('What is your company name?')
      expect(learning.approvedResponse).toBe('Acme Corporation')
      expect(learning.confidenceBoost).toBe(0.1)
    })
  })

  describe('createMockTenantSettings', () => {
    it('returns valid default tenant settings', () => {
      const settings = createMockTenantSettings()
      expect(settings.organizationId).toBe('org_test123')
      expect(settings.defaultLlmProvider).toBe('anthropic')
      expect(settings.llmApiKeyEncrypted).toBeNull()
    })
  })
})
