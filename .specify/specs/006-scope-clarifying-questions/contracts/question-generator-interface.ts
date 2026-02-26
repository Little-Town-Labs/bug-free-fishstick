/**
 * Contract: GenerateClarifyingQuestionsInput (F6 modified interface)
 *
 * This file documents the TypeScript interface contract for the modified
 * `generateClarifyingQuestions` function. It is a contract artifact — the
 * actual implementation lives in:
 *   src/lib/ai/agents/proposal-question-generator.ts
 *
 * F8 (008-revised-proposal-pipeline) depends on the stable question IDs
 * exported as MANDATORY_QUESTION_IDS below.
 */

import type { ProposalDefaults } from '@/lib/db/schema/tenant-settings'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'

// ---------------------------------------------------------------------------
// Stable question IDs — F8 contract
// These are code constants, not admin-configurable values.
// F8's scope-line parser identifies mandatory answers via these IDs.
// ---------------------------------------------------------------------------

export const MANDATORY_QUESTION_IDS = {
  /** Always present. Wording varies by pricingModel. */
  DELIVERABLES: 'scope-deliverables',
  /** Always present. Wording is model-independent. */
  EXCLUSIONS:   'scope-exclusions',
  /** Always present. Wording is model-independent. */
  TIMELINE:     'scope-timeline',
} as const

export type MandatoryQuestionId = typeof MANDATORY_QUESTION_IDS[keyof typeof MANDATORY_QUESTION_IDS]

// ---------------------------------------------------------------------------
// Modified input interface (pricingModel added)
// ---------------------------------------------------------------------------

export interface GenerateClarifyingQuestionsInput {
  rfpFields: Array<{
    id: string
    type: 'text' | 'paragraph' | 'checkbox' | 'table'
    question: string
    position: { page: number; x: number; y: number; width: number; height: number }
  }>
  rfpSummary: string
  knowledgeTopics: string[]
  contentLibraryCategories: string[]
  organizationId: string
  /**
   * The organization's configured pricing model, read from
   * tenant_settings.proposalDefaults.pricingModel.
   *
   * Null means no pricing model is configured; the generator falls back to
   * 'time_and_materials' phrasing (hours per deliverable).
   *
   * Optional for backward compatibility — omitting it is equivalent to null.
   */
  pricingModel?: ProposalDefaults['pricingModel'] | null
}

// ---------------------------------------------------------------------------
// Return type (unchanged)
// ---------------------------------------------------------------------------

export interface GenerateClarifyingQuestionsResult {
  /**
   * Array of 3–10 ClarifyingQuestion objects.
   *
   * The first three elements are always the mandatory questions:
   *   [0] id: 'scope-deliverables'
   *   [1] id: 'scope-exclusions'
   *   [2] id: 'scope-timeline'
   *
   * Subsequent elements are LLM-generated context questions (0–7).
   */
  questions: ClarifyingQuestion[]
}

// ---------------------------------------------------------------------------
// Pure helper — also exported from the implementation module for testing
// ---------------------------------------------------------------------------

/**
 * buildMandatoryQuestions
 *
 * Returns the three mandatory ClarifyingQuestion objects.
 * The scope-deliverables question wording varies by pricingModel.
 * The exclusions and timeline questions are model-independent.
 *
 * @param pricingModel - The organization's pricing model, or null for T&M fallback.
 * @returns Array of exactly 3 ClarifyingQuestion objects with stable IDs.
 */
export declare function buildMandatoryQuestions(
  pricingModel: ProposalDefaults['pricingModel'] | null
): ClarifyingQuestion[]
