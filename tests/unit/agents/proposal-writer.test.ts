import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModelForOrg: vi.fn().mockReturnValue({ type: 'mock-model' }),
}))

import { generateText } from 'ai'
import { writeProposal } from '@/lib/ai/agents/proposal-writer'
import type { WriteProposalInput } from '@/lib/ai/agents/proposal-writer'

const mockMarkdown = '# Proposal\n\n## Requirements\n\nContent here.'

const baseInput: WriteProposalInput = {
  rfpSections: [
    { id: 'f1', title: 'Company Background', content: 'Describe your company.' },
  ],
  requirementResults: [
    {
      id: 'ke-1',
      organizationId: 'org-1',
      customerId: null,
      type: 'company_doc',
      title: 'About Us',
      content: 'We are a technology company.',
      tags: [],
      metadata: null,
      chunkIndex: null,
      totalChunks: null,
      sectionHeading: null,
      sourceEntryId: null,
      processingStatus: 'complete',
      createdAt: new Date(),
      updatedAt: new Date(),
      similarity: 0.9,
    },
  ],
  supplierContext: {
    companyDocs: [],
    certifications: [],
    caseStudies: [],
    wonPastRfps: [],
  },
  companyProfile: 'Acme Corp is a leading provider.',
  customerContext: {
    preferredTone: 'formal',
    industryContext: 'Government',
    customInstructions: 'Emphasize security.',
  },
  learnings: [],
  pricingMarkdown: '| Item | Total |\n|---|---|\n| Dev | $10,000 |',
  clarifyingAnswers: [
    { id: 'q1', question: 'Timeline?', rfpSection: 'Schedule', answer: '6 months' },
  ],
  organizationId: 'org-1',
}

describe('proposal-writer (F8 interface)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls generateText with the new WriteProposalInput shape', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal(baseInput)

    expect(generateText).toHaveBeenCalledTimes(1)
  })

  it('system prompt contains "Do NOT generate Terms & Conditions"', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal(baseInput)

    const args = vi.mocked(generateText).mock.calls[0]![0] as { system: string }
    expect(args.system).toContain('Do NOT generate Terms & Conditions')
  })

  it('system prompt contains "Do NOT perform any pricing calculations"', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal(baseInput)

    const args = vi.mocked(generateText).mock.calls[0]![0] as { system: string }
    expect(args.system).toContain('Do NOT perform any pricing calculations')
  })

  it('prompt includes pricingMarkdown verbatim', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal(baseInput)

    const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
    expect(args.prompt).toContain(baseInput.pricingMarkdown)
  })

  it('omits Company Profile block when companyProfile is null', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal({ ...baseInput, companyProfile: null })

    const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
    expect(args.prompt).not.toContain('## Company Profile')
  })

  it('includes Company Profile block when companyProfile is non-empty', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal(baseInput)

    const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
    expect(args.prompt).toContain('Acme Corp is a leading provider.')
  })

  it('omits Customer Preferences block when customerContext is null', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal({ ...baseInput, customerContext: null })

    const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
    expect(args.prompt).not.toContain('## Customer Preferences')
  })

  it('includes customer tone/industry/instructions when customerContext is provided', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    await writeProposal(baseInput)

    const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
    expect(args.prompt).toContain('formal')
    expect(args.prompt).toContain('Government')
    expect(args.prompt).toContain('Emphasize security.')
  })

  it('returns { markdownContent } matching generateText output', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

    const result = await writeProposal(baseInput)

    expect(result.markdownContent).toBe(mockMarkdown)
  })

  describe('RFP metadata integration (KB-driven draft intelligence)', () => {
    it('includes rfpMetadata title in prompt when provided', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

      await writeProposal({
        ...baseInput,
        rfpName: 'Fallback Name',
        rfpMetadata: {
          title: 'Request for Proposal: Cloud Migration Services',
          issuingOrganization: 'Acme Corporation',
          referenceNumber: 'RFP-2026-089',
          submissionDeadline: 'March 31, 2026',
          projectStartDate: 'May 1, 2026',
          contactName: 'Jane Smith',
          contactEmail: 'jane@acme.com',
          contactPhone: null,
        },
      })

      const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
      expect(args.prompt).toContain('Request for Proposal: Cloud Migration Services')
      expect(args.prompt).toContain('Acme Corporation')
      expect(args.prompt).toContain('March 31, 2026')
      expect(args.prompt).toContain('RFP-2026-089')
    })

    it('uses rfpName as fallback when rfpMetadata title is null', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

      await writeProposal({
        ...baseInput,
        rfpName: 'My Custom RFP Name',
        rfpMetadata: {
          title: null,
          issuingOrganization: null,
          referenceNumber: null,
          submissionDeadline: null,
          projectStartDate: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
        },
      })

      const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
      expect(args.prompt).toContain('My Custom RFP Name')
    })

    it('uses rfpName as fallback when rfpMetadata is undefined', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

      await writeProposal({
        ...baseInput,
        rfpName: 'Fallback RFP Title',
      })

      const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
      expect(args.prompt).toContain('Fallback RFP Title')
    })

    it('omits null metadata fields from prompt (no "null" or "N/A" rendered)', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

      await writeProposal({
        ...baseInput,
        rfpName: 'Test RFP',
        rfpMetadata: {
          title: 'Test RFP Title',
          issuingOrganization: null,
          referenceNumber: null,
          submissionDeadline: null,
          projectStartDate: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
        },
      })

      const args = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }
      // Should not contain literal "null" as a metadata value
      expect(args.prompt).not.toMatch(/Issuing Organization:.*null/i)
      expect(args.prompt).not.toMatch(/Reference Number:.*null/i)
    })

    it('system prompt instructs to use exact RFP title verbatim', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as unknown as Awaited<ReturnType<typeof generateText>>)

      await writeProposal({
        ...baseInput,
        rfpName: 'Test',
        rfpMetadata: {
          title: 'Test Title',
          issuingOrganization: null,
          referenceNumber: null,
          submissionDeadline: null,
          projectStartDate: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
        },
      })

      const args = vi.mocked(generateText).mock.calls[0]![0] as { system: string }
      expect(args.system).toMatch(/exact RFP title/i)
    })
  })
})
