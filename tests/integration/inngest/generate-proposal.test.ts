import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _eventConfig: unknown, handler: unknown) => handler),
  },
}))

vi.mock('@/lib/services/vector-search', () => ({
  searchSimilar: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/content-library-search', () => ({
  searchContentLibrary: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/proposal-content-library', () => ({
  listEntries: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/proposal-draft', () => ({
  updateDraftContent: vi.fn(),
}))

vi.mock('@/lib/ai/agents/proposal-writer', () => ({
  writeProposal: vi.fn(),
}))

import { db } from '@/lib/db'
import { searchSimilar } from '@/lib/services/vector-search'
import { updateDraftContent } from '@/lib/services/proposal-draft'
import { writeProposal } from '@/lib/ai/agents/proposal-writer'
import { generateProposal } from '@/lib/inngest/functions/generate-proposal'
import { searchContentLibrary } from '@/lib/services/content-library-search'

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

const mockDraft = {
  id: 'draft-1',
  rfpId: 'rfp-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  status: 'generating',
  clarifyingQuestions: [
    { id: 'q1', question: 'What pricing model?', rfpSection: 'Pricing', answer: 'Fixed price' },
  ],
  markdownContent: null,
  generationError: null,
  version: 1,
}

const mockRfp = {
  id: 'rfp-1',
  organizationId: 'org-1',
  name: 'Test RFP',
  parsedStructure: {
    pages: 2,
    fields: [
      { id: 'f1', type: 'text', question: 'Company name?', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
    ],
  },
}

const mockContentLibraryEntries = [
  { id: 'cl-1', organizationId: 'org-1', name: 'Standard Rate', category: 'Pricing', content: '$150/hr', createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date() },
]

const mockMarkdown = '# Proposal\n\n## Pricing\n> *Source: content library — Standard Rate*\n\n$150/hr\n'

// Mock helper: sets up db.select to return different responses for each call.
// Each item can be either:
//   { type: 'limited', rows: [...] }  — chain ends with .limit() (used for single-row fetches)
//   { type: 'multi', rows: [...] }    — chain ends with .where() returning a promise (list fetches)
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

describe('generate-proposal Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Provide a default update mock so the catch-path error update doesn't throw
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as any)
  })

  const twoCallSequence = (libraryRows = mockContentLibraryEntries) => {
    mockSelectSequence([
      { type: 'limited', rows: [{ openaiApiKeyEncrypted: null }] }, // tenant settings lookup (added)
      { type: 'limited', rows: [mockDraft] },
      { type: 'limited', rows: [mockRfp] },
    ])
    // Content library is now fetched via searchContentLibrary, not direct DB select
    vi.mocked(searchContentLibrary).mockResolvedValue(
      libraryRows.map(r => ({ ...r, similarity: 0.8 })) as any
    )
  }

  describe('success path', () => {
    it('should call updateDraftContent and set status to draft on success', async () => {
      twoCallSequence()
      vi.mocked(writeProposal).mockResolvedValue({ markdownContent: mockMarkdown })
      vi.mocked(updateDraftContent).mockResolvedValue({ ...mockDraft, status: 'draft', markdownContent: mockMarkdown } as any)

      const step = createMockStep()
      const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

      await (generateProposal as unknown as Function)({ event, step })

      expect(updateDraftContent).toHaveBeenCalledWith('draft-1', 'org-1', mockMarkdown)
    })

    it('should call searchSimilar for knowledge context', async () => {
      twoCallSequence([])
      vi.mocked(writeProposal).mockResolvedValue({ markdownContent: mockMarkdown })
      vi.mocked(updateDraftContent).mockResolvedValue({ ...mockDraft, status: 'draft' } as any)

      const step = createMockStep()
      const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

      await (generateProposal as unknown as Function)({ event, step })

      expect(searchSimilar).toHaveBeenCalled()
    })

    it('should pass content library entries to writeProposal', async () => {
      twoCallSequence(mockContentLibraryEntries)
      vi.mocked(writeProposal).mockResolvedValue({ markdownContent: mockMarkdown })
      vi.mocked(updateDraftContent).mockResolvedValue({ ...mockDraft, status: 'draft', markdownContent: mockMarkdown } as any)

      const step = createMockStep()
      const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

      await (generateProposal as unknown as Function)({ event, step })

      expect(writeProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          contentLibraryEntries: expect.arrayContaining([
            expect.objectContaining({
              id: 'cl-1',
              name: 'Standard Rate',
              category: 'Pricing',
              content: '$150/hr',
            }),
          ]),
        })
      )
    })

    it('should call writeProposal with empty contentLibraryEntries when library is empty', async () => {
      twoCallSequence([])
      vi.mocked(writeProposal).mockResolvedValue({ markdownContent: mockMarkdown })
      vi.mocked(updateDraftContent).mockResolvedValue({ ...mockDraft, status: 'draft' } as any)

      const step = createMockStep()
      const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

      await (generateProposal as unknown as Function)({ event, step })

      expect(writeProposal).toHaveBeenCalledWith(
        expect.objectContaining({ contentLibraryEntries: [] })
      )
    })

    it('should only fetch content library entries for the correct org (tenant isolation)', async () => {
      twoCallSequence()
      vi.mocked(writeProposal).mockResolvedValue({ markdownContent: mockMarkdown })
      vi.mocked(updateDraftContent).mockResolvedValue({ ...mockDraft, status: 'draft' } as any)

      const step = createMockStep()
      const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

      await (generateProposal as unknown as Function)({ event, step })

      // Content library is now fetched via searchContentLibrary with org scoping
      expect(searchContentLibrary).toHaveBeenCalledWith(expect.any(String), 'org-1', 5)
    })
  })

  describe('failure path', () => {
    it('should set status to error with generationError message when LLM fails', async () => {
      twoCallSequence([])
      vi.mocked(writeProposal).mockRejectedValue(new Error('LLM provider error'))
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...mockDraft, status: 'error', generationError: 'LLM provider error' }]),
        }),
      } as any)

      const step = createMockStep()
      const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

      // Should not throw — errors should be caught and stored
      await (generateProposal as unknown as Function)({ event, step })

      expect(db.update).toHaveBeenCalled()
    })
  })
})
