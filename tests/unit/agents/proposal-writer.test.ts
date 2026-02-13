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

const baseInput: WriteProposalInput = {
  rfpSections: [
    { title: 'Pricing and Payment Terms', content: 'Vendor must provide fixed-price bid.' },
    { title: 'Security Requirements', content: 'SOC 2 Type II required.' },
  ],
  knowledgeContext: [
    { content: 'We offer fixed-price and T&M engagements.', source: 'capability-statement' },
    { content: 'We hold SOC 2 Type II and ISO 27001 certifications.', source: 'certifications-doc' },
  ],
  contentLibraryEntries: [
    { id: 'cl-1', name: 'Standard Hourly Rate', category: 'Pricing', content: 'Our standard rate is $150/hour.' },
  ],
  clarifyingAnswers: [
    { id: 'q1', question: 'What is your preferred pricing model?', rfpSection: 'Pricing and Payment Terms', answer: 'Fixed price preferred.' },
  ],
  organizationId: 'org-1',
}

const mockMarkdown = `# Proposal

## Pricing and Payment Terms
> *Source: content library — Standard Hourly Rate*

We propose a fixed-price engagement. Our standard rate is $150/hour.

## Security Requirements
> *Source: knowledge base*

We hold SOC 2 Type II and ISO 27001 certifications.
`

describe('proposal-writer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('writeProposal', () => {
    describe('happy path', () => {
      it('should return non-empty markdown content', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as any)

        const result = await writeProposal(baseInput)

        expect(result.markdownContent).toBeTruthy()
        expect(result.markdownContent.length).toBeGreaterThan(0)
      })

      it('should incorporate user clarifying answers into the proposal', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as any)

        await writeProposal(baseInput)

        const callArgs = vi.mocked(generateText).mock.calls[0]!
        const prompt = JSON.stringify(callArgs[0])
        expect(prompt).toContain('Fixed price preferred')
      })

      it('should incorporate knowledge context into the proposal', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as any)

        await writeProposal(baseInput)

        const callArgs = vi.mocked(generateText).mock.calls[0]!
        const prompt = JSON.stringify(callArgs[0])
        expect(prompt).toContain('SOC 2 Type II')
      })

      it('should incorporate content library entries into the proposal', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as any)

        await writeProposal(baseInput)

        const callArgs = vi.mocked(generateText).mock.calls[0]!
        const prompt = JSON.stringify(callArgs[0])
        expect(prompt).toContain('Standard Hourly Rate')
      })

      it('should include > *Source: knowledge base* annotation for knowledge-sourced sections', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as any)

        const result = await writeProposal(baseInput)

        expect(result.markdownContent).toContain('> *Source: knowledge base*')
      })

      it('should include > *Source: content library — [entry name]* annotation for library-sourced sections', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as any)

        const result = await writeProposal(baseInput)

        expect(result.markdownContent).toContain('> *Source: content library — Standard Hourly Rate*')
      })
    })

    describe('edge cases', () => {
      it('should handle empty content library gracefully', async () => {
        const markdownNoLibrary = `# Proposal\n\n## Pricing\n> *Source: user answer*\n\nFixed price.\n`
        vi.mocked(generateText).mockResolvedValue({ text: markdownNoLibrary } as any)

        const result = await writeProposal({
          ...baseInput,
          contentLibraryEntries: [],
        })

        expect(result.markdownContent).toBeTruthy()
      })

      it('should handle empty knowledge context gracefully', async () => {
        const markdownNoKnowledge = `# Proposal\n\n## Pricing\n> *Source: user answer*\n\nFixed price.\n`
        vi.mocked(generateText).mockResolvedValue({ text: markdownNoKnowledge } as any)

        const result = await writeProposal({
          ...baseInput,
          knowledgeContext: [],
        })

        expect(result.markdownContent).toBeTruthy()
      })

      it('should handle skipped (empty) clarifying answers without breaking generation', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: mockMarkdown } as any)

        const result = await writeProposal({
          ...baseInput,
          clarifyingAnswers: [
            { id: 'q1', question: 'What pricing model?', rfpSection: 'Pricing', answer: '' },
          ],
        })

        expect(result.markdownContent).toBeTruthy()
      })

      it('should propagate LLM timeout errors', async () => {
        vi.mocked(generateText).mockRejectedValue(new Error('LLM request timed out'))

        await expect(writeProposal(baseInput)).rejects.toThrow('LLM request timed out')
      })

      it('should handle malformed (non-string) LLM response', async () => {
        vi.mocked(generateText).mockResolvedValue({ text: null } as any)

        await expect(writeProposal(baseInput)).rejects.toThrow()
      })
    })
  })
})
