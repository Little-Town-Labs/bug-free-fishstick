import { describe, it, expect } from 'vitest'
import { mapSectionsToAnswers } from '@/lib/ai/utils/section-answer-mapper'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'

function makeQuestion(overrides: Partial<ClarifyingQuestion> & { id: string; question: string; rfpSection: string }): ClarifyingQuestion {
  return { answer: null, ...overrides }
}

const baseSections = [
  { id: 'f1', title: 'Company Background', content: 'Describe your company.' },
  { id: 'f2', title: 'Technical Approach', content: 'Describe your approach.' },
  { id: 'f3', title: 'QA/UAT Framework', content: 'Describe your QA process.' },
  { id: 'f4', title: 'Pricing Information', content: 'Provide pricing.' },
]

describe('mapSectionsToAnswers', () => {
  it('returns all sections with hasClarification false when no answers are provided', () => {
    const result = mapSectionsToAnswers(baseSections, [])
    expect(result).toHaveLength(4)
    expect(result.every((s) => !s.hasClarification)).toBe(true)
    expect(result.every((s) => s.relevantAnswers.length === 0)).toBe(true)
  })

  it('returns all sections with hasClarification false when all answers are null', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Timeline?', rfpSection: 'Company Background', answer: null }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    expect(result).toHaveLength(4)
    expect(result.every((s) => !s.hasClarification)).toBe(true)
  })

  it('excludes answers with empty string', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Timeline?', rfpSection: 'Company Background', answer: '' }),
      makeQuestion({ id: 'q2', question: 'Details?', rfpSection: 'Company Background', answer: '   ' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    expect(result).toHaveLength(4)
    expect(result[0]!.hasClarification).toBe(false)
  })

  it('matches by exact rfpSection (case-insensitive)', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Who are you?', rfpSection: 'company background', answer: 'We are Acme.' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    expect(result[0]!.hasClarification).toBe(true)
    expect(result[0]!.relevantAnswers).toEqual([{ question: 'Who are you?', answer: 'We are Acme.' }])
    // Other sections should not match
    expect(result[1]!.hasClarification).toBe(false)
    expect(result[2]!.hasClarification).toBe(false)
  })

  it('matches by substring: section title contains rfpSection', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Approach?', rfpSection: 'Technical', answer: 'We use Agile.' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    // "Technical Approach" contains "Technical"
    expect(result[1]!.hasClarification).toBe(true)
    expect(result[1]!.relevantAnswers[0]!.answer).toBe('We use Agile.')
  })

  it('matches by substring: rfpSection contains section title', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'QA?', rfpSection: 'QA/UAT Framework and Testing', answer: 'We do TDD.' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    // "QA/UAT Framework and Testing" contains "QA/UAT Framework"
    expect(result[2]!.hasClarification).toBe(true)
    expect(result[2]!.relevantAnswers[0]!.answer).toBe('We do TDD.')
  })

  it('maps multiple answers to the same section', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Budget?', rfpSection: 'Pricing Information', answer: '$100k' }),
      makeQuestion({ id: 'q2', question: 'Payment terms?', rfpSection: 'Pricing', answer: 'Net 30' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    // "Pricing Information" contains "Pricing" — both should match
    expect(result[3]!.hasClarification).toBe(true)
    expect(result[3]!.relevantAnswers).toHaveLength(2)
  })

  it('collects unmatched answers into Additional Clarifications bucket', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Team size?', rfpSection: 'Staffing Plan', answer: '12 people' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    // Original 4 sections + 1 additional bucket
    expect(result).toHaveLength(5)
    const bucket = result[4]!
    expect(bucket.id).toBe('_additional_clarifications')
    expect(bucket.title).toBe('Additional Clarifications')
    expect(bucket.hasClarification).toBe(true)
    expect(bucket.relevantAnswers).toEqual([{ question: 'Team size?', answer: '12 people' }])
  })

  it('does not add Additional Clarifications when all answers are matched', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Who?', rfpSection: 'Company Background', answer: 'Acme' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    expect(result).toHaveLength(4)
    expect(result.find((s) => s.id === '_additional_clarifications')).toBeUndefined()
  })

  it('preserves original section fields (id, title, content)', () => {
    const result = mapSectionsToAnswers(baseSections, [])
    expect(result[0]).toMatchObject({
      id: 'f1',
      title: 'Company Background',
      content: 'Describe your company.',
    })
  })

  it('handles mixed answered and unanswered questions', () => {
    const answers = [
      makeQuestion({ id: 'q1', question: 'Who?', rfpSection: 'Company Background', answer: 'Acme' }),
      makeQuestion({ id: 'q2', question: 'Approach?', rfpSection: 'Technical Approach', answer: null }),
      makeQuestion({ id: 'q3', question: 'QA?', rfpSection: 'QA/UAT Framework', answer: 'We test everything.' }),
      makeQuestion({ id: 'q4', question: 'Price?', rfpSection: 'Pricing Information', answer: '' }),
    ]
    const result = mapSectionsToAnswers(baseSections, answers)
    expect(result).toHaveLength(4) // no unmatched bucket
    expect(result[0]!.hasClarification).toBe(true)  // Company Background — answered
    expect(result[1]!.hasClarification).toBe(false)  // Technical Approach — null
    expect(result[2]!.hasClarification).toBe(true)   // QA/UAT — answered
    expect(result[3]!.hasClarification).toBe(false)  // Pricing — empty string
  })
})
