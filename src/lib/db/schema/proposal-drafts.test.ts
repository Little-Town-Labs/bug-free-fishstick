import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  proposalDrafts,
  type ProposalDraft,
  type CoverageReport,
  type CoverageRequirement,
} from './proposal-drafts'

describe('proposalDrafts schema — coverage_report column', () => {
  it('should have the correct table name', () => {
    expect(getTableName(proposalDrafts)).toBe('proposal_drafts')
  })

  it('should include coverageReport column', () => {
    const columns = Object.keys(proposalDrafts)
    expect(columns).toContain('coverageReport')
  })

  it('should retain all original columns (regression check)', () => {
    const columns = Object.keys(proposalDrafts)
    expect(columns).toContain('id')
    expect(columns).toContain('rfpId')
    expect(columns).toContain('organizationId')
    expect(columns).toContain('createdBy')
    expect(columns).toContain('status')
    expect(columns).toContain('clarifyingQuestions')
    expect(columns).toContain('markdownContent')
    expect(columns).toContain('generationError')
    expect(columns).toContain('version')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })
})

describe('CoverageReport TypeScript interface', () => {
  it('allows a valid coverage report with requirements', () => {
    const report: CoverageReport = {
      coverageScore: 0.85,
      evaluatedAt: '2026-02-25T10:00:00.000Z',
      requirements: [
        {
          requirementId: 'req-1',
          question: 'Does the vendor have ISO 27001?',
          addressed: true,
          evidence: 'Mentioned in Section 3.2',
          gap: null,
        },
        {
          requirementId: 'req-2',
          question: 'What is the SLA uptime guarantee?',
          addressed: false,
          evidence: null,
          gap: 'SLA not mentioned in proposal',
        },
      ],
    }
    expect(report.coverageScore).toBe(0.85)
    expect(report.requirements).toHaveLength(2)
  })

  it('allows coverage score at lower boundary (0)', () => {
    const report: CoverageReport = {
      coverageScore: 0,
      evaluatedAt: '2026-02-25T10:00:00.000Z',
      requirements: [],
    }
    expect(report.coverageScore).toBe(0)
  })

  it('allows coverage score at upper boundary (1)', () => {
    const report: CoverageReport = {
      coverageScore: 1,
      evaluatedAt: '2026-02-25T10:00:00.000Z',
      requirements: [],
    }
    expect(report.coverageScore).toBe(1)
  })

  it('allows empty requirements array (RFP with no parsed fields)', () => {
    const report: CoverageReport = {
      coverageScore: 0,
      evaluatedAt: '2026-02-25T10:00:00.000Z',
      requirements: [],
    }
    expect(report.requirements).toHaveLength(0)
  })
})

describe('CoverageRequirement TypeScript interface', () => {
  it('allows addressed=true with evidence', () => {
    const req: CoverageRequirement = {
      requirementId: 'req-1',
      question: 'Describe your security policy.',
      addressed: true,
      evidence: 'Section 4 covers security policy in detail.',
      gap: null,
    }
    expect(req.addressed).toBe(true)
    expect(req.evidence).toBeTruthy()
  })

  it('allows addressed=false with gap description', () => {
    const req: CoverageRequirement = {
      requirementId: 'req-2',
      question: 'What certifications do you hold?',
      addressed: false,
      evidence: null,
      gap: 'No certifications mentioned',
    }
    expect(req.addressed).toBe(false)
    expect(req.gap).toBeTruthy()
  })
})

describe('ProposalDraft type', () => {
  it('allows null coverageReport (draft not yet evaluated)', () => {
    const draft: Partial<ProposalDraft> = {
      coverageReport: null,
    }
    expect(draft.coverageReport).toBeNull()
  })

  it('allows a full CoverageReport to be assigned to coverageReport', () => {
    const draft: Partial<ProposalDraft> = {
      coverageReport: {
        coverageScore: 0.75,
        evaluatedAt: '2026-02-25T10:00:00.000Z',
        requirements: [],
      },
    }
    expect(draft.coverageReport?.coverageScore).toBe(0.75)
  })
})
