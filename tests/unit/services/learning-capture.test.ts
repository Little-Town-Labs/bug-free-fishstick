import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  learnings: {},
}))

import { captureCorrection, captureManualLearning } from '@/lib/services/learning-capture'
import { db } from '@/lib/db'

describe('learning-capture service', () => {
  const mockLearningRow = {
    id: '00000000-0000-4000-8000-000000000001',
    organizationId: 'org_123',
    customerId: 'cust-456',
    content: 'Field correction: corrected answer',
    sourceType: 'user_correction',
    createdBy: 'user_abc',
    sourceMetadata: {
      rfpId: 'rfp-789',
      fieldId: 'field-001',
      originalText: 'original answer',
      correctedText: 'corrected answer',
    },
    createdAt: new Date('2025-01-01T00:00:00Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const mockDb = vi.mocked(db)
    mockDb.insert = vi.fn().mockReturnThis()
    ;(mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values = vi.fn().mockReturnThis()
    ;(mockDb as unknown as { returning: ReturnType<typeof vi.fn> }).returning = vi.fn().mockResolvedValue([mockLearningRow])
  })

  describe('captureCorrection()', () => {
    const correctionInput = {
      rfpId: 'rfp-789',
      fieldId: 'field-001',
      organizationId: 'org_123',
      customerId: 'cust-456',
      createdBy: 'user_abc',
      originalText: 'original answer',
      correctedText: 'corrected answer',
    }

    it('inserts a user_correction learning record', async () => {
      const result = await captureCorrection(correctionInput)
      expect(db.insert).toHaveBeenCalledWith(expect.anything())
      expect(result).toEqual(mockLearningRow)
    })

    it('includes originalText and correctedText in sourceMetadata', async () => {
      await captureCorrection(correctionInput)
      const valuesCall = (db as unknown as { values: ReturnType<typeof vi.fn> }).values
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceMetadata: expect.objectContaining({
            originalText: 'original answer',
            correctedText: 'corrected answer',
            rfpId: 'rfp-789',
            fieldId: 'field-001',
          }),
        })
      )
    })

    it('sets sourceType to user_correction', async () => {
      await captureCorrection(correctionInput)
      const valuesCall = (db as unknown as { values: ReturnType<typeof vi.fn> }).values
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'user_correction' })
      )
    })
  })

  describe('captureManualLearning()', () => {
    const mockManualRow = {
      ...mockLearningRow,
      sourceType: 'manual_entry',
      customerId: null,
      sourceMetadata: null,
      content: 'Org-wide insight',
    }

    beforeEach(() => {
      ;(db as unknown as { returning: ReturnType<typeof vi.fn> }).returning = vi.fn().mockResolvedValue([mockManualRow])
    })

    it('inserts a manual_entry learning record', async () => {
      const result = await captureManualLearning({
        organizationId: 'org_123',
        content: 'Org-wide insight',
        createdBy: 'user_abc',
      })
      expect(db.insert).toHaveBeenCalledWith(expect.anything())
      expect(result.sourceType).toBe('manual_entry')
    })

    it('allows null customerId for org-wide learnings', async () => {
      await captureManualLearning({
        organizationId: 'org_123',
        content: 'Org-wide insight',
        createdBy: 'user_abc',
      })
      const valuesCall = (db as unknown as { values: ReturnType<typeof vi.fn> }).values
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: null })
      )
    })
  })
})
