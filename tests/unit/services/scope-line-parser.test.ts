import { describe, it, expect } from 'vitest'
import { parseScopeLines } from '@/lib/services/scope-line-parser'
import { MANDATORY_QUESTION_IDS } from '@/lib/ai/agents/proposal-question-generator'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'

function makeQuestion(answer: string | null): ClarifyingQuestion[] {
  return [
    {
      id: MANDATORY_QUESTION_IDS.DELIVERABLES,
      question: 'What are the scope deliverables?',
      rfpSection: 'Scope',
      answer,
    },
  ]
}

describe('parseScopeLines', () => {
  it('returns [] when scope-deliverables question is not present', () => {
    const questions: ClarifyingQuestion[] = [
      { id: 'other-question', question: 'Something else', rfpSection: 'Other', answer: 'yes' },
    ]
    expect(parseScopeLines(questions)).toEqual([])
  })

  it('returns [] when scope-deliverables answer is null', () => {
    expect(parseScopeLines(makeQuestion(null))).toEqual([])
  })

  it('returns [] when scope-deliverables answer is empty string', () => {
    expect(parseScopeLines(makeQuestion(''))).toEqual([])
  })

  it('returns [] when answer has text but no parseable quantity/unit', () => {
    expect(parseScopeLines(makeQuestion('We will handle the full project'))).toEqual([])
  })

  it('parses single line with hours', () => {
    const result = parseScopeLines(makeQuestion('Requirements Analysis: 40 hours'))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ quantity: 40, unit: 'hour' })
    expect(result[0]!.description).toContain('Requirements Analysis')
  })

  it('parses single line with role pattern "by [Role]"', () => {
    const result = parseScopeLines(makeQuestion('Development by Senior Developer: 120 hrs'))
    expect(result).toHaveLength(1)
    expect(result[0]!.role).toBe('Senior Developer')
  })

  it('parses multi-line answer with newline separators', () => {
    const answer = 'Requirements Analysis: 40 hours\nDesign: 20 hours\nImplementation: 80 hours'
    const result = parseScopeLines(makeQuestion(answer))
    expect(result).toHaveLength(3)
  })

  it('parses day unit keyword', () => {
    const result = parseScopeLines(makeQuestion('2 days of workshops'))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ quantity: 2, unit: 'day' })
  })

  it('parses fixed unit keyword', () => {
    const result = parseScopeLines(makeQuestion('1 fixed deliverable'))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ quantity: 1, unit: 'fixed' })
  })

  it('parses mixed units in a single answer', () => {
    const answer = 'Analysis: 40 hours\nWorkshops: 3 days\nReport: 1 fixed'
    const result = parseScopeLines(makeQuestion(answer))
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ unit: 'hour' })
    expect(result[1]).toMatchObject({ unit: 'day' })
    expect(result[2]).toMatchObject({ unit: 'fixed' })
  })

  it('caps at 20 items', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Task ${i + 1}: ${i + 1} hours`)
    const result = parseScopeLines(makeQuestion(lines.join('\n')))
    expect(result).toHaveLength(20)
  })

  it('skips lines with no parseable unit', () => {
    const answer = 'Analysis: 40 hours\nGeneral management\nDesign: 20 hours'
    const result = parseScopeLines(makeQuestion(answer))
    expect(result).toHaveLength(2)
  })
})
