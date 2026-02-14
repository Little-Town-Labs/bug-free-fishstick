import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  tenantSettings,
  customers,
  knowledgeEntries,
  knowledgeEntryTypes,
  rfps,
  rfpStatuses,
  rfpResponses,
  responseStatuses,
  fieldTypes,
  rfpVersions,
  learnings,
  learningSourceTypes,
} from '@/lib/db/schema'

describe('tenant_settings schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(tenantSettings)).toBe('tenant_settings')
  })

  it('should have required columns', () => {
    const columns = Object.keys(tenantSettings)
    expect(columns).toContain('organizationId')
    expect(columns).toContain('llmProvider')
    expect(columns).toContain('llmApiKeyEncrypted')
    expect(columns).toContain('confidenceThreshold')
    expect(columns).toContain('autoLearnEnabled')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })

  it('should use organizationId as primary key (no separate id column)', () => {
    const columns = Object.keys(tenantSettings)
    expect(columns).not.toContain('id')
    expect(columns).toContain('organizationId')
  })
})

describe('customers schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(customers)).toBe('customers')
  })

  it('should have required columns', () => {
    const columns = Object.keys(customers)
    expect(columns).toContain('id')
    expect(columns).toContain('organizationId')
    expect(columns).toContain('name')
    expect(columns).toContain('description')
    expect(columns).toContain('settings')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })
})

describe('knowledge_entries schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(knowledgeEntries)).toBe('knowledge_entries')
  })

  it('should have required columns', () => {
    const columns = Object.keys(knowledgeEntries)
    expect(columns).toContain('id')
    expect(columns).toContain('organizationId')
    expect(columns).toContain('customerId')
    expect(columns).toContain('type')
    expect(columns).toContain('title')
    expect(columns).toContain('content')
    expect(columns).toContain('embedding')
    expect(columns).toContain('metadata')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })

  it('should define valid knowledge entry types', () => {
    expect(knowledgeEntryTypes).toEqual([
      'past_rfp',
      'case_study',
      'certification',
      'company_doc',
      'manual_entry',
    ])
  })
})

describe('rfps schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(rfps)).toBe('rfps')
  })

  it('should have required columns', () => {
    const columns = Object.keys(rfps)
    expect(columns).toContain('id')
    expect(columns).toContain('organizationId')
    expect(columns).toContain('customerId')
    expect(columns).toContain('assignedUserId')
    expect(columns).toContain('name')
    expect(columns).toContain('status')
    expect(columns).toContain('customerCompanyName')
    expect(columns).toContain('customerContactName')
    expect(columns).toContain('customerContactInfo')
    expect(columns).toContain('receiveDate')
    expect(columns).toContain('dueDate')
    expect(columns).toContain('completionDate')
    expect(columns).toContain('originalFileUrl')
    expect(columns).toContain('originalFileType')
    expect(columns).toContain('completedFileUrl')
    expect(columns).toContain('automationPercentage')
    expect(columns).toContain('version')
    expect(columns).toContain('parsedStructure')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })

  it('should define valid RFP statuses', () => {
    expect(rfpStatuses).toEqual(['draft', 'processing', 'submitted', 'approved', 'finalized'])
  })
})

describe('rfp_responses schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(rfpResponses)).toBe('rfp_responses')
  })

  it('should have required columns', () => {
    const columns = Object.keys(rfpResponses)
    expect(columns).toContain('id')
    expect(columns).toContain('rfpId')
    expect(columns).toContain('fieldId')
    expect(columns).toContain('fieldType')
    expect(columns).toContain('question')
    expect(columns).toContain('responseText')
    expect(columns).toContain('confidenceScore')
    expect(columns).toContain('status')
    expect(columns).toContain('position')
    expect(columns).toContain('aiMetadata')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })

  it('should define valid response statuses', () => {
    expect(responseStatuses).toEqual(['auto_filled', 'needs_input', 'manually_filled', 'approved'])
  })

  it('should define valid field types', () => {
    expect(fieldTypes).toEqual(['text', 'paragraph', 'checkbox', 'table', 'date', 'number'])
  })
})

describe('rfp_versions schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(rfpVersions)).toBe('rfp_versions')
  })

  it('should have required columns', () => {
    const columns = Object.keys(rfpVersions)
    expect(columns).toContain('id')
    expect(columns).toContain('rfpId')
    expect(columns).toContain('versionNumber')
    expect(columns).toContain('createdBy')
    expect(columns).toContain('snapshot')
    expect(columns).toContain('changeSummary')
    expect(columns).toContain('createdAt')
  })
})

describe('learnings schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(learnings)).toBe('learnings')
  })

  it('should have required columns', () => {
    const columns = Object.keys(learnings)
    expect(columns).toContain('id')
    expect(columns).toContain('organizationId')
    expect(columns).toContain('customerId')
    expect(columns).toContain('content')
    expect(columns).toContain('sourceType')
    expect(columns).toContain('createdBy')
    expect(columns).toContain('sourceMetadata')
    expect(columns).toContain('createdAt')
  })

  it('should define valid learning source types', () => {
    expect(learningSourceTypes).toEqual(['rfp_approval', 'user_correction', 'manual_entry', 'accept_signal', 'edit_correction', 'reject_signal'])
  })
})
