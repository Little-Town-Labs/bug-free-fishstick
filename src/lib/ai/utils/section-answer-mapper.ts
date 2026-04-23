import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'

export interface AnnotatedRfpSection {
  id: string
  title: string
  content: string
  hasClarification: boolean
  relevantAnswers: Array<{ question: string; answer: string }>
}

/**
 * Maps clarifying answers onto their corresponding RFP sections so the
 * proposal-writer prompt can interleave each section with its user-provided
 * context.  Answers with null/empty answer text are excluded.
 *
 * Matching is case-insensitive: exact match on rfpSection vs section title,
 * then substring containment in either direction.
 *
 * Answers that don't match any section are collected into a synthetic
 * "Additional Clarifications" section appended at the end (only if non-empty).
 */
export function mapSectionsToAnswers(
  rfpSections: ReadonlyArray<{ id: string; title: string; content: string }>,
  clarifyingAnswers: ReadonlyArray<ClarifyingQuestion>,
): AnnotatedRfpSection[] {
  // Filter to only answers with substantive text
  const answered = clarifyingAnswers.filter(
    (a) => a.answer !== null && a.answer.trim() !== '',
  )

  // Track which answers were matched so leftovers go to the general bucket
  const matched = new Set<string>()

  const annotated: AnnotatedRfpSection[] = rfpSections.map((section) => {
    const sectionLower = section.title.toLowerCase()
    const relevantAnswers: Array<{ question: string; answer: string }> = []

    for (const a of answered) {
      const rfpSecLower = a.rfpSection.toLowerCase()
      const isMatch =
        rfpSecLower === sectionLower ||
        sectionLower.includes(rfpSecLower) ||
        rfpSecLower.includes(sectionLower)

      if (isMatch) {
        relevantAnswers.push({ question: a.question, answer: a.answer! })
        matched.add(a.id)
      }
    }

    return {
      ...section,
      hasClarification: relevantAnswers.length > 0,
      relevantAnswers,
    }
  })

  // Collect unmatched answers into a general bucket
  const unmatched = answered.filter((a) => !matched.has(a.id))
  if (unmatched.length > 0) {
    annotated.push({
      id: '_additional_clarifications',
      title: 'Additional Clarifications',
      content: 'User-provided context that does not map to a specific RFP section.',
      hasClarification: true,
      relevantAnswers: unmatched.map((a) => ({
        question: a.question,
        answer: a.answer!,
      })),
    })
  }

  return annotated
}
