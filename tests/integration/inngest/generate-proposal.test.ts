import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _eventConfig: unknown, handler: unknown) => handler),
  },
}))

vi.mock('@/lib/services/proposal-retrieval', () => ({
  searchByRequirements: vi.fn().mockResolvedValue([]),
  fetchTypedSupplierContext: vi.fn().mockResolvedValue({
    companyDocs: [],
    certifications: [],
    caseStudies: [],
    wonPastRfps: [],
  }),
  fetchCustomerContext: vi.fn().mockResolvedValue(null),
  fetchLearnings: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/rate-card', () => ({
  getRateCard: vi.fn().mockResolvedValue({ rateCard: null, proposalDefaults: null }),
}))

vi.mock('@/lib/services/scope-line-parser', () => ({
  parseScopeLines: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/services/pricing-computation', () => ({
  computePricingEstimate: vi.fn().mockReturnValue({
    formattedMarkdown: '[PLACEHOLDER: pricing details required]',
    isPlaceholder: true,
    total: 0,
    lineItems: [],
    subtotal: 0,
    marginPct: 0,
    marginAmount: 0,
    discountsApplied: [],
    currency: 'USD',
    mode: 'blended',
    model: 'time_and_materials',
    totalFlooredAtZero: false,
  }),
}))

vi.mock('@/lib/services/proposal-draft', () => ({
  updateDraftContent: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/ai/agents/proposal-writer', () => ({
  writeProposal: vi.fn().mockResolvedValue({ markdownContent: '# Proposal\n\nGenerated content.' }),
}))

vi.mock('@/lib/services/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-key'),
}))

// ─── Imports ────────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import {
  searchByRequirements,
  fetchTypedSupplierContext,
  fetchCustomerContext,
  fetchLearnings,
} from '@/lib/services/proposal-retrieval'
import { parseScopeLines } from '@/lib/services/scope-line-parser'
import { computePricingEstimate } from '@/lib/services/pricing-computation'
import { writeProposal } from '@/lib/ai/agents/proposal-writer'
import { updateDraftContent } from '@/lib/services/proposal-draft'
import { generateProposal } from '@/lib/inngest/functions/generate-proposal'

// ─── Fixtures ───────────────────────────────────────────────────────────────

const REQUIRED_TEMPLATE_CONTENT = 'This is the EXACT verbatim content of the required assumptions template. Do not modify this text — it must appear character-for-character identical in the output.'

const SITUATIONAL_MATCHING_CONTENT = 'Situational template for IT services — payment terms specific to technology contracts.'

const SITUATIONAL_NON_MATCHING_CONTENT = 'This template is for healthcare only and should NOT appear.'

const mockDraft = {
  id: 'draft-1',
  rfpId: 'rfp-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  status: 'generating',
  clarifyingQuestions: [
    { id: 'scope-deliverables', question: 'Deliverables?', rfpSection: 'Scope', answer: 'Analysis: 40 hours' },
    { id: 'q2', question: 'Timeline?', rfpSection: 'Schedule', answer: '6 months' },
  ],
  markdownContent: null,
  generationError: null,
  version: 1,
  coverageReport: null,
}

const mockRfp = {
  id: 'rfp-1',
  organizationId: 'org-1',
  name: 'Test RFP',
  customerId: 'customer-1',
  rfpType: 'it_services',
  industryTags: ['technology'],
  parsedStructure: {
    pages: 2,
    fields: [
      { id: 'f1', type: 'text', question: 'Company background?', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
      { id: 'f2', type: 'text', question: 'Security certifications?', position: { page: 1, x: 0, y: 30, width: 100, height: 20 } },
    ],
  },
}

const mockRequiredTemplate = {
  id: 'tpl-req-1',
  organizationId: 'org-1',
  section: 'assumptions',
  title: 'Standard Assumptions',
  content: REQUIRED_TEMPLATE_CONTENT,
  isRequired: true,
  triggerRfpTypes: null,
  triggerIndustryTags: null,
  evaluateCoverage: false,
  sortOrder: 0,
  createdBy: 'admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockSituationalMatchingTemplate = {
  id: 'tpl-sit-1',
  organizationId: 'org-1',
  section: 'payment_terms',
  title: 'IT Payment Terms',
  content: SITUATIONAL_MATCHING_CONTENT,
  isRequired: false,
  triggerRfpTypes: ['it_services'],
  triggerIndustryTags: null,
  evaluateCoverage: false,
  sortOrder: 0,
  createdBy: 'admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockSituationalNonMatchingTemplate = {
  id: 'tpl-sit-2',
  organizationId: 'org-1',
  section: 'liability',
  title: 'Healthcare Liability',
  content: SITUATIONAL_NON_MATCHING_CONTENT,
  isRequired: false,
  triggerRfpTypes: ['healthcare'],
  triggerIndustryTags: null,
  evaluateCoverage: false,
  sortOrder: 0,
  createdBy: 'admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  }
}

function createMockEvent(data: Record<string, unknown>) {
  return { data, name: 'proposal/generate' }
}

/**
 * Sets up db.select to return different results per call.
 * Each spec: { type: 'limited' | 'multi', rows: [...] }
 */
function mockSelectSequence(responses: Array<{ type: 'limited' | 'multi'; rows: unknown[] }>) {
  let callCount = 0
  vi.mocked(db.select).mockImplementation(() => {
    const spec = responses[callCount++] ?? { type: 'limited', rows: [] }
    if (spec.type === 'multi') {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(spec.rows),
        }),
      } as any
    }
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(spec.rows),
        }),
      }),
    } as any
  })
}

function setupSuccessPath() {
  mockSelectSequence([
    // Pre-step: tenant settings for openai key (field aliased as 'k' in select)
    { type: 'limited', rows: [{ k: 'encrypted-key' }] },
    // Step 1: draft
    { type: 'limited', rows: [mockDraft] },
    // Step 1: rfp
    { type: 'limited', rows: [mockRfp] },
    // Step 4: tenant settings for company profile (field aliased as 'cp' in select)
    { type: 'limited', rows: [{ cp: 'Acme Corp description.' }] },
    // Step 5: required templates
    { type: 'multi', rows: [mockRequiredTemplate] },
    // Step 6: situational templates (all non-required, filtered in TS)
    { type: 'multi', rows: [mockSituationalMatchingTemplate, mockSituationalNonMatchingTemplate] },
  ])
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generate-proposal Inngest function (F8 — 11-step pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as any)
  })

  const eventData = { draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' }

  describe('success path', () => {
    it('calls all 11 step names', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      const stepNames = step.run.mock.calls.map((c: unknown[]) => c[0])
      expect(stepNames).toEqual([
        'fetch-draft-and-rfp',
        'fetch-customer-context',
        'search-requirements',
        'fetch-typed-supplier-context',
        'fetch-required-templates',
        'fetch-situational-templates',
        'compute-pricing',
        'generate-proposal-content',
        'check-requirement-coverage',
        'inject-required-templates',
        'save-proposal-content',
      ])
    })

    it('calls fetchCustomerContext with rfp.customerId and orgId', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(fetchCustomerContext).toHaveBeenCalledWith('customer-1', 'org-1')
    })

    it('calls searchByRequirements with parsed structure fields', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(searchByRequirements).toHaveBeenCalledWith(
        mockRfp.parsedStructure.fields,
        'org-1',
        'decrypted-key',
      )
    })

    it('calls fetchTypedSupplierContext with orgId, industryTags, rfpType', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(fetchTypedSupplierContext).toHaveBeenCalledWith(
        'org-1',
        ['technology'],
        'it_services',
      )
    })

    it('calls parseScopeLines with draft.clarifyingQuestions', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(parseScopeLines).toHaveBeenCalledWith(mockDraft.clarifyingQuestions)
    })

    it('calls computePricingEstimate with rateCard and scopeLines', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(computePricingEstimate).toHaveBeenCalledWith(
        null, // rateCard is null from mock
        [], // parseScopeLines returns []
        'time_and_materials',
      )
    })

    it('calls writeProposal with new input shape including pricingMarkdown', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(writeProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          pricingMarkdown: '[PLACEHOLDER: pricing details required]',
          requirementResults: expect.any(Array),
          organizationId: 'org-1',
        }),
      )
    })

    it('required template content appears verbatim in updateDraftContent', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      const markdownArg = vi.mocked(updateDraftContent).mock.calls[0]![2] as string
      expect(markdownArg).toContain(REQUIRED_TEMPLATE_CONTENT)
    })

    it('calls updateDraftContent with 4 args including CoverageReport', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(updateDraftContent).toHaveBeenCalledWith(
        'draft-1',
        'org-1',
        expect.any(String),
        expect.objectContaining({
          coverageScore: 0,
          evaluatedAt: expect.any(String),
        }),
      )
    })

    it('pricingMarkdown is placeholder when rate card is null', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(writeProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          pricingMarkdown: '[PLACEHOLDER: pricing details required]',
        }),
      )
    })

    it('situational template matching rfpType is included in final output', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      const markdownArg = vi.mocked(updateDraftContent).mock.calls[0]![2] as string
      expect(markdownArg).toContain(SITUATIONAL_MATCHING_CONTENT)
    })

    it('situational template NOT matching rfpType is excluded from final output', async () => {
      setupSuccessPath()
      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      const markdownArg = vi.mocked(updateDraftContent).mock.calls[0]![2] as string
      expect(markdownArg).not.toContain(SITUATIONAL_NON_MATCHING_CONTENT)
    })
  })

  describe('failure path', () => {
    it('sets draft status to error when writeProposal throws', async () => {
      setupSuccessPath()
      vi.mocked(writeProposal).mockRejectedValueOnce(new Error('LLM provider error'))
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      })
      vi.mocked(db.update).mockReturnValue({ set: setMock } as any)

      const step = createMockStep()
      await (generateProposal as unknown as Function)({ event: createMockEvent(eventData), step })

      expect(db.update).toHaveBeenCalled()
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' }),
      )
    })
  })
})
