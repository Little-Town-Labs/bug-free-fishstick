import type {
  TenantSetting,
  Customer,
  KnowledgeEntry,
  Rfp,
  RfpResponse,
  RfpVersion,
  Learning,
} from '@/lib/db/schema'

let counter = 0
function nextId(): string {
  counter++
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
}

export function resetFactoryCounter() {
  counter = 0
}

export function createMockTenantSettings(
  overrides: Partial<TenantSetting> = {}
): TenantSetting {
  return {
    id: nextId(),
    organizationId: 'org_test123',
    defaultLlmProvider: 'anthropic',
    llmApiKeyEncrypted: null,
    brandingSettings: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createMockCustomer(
  overrides: Partial<Customer> = {}
): Customer {
  return {
    id: nextId(),
    organizationId: 'org_test123',
    name: 'Acme Corporation',
    industry: 'Technology',
    notes: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createMockKnowledgeEntry(
  overrides: Partial<KnowledgeEntry> = {}
): KnowledgeEntry {
  return {
    id: nextId(),
    organizationId: 'org_test123',
    customerId: null,
    title: 'Sample Knowledge Entry',
    content: 'This is sample content for a knowledge entry.',
    type: 'document',
    sourceUrl: null,
    embedding: null,
    metadata: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createMockRfp(overrides: Partial<Rfp> = {}): Rfp {
  return {
    id: nextId(),
    organizationId: 'org_test123',
    customerId: null,
    title: 'Sample RFP',
    status: 'draft',
    originalFileUrl: null,
    originalFileName: null,
    completedFileUrl: null,
    totalFields: 0,
    completedFields: 0,
    flaggedFields: 0,
    dueDate: null,
    metadata: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createMockRfpResponse(
  overrides: Partial<RfpResponse> = {}
): RfpResponse {
  const rfpId = overrides.rfpId ?? nextId()
  return {
    id: nextId(),
    rfpId,
    fieldId: 'field-1',
    fieldLabel: 'Company Name',
    fieldType: 'text',
    originalValue: null,
    generatedValue: 'Acme Corporation',
    finalValue: null,
    confidenceScore: 0.95,
    requiresReview: false,
    isApproved: false,
    approvedBy: null,
    approvedAt: null,
    pageNumber: 1,
    coordinates: null,
    sourceReferences: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createMockRfpVersion(
  overrides: Partial<RfpVersion> = {}
): RfpVersion {
  const rfpId = overrides.rfpId ?? nextId()
  return {
    id: nextId(),
    rfpId,
    version: '1.0',
    status: 'draft',
    fileUrl: null,
    changes: null,
    createdBy: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createMockLearning(
  overrides: Partial<Learning> = {}
): Learning {
  return {
    id: nextId(),
    organizationId: 'org_test123',
    customerId: null,
    rfpId: null,
    questionPattern: 'What is your company name?',
    approvedResponse: 'Acme Corporation',
    confidenceBoost: 0.1,
    usageCount: '0',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}
