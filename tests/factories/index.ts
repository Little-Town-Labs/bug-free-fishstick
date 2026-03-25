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
    organizationId: 'org_test123',
    llmProvider: 'claude',
    llmApiKeyEncrypted: null,
    openaiApiKeyEncrypted: null,
    anthropicApiKeyEncrypted: null,
    confidenceThreshold: 0.7,
    autoLearnEnabled: true,
    rateCard: null,
    proposalDefaults: null,
    companyProfile: null,
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
    description: 'Technology company specializing in enterprise solutions',
    settings: { preferredTone: 'formal', industryContext: 'Technology' },
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
    customerId: nextId(),
    type: 'company_doc',
    title: 'Sample Knowledge Entry',
    content: 'This is sample content for a knowledge entry.',
    embedding: null,
    chunkIndex: null,
    totalChunks: null,
    sectionHeading: null,
    tags: null,
    sourceEntryId: null,
    processingStatus: 'complete' as const,
    metadata: { tags: ['sample'] },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function createMockRfp(overrides: Partial<Rfp> = {}): Rfp {
  return {
    id: nextId(),
    organizationId: 'org_test123',
    customerId: nextId(),
    assignedUserId: 'user_test123',
    name: 'Sample RFP',
    status: 'draft',
    customerCompanyName: 'Acme Corp',
    customerContactName: 'John Doe',
    customerContactInfo: { email: 'john@acme.com' },
    receiveDate: '2025-01-01',
    dueDate: '2025-02-01',
    completionDate: null,
    originalFileUrl: null,
    originalFileType: null,
    completedFileUrl: null,
    completedFileError: null,
    automationPercentage: 0,
    version: 1,
    rfpType: null,
    complexity: null,
    industryTags: null,
    suggestedAssigneeId: null,
    returnComments: null,
    outcome: null,
    outcomeSetAt: null,
    crmDealId: null,
    extractedMetadata: null,
    parsedStructure: null,
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
    fieldType: 'text',
    question: 'What is your company name?',
    responseText: 'Acme Corporation',
    confidenceScore: 0.95,
    status: 'auto_filled',
    position: { page: 1, x: 100, y: 200, width: 300, height: 20 },
    aiMetadata: { modelUsed: 'claude-sonnet-4-5-20250929', generatedAt: '2025-01-01T00:00:00Z' },
    version: 1,
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
    versionNumber: 1,
    createdBy: 'user_test123',
    snapshot: {
      responses: [{ fieldId: 'field-1', responseText: 'Acme Corporation', status: 'approved' }],
      automationPercentage: 85,
    },
    changeSummary: 'Initial version',
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
    content: 'Our company was founded in 2010 and specializes in enterprise solutions.',
    sourceType: 'manual_entry',
    createdBy: 'user_test123',
    fieldId: null,
    questionType: null,
    confidence: null,
    sourceMetadata: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}
