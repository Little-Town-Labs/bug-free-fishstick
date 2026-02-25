import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  proposalTemplates,
  proposalTemplateSections,
  type ProposalTemplate,
  type NewProposalTemplate,
  type ProposalTemplateSection,
} from './proposal-templates'

describe('proposalTemplates schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(proposalTemplates)).toBe('proposal_templates')
  })

  it('should include all required columns', () => {
    const columns = Object.keys(proposalTemplates)
    expect(columns).toContain('id')
    expect(columns).toContain('organizationId')
    expect(columns).toContain('section')
    expect(columns).toContain('title')
    expect(columns).toContain('content')
    expect(columns).toContain('isRequired')
    expect(columns).toContain('triggerRfpTypes')
    expect(columns).toContain('triggerIndustryTags')
    expect(columns).toContain('evaluateCoverage')
    expect(columns).toContain('sortOrder')
    expect(columns).toContain('createdBy')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })
})

describe('proposalTemplateSections enum', () => {
  it('contains all 8 expected section values', () => {
    expect(proposalTemplateSections).toContain('assumptions')
    expect(proposalTemplateSections).toContain('exclusions')
    expect(proposalTemplateSections).toContain('payment_terms')
    expect(proposalTemplateSections).toContain('change_management')
    expect(proposalTemplateSections).toContain('ip_ownership')
    expect(proposalTemplateSections).toContain('liability')
    expect(proposalTemplateSections).toContain('force_majeure')
    expect(proposalTemplateSections).toContain('warranty')
  })

  it('has exactly 8 section values', () => {
    expect(proposalTemplateSections).toHaveLength(8)
  })
})

describe('ProposalTemplate types', () => {
  it('ProposalTemplate type allows a fully-populated template record', () => {
    const t: ProposalTemplate = {
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: 'org_test',
      section: 'assumptions',
      title: 'Standard Assumptions',
      content: 'All work performed during business hours.',
      isRequired: false,
      triggerRfpTypes: ['technical'],
      triggerIndustryTags: null,
      evaluateCoverage: true,
      sortOrder: 1,
      createdBy: 'user_test',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(t.section).toBe('assumptions')
    expect(t.isRequired).toBe(false)
    expect(t.evaluateCoverage).toBe(true)
  })

  it('ProposalTemplate type allows null trigger arrays (universal template)', () => {
    const t: Partial<ProposalTemplate> = {
      triggerRfpTypes: null,
      triggerIndustryTags: null,
    }
    expect(t.triggerRfpTypes).toBeNull()
    expect(t.triggerIndustryTags).toBeNull()
  })

  it('NewProposalTemplate type allows omitting auto-generated fields', () => {
    const n: NewProposalTemplate = {
      organizationId: 'org_test',
      section: 'warranty',
      title: 'Warranty Terms',
      content: 'Standard 90-day warranty applies.',
      createdBy: 'user_test',
    }
    expect(n.section).toBe('warranty')
  })

  it('ProposalTemplateSection type is assignable from all enum values', () => {
    const sections: ProposalTemplateSection[] = [
      'assumptions',
      'exclusions',
      'payment_terms',
      'change_management',
      'ip_ownership',
      'liability',
      'force_majeure',
      'warranty',
    ]
    expect(sections).toHaveLength(8)
  })
})
