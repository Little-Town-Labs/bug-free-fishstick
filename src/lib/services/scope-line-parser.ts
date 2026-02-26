import { MANDATORY_QUESTION_IDS } from '@/lib/ai/agents/proposal-question-generator'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'
import type { ScopeLineItem } from '@/lib/services/pricing-computation'

type ScopeLine = {
  description: string
  role: string | null
  quantity: number
  unit: 'hour' | 'day' | 'fixed'
}

const MAX_ITEMS = 20

const UNIT_PATTERNS: Array<{ regex: RegExp; unit: ScopeLine['unit'] }> = [
  { regex: /\b(?:hours?|hrs?)\b/i, unit: 'hour' },
  { regex: /\b(?:days?)\b/i, unit: 'day' },
  { regex: /\bfixed\b/i, unit: 'fixed' },
]

const QUANTITY_REGEX = /(\d+(?:\.\d+)?)/

const ROLE_BY_REGEX = /\s+by\s+([A-Z][A-Za-z\s]+?)(?:\s*[:;,\-]|\s*$)/
const ROLE_PAREN_REGEX = /\(([^)]+)\)/

/**
 * Extracts structured scope line items from the scope-deliverables
 * clarifying question answer. Pure function — no I/O, never throws.
 */
export function parseScopeLines(clarifyingQuestions: ClarifyingQuestion[]): ScopeLineItem[] {
  const question = clarifyingQuestions.find(
    (q) => q.id === MANDATORY_QUESTION_IDS.DELIVERABLES
  )
  if (!question?.answer) return []

  const answer = question.answer.trim()
  if (!answer) return []

  const segments = answer.split(/[\n;]|(?:^|\n)\s*[-*•]\s*/).filter(Boolean)
  const items: ScopeLine[] = []

  for (const segment of segments) {
    if (items.length >= MAX_ITEMS) break

    const line = segment.trim()
    if (!line) continue

    const qtyMatch = line.match(QUANTITY_REGEX)
    if (!qtyMatch) continue

    const quantity = parseFloat(qtyMatch[1]!)

    let unit: ScopeLine['unit'] | null = null
    for (const pattern of UNIT_PATTERNS) {
      if (pattern.regex.test(line)) {
        unit = pattern.unit
        break
      }
    }
    if (!unit) continue

    let role: string | null = null
    let description = line

    const roleByMatch = description.match(ROLE_BY_REGEX)
    if (roleByMatch) {
      role = roleByMatch[1]!.trim()
      description = description.replace(ROLE_BY_REGEX, ' ')
    } else {
      const roleParenMatch = description.match(ROLE_PAREN_REGEX)
      if (roleParenMatch) {
        role = roleParenMatch[1]!.trim()
        description = description.replace(ROLE_PAREN_REGEX, '')
      }
    }

    // Remove quantity and unit tokens from description
    description = description
      .replace(QUANTITY_REGEX, '')
      .replace(UNIT_PATTERNS.find((p) => p.unit === unit)!.regex, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s:,\-]+|[\s:,\-]+$/g, '')
      .trim()

    items.push({ description, role, quantity, unit })
  }

  return items
}
