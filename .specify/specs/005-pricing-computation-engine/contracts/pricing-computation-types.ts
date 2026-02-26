/**
 * Contract: 005-pricing-computation-engine
 *
 * This file defines the TypeScript contracts (types and function signature)
 * for the pricing computation engine. It is the authoritative reference for
 * implementers and consumers (F8 pipeline, future integrations).
 *
 * These types will be co-located with the implementation in:
 *   src/lib/services/pricing-computation.ts
 *
 * Input types (RateCard, RateCardRole, RateCardDiscount) are imported from
 *   src/lib/db/schema/tenant-settings.ts — they are NOT redefined here.
 */

// ---------------------------------------------------------------------------
// Input types (reproduced here for contract clarity; source of truth is the DB schema)
// ---------------------------------------------------------------------------

/** A single deliverable line item provided by the proposal preparer (F6/F8). */
export interface ScopeLineItem {
  /** Human-readable deliverable description. */
  description: string
  /**
   * Role name for by_role mode. May be null or any value in blended mode
   * (role is ignored for rate lookup but may appear in table output).
   */
  role: string | null
  /** Quantity of units. Zero is valid (produces $0.00 line, retained for transparency). */
  quantity: number
  /** Unit type for display in the pricing table. */
  unit: 'hour' | 'day' | 'fixed'
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * A scope line item after rate resolution and total computation.
 * Included in PricingEstimate.lineItems.
 */
export interface ComputedLineItem {
  /** From input scope line item. */
  description: string
  /**
   * Null in blended mode.
   * In by_role mode: the matched role name, or the fallback role name if
   * no exact match was found. See isFallbackRole.
   */
  role: string | null
  /** From input scope line item. */
  quantity: number
  /** From input scope line item. */
  unit: 'hour' | 'day' | 'fixed'
  /** Resolved rate: blended rate or matched role rate. */
  unitRate: number
  /** quantity × unitRate, rounded to 2 decimal places. */
  lineTotal: number
  /**
   * True when by_role mode could not find a role matching the input role name
   * and fell back to the first role in the rate card's roles array.
   */
  isFallbackRole: boolean
}

/** A discount rule that was evaluated and applied to this computation. */
export interface AppliedDiscount {
  /** Discount rule name, used as the row label in formattedMarkdown. */
  name: string
  /** Computed deduction amount, rounded to 2 decimal places. Always non-negative. */
  amount: number
}

/**
 * The complete return value of computePricingEstimate.
 *
 * When isPlaceholder is true:
 *   - formattedMarkdown = '[PLACEHOLDER: pricing details required]'
 *   - All numeric fields are 0
 *   - lineItems and discountsApplied are empty arrays
 *
 * When isPlaceholder is false:
 *   - All numeric invariants documented in data-model.md hold exactly
 */
export interface PricingEstimate {
  /** Rate card mode that was used. */
  mode: 'blended' | 'by_role'
  /** Pricing model label used for formatted output. */
  model: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  /** All scope line items with resolved rates and computed totals. */
  lineItems: ComputedLineItem[]
  /** Sum of all lineTotal values, rounded to 2 decimal places. */
  subtotal: number
  /** Margin percentage from rate card (e.g. 0.20 for 20%). */
  marginPct: number
  /** subtotal × marginPct, rounded to 2 decimal places. */
  marginAmount: number
  /** Ordered list of discount rules that were applied (passed customer filter). */
  discountsApplied: AppliedDiscount[]
  /**
   * subtotal + marginAmount − sum(discountsApplied[].amount).
   * Floored at 0; never negative.
   */
  total: number
  /** Currency code from rate card. Defaults to 'USD' when absent. */
  currency: string
  /**
   * Ready-to-inject GitHub-Flavored Markdown table string.
   * Includes: header with pricing model label, line item rows, subtotal row,
   * margin row, one row per applied discount, and total row.
   * All monetary values include the currency code.
   */
  formattedMarkdown: string
  /**
   * True when the function returned a placeholder result due to missing inputs
   * (null/undefined rateCard, or null/undefined/empty scopeLines).
   * The pipeline uses this to log a warning or track incomplete pricing.
   */
  isPlaceholder: boolean
  /**
   * True when the sum of discount amounts exceeded subtotal + marginAmount,
   * causing total to be floored at 0.
   */
  totalFlooredAtZero: boolean
}

// ---------------------------------------------------------------------------
// Function signature
// ---------------------------------------------------------------------------

/**
 * computePricingEstimate — pure deterministic pricing computation.
 *
 * Accepts rate card configuration, scope line items, pricing model, and an
 * optional customer identifier. Returns a complete PricingEstimate with all
 * numeric results and a ready-to-inject markdown table.
 *
 * Guarantees:
 * - Never throws for missing/null inputs (returns placeholder instead)
 * - Stateless: no database access, no LLM calls, no side effects
 * - Pure: identical inputs always produce identical outputs
 * - Synchronous: executes in <50ms for up to 100 line items (NFR-001)
 * - No logging of rate card values (NFR-004)
 *
 * @param rateCard - Rate card from tenant settings. Null/undefined triggers placeholder.
 * @param scopeLines - Scope line items from clarifying question answers.
 *                     Null/undefined/empty triggers placeholder.
 * @param pricingModel - From proposalDefaults.pricingModel.
 * @param customerId - Optional. Used to filter customer-scoped discount rules.
 */
export type ComputePricingEstimate = (
  rateCard: import('../../../src/lib/db/schema/tenant-settings').RateCard | null | undefined,
  scopeLines: ScopeLineItem[] | null | undefined,
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus',
  customerId?: string,
) => PricingEstimate
