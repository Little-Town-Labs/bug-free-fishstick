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
    send: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/ai/agents/proposal-question-generator', () => ({
  generateClarifyingQuestions: vi.fn(),
}))

import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'
import { generateClarifyingQuestions } from '@/lib/ai/agents/proposal-question-generator'
import {
  createDraft,
  submitAnswers,
  getDraft,
  listDrafts,
  updateDraftContent,
  cancelDraft,
} from '@/lib/services/proposal-draft'

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

const mockQuestions = [
  { id: 'q1', question: 'What pricing model?', rfpSection: 'Pricing', answer: null },
  { id: 'q2', question: 'Any certifications?', rfpSection: 'Standards', answer: null },
  { id: 'q3', question: 'Preferred timeline?', rfpSection: 'Schedule', answer: null },
]

const mockDraft = {
  id: 'draft-1',
  rfpId: 'rfp-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  status: 'awaiting_answers' as const,
  clarifyingQuestions: mockQuestions,
  markdownContent: null,
  generationError: null,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function mockSelectReturns<T>(rows: T[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any)
}

function mockSelectMulti<T>(rows: T[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as any)
}

function mockInsertReturns<T>(row: T) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([row]),
    }),
  } as any)
}

function mockUpdateReturns<T>(row: T) {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([row]),
      }),
    }),
  } as any)
}

describe('proposal-draft service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDraft', () => {
    it('should create a draft record with awaiting_answers status', async () => {
      // RFP select
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRfp]),
          }),
        }),
      } as any)
      vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: mockQuestions })
      mockInsertReturns(mockDraft)

      const result = await createDraft('rfp-1', 'org-1', 'user-1')

      expect(result.status).toBe('awaiting_answers')
      expect(db.insert).toHaveBeenCalled()
    })

    it('should throw if RFP has no parsedStructure', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockRfp, parsedStructure: null }]),
          }),
        }),
      } as any)

      await expect(createDraft('rfp-1', 'org-1', 'user-1')).rejects.toThrow(
        'RFP must be processed before generating a proposal'
      )
    })

    it('should throw if RFP does not belong to org', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      await expect(createDraft('rfp-1', 'wrong-org', 'user-1')).rejects.toThrow()
    })

    it('should call generateClarifyingQuestions with RFP fields and summary', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRfp]),
          }),
        }),
      } as any)
      vi.mocked(generateClarifyingQuestions).mockResolvedValue({ questions: mockQuestions })
      mockInsertReturns(mockDraft)

      await createDraft('rfp-1', 'org-1', 'user-1')

      expect(generateClarifyingQuestions).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' })
      )
    })
  })

  describe('submitAnswers', () => {
    it('should transition draft status to generating', async () => {
      mockSelectReturns([mockDraft])
      mockUpdateReturns({ ...mockDraft, status: 'generating', clarifyingQuestions: mockQuestions.map((q, i) => ({ ...q, answer: `answer ${i}` })) })

      const answers = mockQuestions.map(q => ({ id: q.id, answer: `Answer for ${q.id}` }))
      const result = await submitAnswers('draft-1', 'org-1', answers)

      expect(result.status).toBe('generating')
    })

    it('should fire the proposal/generate Inngest event', async () => {
      mockSelectReturns([mockDraft])
      mockUpdateReturns({ ...mockDraft, status: 'generating' })

      const answers = mockQuestions.map(q => ({ id: q.id, answer: 'some answer' }))
      await submitAnswers('draft-1', 'org-1', answers)

      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'proposal/generate' })
      )
    })

    it('should throw if draft is not in awaiting_answers state', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'generating' }])

      await expect(submitAnswers('draft-1', 'org-1', [])).rejects.toThrow()
    })

    it('should throw if draft does not belong to org', async () => {
      mockSelectReturns([])

      await expect(submitAnswers('draft-1', 'wrong-org', [])).rejects.toThrow()
    })
  })

  describe('updateDraftContent', () => {
    it('should store markdown and transition status to draft', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'generating' }])
      mockUpdateReturns({ ...mockDraft, status: 'draft', markdownContent: '# Proposal\n\nContent here.' })

      const result = await updateDraftContent('draft-1', 'org-1', '# Proposal\n\nContent here.')

      expect(result.status).toBe('draft')
      expect(result.markdownContent).toBeTruthy()
    })
  })

  describe('getDraft', () => {
    it('should return draft with org scope check', async () => {
      mockSelectReturns([mockDraft])

      const result = await getDraft('draft-1', 'org-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('draft-1')
    })

    it('should return null when draft belongs to different org', async () => {
      mockSelectReturns([])

      const result = await getDraft('draft-1', 'wrong-org')

      expect(result).toBeNull()
    })
  })

  describe('listDrafts', () => {
    it('should return all drafts for an RFP scoped to org', async () => {
      mockSelectMulti([mockDraft, { ...mockDraft, id: 'draft-2', version: 2 }])

      const result = await listDrafts('rfp-1', 'org-1')

      expect(result).toHaveLength(2)
    })

    it('should return empty array when no drafts exist', async () => {
      mockSelectMulti([])

      const result = await listDrafts('rfp-1', 'org-1')

      expect(result).toHaveLength(0)
    })
  })

  describe('cancelDraft', () => {
    it('should set status to error with Cancelled by user message when draft is generating', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'generating' }])
      mockUpdateReturns({ ...mockDraft, status: 'error', generationError: 'Cancelled by user' })

      const result = await cancelDraft('draft-1', 'org-1')

      expect(result.status).toBe('error')
      expect(result.generationError).toBe('Cancelled by user')
    })

    it('should throw if draft is not in generating state', async () => {
      mockSelectReturns([{ ...mockDraft, status: 'draft' }])

      await expect(cancelDraft('draft-1', 'org-1')).rejects.toThrow()
    })
  })
})
