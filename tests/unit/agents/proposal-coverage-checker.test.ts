import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModelForOrg: vi.fn().mockResolvedValue({ type: 'mock-model' }),
}))

import { generateObject } from 'ai'
import { checkCoverage } from '@/lib/ai/agents/proposal-coverage-checker'
import type { CoverageCheckerInput } from '@/lib/ai/agents/proposal-coverage-checker'

const baseInput: CoverageCheckerInput = {
  requirements: [
    { id: 'f1', question: 'Describe your company background.' },
    { id: 'f2', question: 'List security certifications.' },
  ],
  proposalMarkdown: '# Proposal\n\n## Company Background\n\nAcme Corp is a leading provider.\n\n## Security\n\n[PLACEHOLDER: security details required]',
  evaluateCoverageTemplates: [],
  organizationId: 'org-1',
}

describe('proposal-coverage-checker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns addressed=true with evidence for matched requirements', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        requirements: [
          { requirementId: 'f1', addressed: true, evidence: 'Acme Corp is a leading provider.', gap: null },
          { requirementId: 'f2', addressed: false, evidence: null, gap: 'Only a placeholder is present.' },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>)

    const result = await checkCoverage(baseInput)

    expect(result.requirements[0]!.addressed).toBe(true)
    expect(result.requirements[0]!.evidence).toBe('Acme Corp is a leading provider.')
  })

  it('returns addressed=false with gap for unaddressed requirements', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        requirements: [
          { requirementId: 'f1', addressed: true, evidence: 'Acme Corp...', gap: null },
          { requirementId: 'f2', addressed: false, evidence: null, gap: 'Only a placeholder is present.' },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>)

    const result = await checkCoverage(baseInput)

    expect(result.requirements[1]!.addressed).toBe(false)
    expect(result.requirements[1]!.gap).toBe('Only a placeholder is present.')
  })

  it('computes mixed coverage score correctly', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        requirements: [
          { requirementId: 'f1', addressed: true, evidence: 'evidence', gap: null },
          { requirementId: 'f2', addressed: false, evidence: null, gap: 'missing' },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>)

    const result = await checkCoverage(baseInput)

    expect(result.coverageScore).toBe(50) // 1/2 = 50%
  })

  it('returns score 0 and empty array for empty requirements', async () => {
    const result = await checkCoverage({
      ...baseInput,
      requirements: [],
      evaluateCoverageTemplates: [],
    })

    expect(result.coverageScore).toBe(0)
    expect(result.requirements).toEqual([])
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('returns all gaps with score 0 for empty proposal markdown', async () => {
    const result = await checkCoverage({
      ...baseInput,
      proposalMarkdown: '',
    })

    expect(result.coverageScore).toBe(0)
    expect(result.requirements).toHaveLength(2)
    expect(result.requirements[0]!.addressed).toBe(false)
    expect(result.requirements[0]!.gap).toBe('Proposal content is empty')
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('includes evaluateCoverage templates as additional requirements', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        requirements: [
          { requirementId: 'f1', addressed: true, evidence: 'evidence', gap: null },
          { requirementId: 'f2', addressed: true, evidence: 'evidence', gap: null },
          { requirementId: 'template:Payment Terms', addressed: true, evidence: 'Payment due in 30 days.', gap: null },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>)

    const result = await checkCoverage({
      ...baseInput,
      evaluateCoverageTemplates: [
        { title: 'Payment Terms', content: 'Net 30 payment terms.' },
      ],
    })

    expect(result.requirements).toHaveLength(3)
    expect(result.requirements[2]!.requirementId).toBe('template:Payment Terms')
    expect(result.coverageScore).toBe(100) // 3/3
  })

  it('computes score as Math.round((addressed/total)*100)', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        requirements: [
          { requirementId: 'f1', addressed: true, evidence: 'e', gap: null },
          { requirementId: 'f2', addressed: true, evidence: 'e', gap: null },
          { requirementId: 'template:T', addressed: false, evidence: null, gap: 'gap' },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>)

    const result = await checkCoverage({
      ...baseInput,
      evaluateCoverageTemplates: [{ title: 'T', content: 'c' }],
    })

    expect(result.coverageScore).toBe(67) // Math.round(2/3 * 100)
  })

  it('returns score 0 for null proposal markdown', async () => {
    const result = await checkCoverage({
      ...baseInput,
      proposalMarkdown: null as unknown as string,
    })

    expect(result.coverageScore).toBe(0)
    expect(result.requirements.every((r) => !r.addressed)).toBe(true)
  })

  it('throws when generateObject fails (caller handles graceful degradation)', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('LLM provider error'))

    await expect(checkCoverage(baseInput)).rejects.toThrow('LLM provider error')
  })

  it('handles LLM returning fewer results than requirements', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        requirements: [
          { requirementId: 'f1', addressed: true, evidence: 'e', gap: null },
          // f2 missing from LLM response
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>)

    const result = await checkCoverage(baseInput)

    expect(result.requirements[1]!.addressed).toBe(false)
    expect(result.requirements[1]!.gap).toBe('No evaluation result returned')
  })

  it('includes evaluatedAt timestamp', async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        requirements: [
          { requirementId: 'f1', addressed: true, evidence: 'e', gap: null },
          { requirementId: 'f2', addressed: true, evidence: 'e', gap: null },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>)

    const result = await checkCoverage(baseInput)

    expect(result.evaluatedAt).toBeDefined()
    expect(new Date(result.evaluatedAt).getTime()).not.toBeNaN()
  })
})
