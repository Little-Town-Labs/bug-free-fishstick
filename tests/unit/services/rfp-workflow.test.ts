import { describe, it, expect } from 'vitest'
import {
  canTransition,
  validateTransition,
  getAvailableTransitions,
  WorkflowError,
  VALID_TRANSITIONS,
} from '@/lib/services/rfp-workflow'
import type { RfpStatus } from '@/lib/db/schema/rfps'

describe('rfp-workflow service', () => {
  describe('VALID_TRANSITIONS', () => {
    it('defines transitions for all statuses', () => {
      const statuses: RfpStatus[] = ['draft', 'processing', 'submitted', 'approved', 'finalized']
      for (const status of statuses) {
        expect(VALID_TRANSITIONS[status]).toBeDefined()
      }
    })

    it('draft can only transition to submitted', () => {
      expect(VALID_TRANSITIONS['draft']).toEqual(['submitted'])
    })

    it('submitted can transition to approved or draft', () => {
      expect(VALID_TRANSITIONS['submitted']).toContain('approved')
      expect(VALID_TRANSITIONS['submitted']).toContain('draft')
    })

    it('approved can only transition to finalized', () => {
      expect(VALID_TRANSITIONS['approved']).toEqual(['finalized'])
    })

    it('finalized has no valid transitions', () => {
      expect(VALID_TRANSITIONS['finalized']).toEqual([])
    })

    it('processing has no valid transitions in approval workflow', () => {
      expect(VALID_TRANSITIONS['processing']).toEqual([])
    })
  })

  describe('canTransition()', () => {
    it('returns true for draft → submitted', () => {
      expect(canTransition('draft', 'submitted')).toBe(true)
    })

    it('returns true for submitted → approved', () => {
      expect(canTransition('submitted', 'approved')).toBe(true)
    })

    it('returns true for submitted → draft (return)', () => {
      expect(canTransition('submitted', 'draft')).toBe(true)
    })

    it('returns true for approved → finalized', () => {
      expect(canTransition('approved', 'finalized')).toBe(true)
    })

    it('returns false for draft → approved (skip)', () => {
      expect(canTransition('draft', 'approved')).toBe(false)
    })

    it('returns false for draft → finalized', () => {
      expect(canTransition('draft', 'finalized')).toBe(false)
    })

    it('returns false for finalized → draft', () => {
      expect(canTransition('finalized', 'draft')).toBe(false)
    })

    it('returns false for finalized → submitted', () => {
      expect(canTransition('finalized', 'submitted')).toBe(false)
    })

    it('returns false for approved → submitted', () => {
      expect(canTransition('approved', 'submitted')).toBe(false)
    })

    it('returns false for processing → submitted', () => {
      expect(canTransition('processing', 'submitted')).toBe(false)
    })

    it('returns false for same status transition', () => {
      expect(canTransition('draft', 'draft')).toBe(false)
    })
  })

  describe('validateTransition()', () => {
    it('does not throw for valid transitions', () => {
      expect(() => validateTransition('draft', 'submitted')).not.toThrow()
      expect(() => validateTransition('submitted', 'approved')).not.toThrow()
      expect(() => validateTransition('submitted', 'draft')).not.toThrow()
      expect(() => validateTransition('approved', 'finalized')).not.toThrow()
    })

    it('throws WorkflowError for invalid transition', () => {
      expect(() => validateTransition('draft', 'approved')).toThrow(WorkflowError)
    })

    it('throws WorkflowError with 409 status code', () => {
      try {
        validateTransition('finalized', 'draft')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(WorkflowError)
        expect((err as WorkflowError).statusCode).toBe(409)
      }
    })

    it('throws with descriptive message', () => {
      try {
        validateTransition('draft', 'finalized')
        expect.fail('Should have thrown')
      } catch (err) {
        expect((err as WorkflowError).message).toContain('draft')
        expect((err as WorkflowError).message).toContain('finalized')
      }
    })

    it('throws for finalized → any transition', () => {
      const targets: RfpStatus[] = ['draft', 'processing', 'submitted', 'approved']
      for (const target of targets) {
        expect(() => validateTransition('finalized', target)).toThrow(WorkflowError)
      }
    })
  })

  describe('getAvailableTransitions()', () => {
    it('returns [submitted] for draft', () => {
      expect(getAvailableTransitions('draft')).toEqual(['submitted'])
    })

    it('returns [approved, draft] for submitted', () => {
      const transitions = getAvailableTransitions('submitted')
      expect(transitions).toContain('approved')
      expect(transitions).toContain('draft')
    })

    it('returns [finalized] for approved', () => {
      expect(getAvailableTransitions('approved')).toEqual(['finalized'])
    })

    it('returns [] for finalized', () => {
      expect(getAvailableTransitions('finalized')).toEqual([])
    })

    it('returns [] for processing', () => {
      expect(getAvailableTransitions('processing')).toEqual([])
    })
  })

  describe('WorkflowError', () => {
    it('is an instance of Error', () => {
      const err = new WorkflowError('test')
      expect(err).toBeInstanceOf(Error)
    })

    it('defaults to statusCode 409', () => {
      const err = new WorkflowError('test')
      expect(err.statusCode).toBe(409)
    })

    it('accepts custom statusCode', () => {
      const err = new WorkflowError('test', 422)
      expect(err.statusCode).toBe(422)
    })
  })
})
