# Feature Specification: Pricing Computation Engine

**Feature ID:** F5
**Branch:** `005-pricing-computation-engine`
**PRD Source:** §5 US5, §6.3
**Depends on:** F1 (`001-data-model-foundation`), F2 (`002-rate-card-management`)
**Blocks:** F8 (`008-revised-proposal-pipeline`)
**Priority:** P0 — Critical
**Status:** Draft

---

## Overview

Proposal preparers currently have no pricing section in generated proposals. Even when a supplier has configured their rate card (F2), there is no engine to take those rates, apply them to a scoped set of deliverables, and produce an accurate, formatted pricing table. Without deterministic computation, pricing would have to be hallucinated by the LLM — which violates the core commercial integrity requirement of the bid engine.

This feature delivers the pricing computation engine: a pure deterministic function that accepts a rate card, a list of scoped deliverable line items, and a pricing model, then produces a complete `PricingEstimate` containing all numeric results and a ready-to-inject markdown table. The LLM is never involved in arithmetic. The function supports both billing modes (blended and by-role), all three pricing models (T&M, fixed price, cost-plus), and discount rules applied in order after margin. When required inputs are missing, the function degrades gracefully to a placeholder rather than failing proposal generation.

**What this feature is NOT:** It does not generate the scope line items (that is user input captured in F6). It does not display the pricing section in the proposal UI. It does not save any data to the database. It is exclusively a stateless computation layer.

---

## User Stories

### US-001: Automatic Pricing in Blended Mode

**As a** Proposal Preparer
**I want** the system to calculate total pricing using a single rate applied to all hours I described in the clarifying questions
**So that** the proposal includes an accurate, consistent quote without me performing manual multiplication

**Acceptance Criteria:**
- [ ] When the rate card mode is blended, all scope line items use the single blended rate regardless of any role specified in the line item
- [ ] The pricing table shows each scope line item with: description, quantity, unit (hour/day/fixed), unit rate, and computed line total
- [ ] The subtotal is the sum of all line totals
- [ ] Margin is applied as a percentage of the subtotal; the margin amount is shown separately
- [ ] Applicable discounts are applied after margin and shown as named deduction rows
- [ ] The final total reflects: subtotal + margin − discounts
- [ ] All monetary values display the configured currency symbol/code

**Priority:** High

---

### US-002: Automatic Pricing in By-Role Mode

**As a** Proposal Preparer
**I want** each deliverable in the proposal to be priced using the rate configured for the specific role associated with that deliverable
**So that** proposals accurately reflect actual staffing costs across different labour categories

**Acceptance Criteria:**
- [ ] When the rate card mode is by-role, each scope line item is matched to a role by name
- [ ] If a scope line item's role name matches a configured role exactly, that role's rate is used
- [ ] If a scope line item's role name does not match any configured role, the first role in the rate card is used as a fallback (this fallback is documented in the line item's rendered output)
- [ ] The pricing table shows each scope line item with: description, role name, quantity, unit, unit rate, and line total
- [ ] Subtotal, margin, discounts, and total are computed and displayed identically to blended mode
- [ ] The currency is shown on all monetary values

**Priority:** High

---

### US-003: Pricing Model Reflected in Table Structure

**As a** Proposal Preparer
**I want** the pricing table to reflect the organization's chosen pricing model (T&M, Fixed Price, Cost-Plus)
**So that** the commercial structure of our proposal matches the customer's expected format

**Acceptance Criteria:**
- [ ] When the pricing model is Time & Materials, the table shows quantity × rate per line item
- [ ] When the pricing model is Fixed Price, the table presents the total as a single committed price; line items still display for transparency but are grouped under a "Fixed Price" label
- [ ] When the pricing model is Cost-Plus, the table labels the margin row as "Cost-Plus Margin" and shows both the cost base (subtotal) and the margin as a separate line
- [ ] The `pricingModel` value is visible in the formatted markdown output (e.g. as a table caption or header label)
- [ ] Arithmetic is identical across all three pricing models; only the presentation labels differ

**Priority:** High

---

### US-004: Customer-Scoped and Universal Discounts

**As a** Proposal Preparer
**I want** applicable discounts to be automatically applied in the correct order and shown as named line items in the pricing table
**So that** negotiated discounts are never forgotten and the net total is accurate

**Acceptance Criteria:**
- [ ] Discounts configured as "universal" (no customer restriction) are applied to every pricing computation
- [ ] Discounts configured with specific customer IDs are applied only when the computation is invoked for that customer
- [ ] Percentage discounts are calculated as the configured fraction of the configured base (subtotal or total before discount)
- [ ] Fixed-amount discounts deduct the configured dollar amount from the configured base
- [ ] Discounts are applied in the order they appear in the rate card's discount list
- [ ] Each applied discount is shown as a named row in the formatted table with its deduction amount
- [ ] Discounts that do not apply to the current customer are silently omitted (no row, no error)
- [ ] The final total after all discounts is mathematically correct and shown as the last row of the table

**Priority:** High

---

### US-005: Graceful Degradation When Inputs Are Missing

**As a** Proposal Preparer
**I want** proposal generation to succeed even if I did not answer scope questions or the rate card is not yet configured
**So that** an incomplete setup does not prevent me from getting a draft to work from

**Acceptance Criteria:**
- [ ] When the rate card is null or not configured, the pricing section contains `[PLACEHOLDER: pricing details required]` and the function does not throw an error
- [ ] When scope line items are empty or absent, the pricing section contains `[PLACEHOLDER: pricing details required]` and the function does not throw an error
- [ ] The placeholder markdown is a valid string that can be directly inserted into a proposal document
- [ ] All other proposal sections are unaffected by the pricing placeholder
- [ ] The `PricingEstimate` return value communicates the degraded state (e.g. via an `isPlaceholder` flag or equivalent indicator) so the pipeline can log or track incomplete pricing

**Priority:** High

---

### US-006: Arithmetically Correct Output Across Edge Cases

**As a** Proposal Preparer
**I want** the pricing figures in my proposal to be arithmetically exact, including in edge cases involving decimal rates and large quantities
**So that** I can submit pricing with confidence and avoid disputes over rounding

**Acceptance Criteria:**
- [ ] Line totals are computed as `quantity × unitRate` with no floating-point rounding errors in the final displayed values
- [ ] Margin amount is computed as `subtotal × marginPct` with the result rounded to 2 decimal places for display
- [ ] Percentage discount amounts are computed from the correct base (subtotal or total as configured) and rounded to 2 decimal places
- [ ] Fixed discount amounts are applied exactly as specified, with no rounding
- [ ] The displayed total equals subtotal + marginAmount − sum(discountAmounts), with consistent rounding
- [ ] Known edge cases produce correct results: e.g. $33.33/hr × 3 hours = $99.99; 20% margin on $99.99 = $20.00; total = $119.99

**Priority:** High

---

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-001 | The computation function accepts: a rate card object, an array of scope line items, a pricing model string, and an optional customer identifier |
| FR-002 | In blended mode, every scope line item's unit rate is set to the rate card's `blendedRate`; any role specified on the line item is ignored for rate lookup but may be rendered in the description |
| FR-003 | In by-role mode, each scope line item's unit rate is resolved by matching the line item's role name to the rate card's role list; match is case-insensitive |
| FR-004 | When a role name in a scope line item has no matching entry in the rate card roles list, the first role in the list is used as the fallback rate |
| FR-005 | Each scope line item produces a computed `lineTotal = quantity × unitRate` |
| FR-006 | The `subtotal` is the sum of all `lineTotal` values |
| FR-007 | The `marginAmount` is `subtotal × marginPct`, where `marginPct` comes from the rate card's `defaultMarginPct` |
| FR-008 | Discounts are applied after margin addition; they reduce the total |
| FR-009 | For each discount rule in the rate card's `discounts` array, the discount is applied only if: `customerIds` is null (universal), OR `customerIds` includes the provided `customerId` parameter |
| FR-010 | A percentage discount's computed amount = `discountBase × discountValue`, where `discountBase` is `subtotal` if `appliesTo = 'subtotal'`, or `subtotal + marginAmount` if `appliesTo = 'total'` |
| FR-011 | A fixed discount's computed amount equals its configured `value` regardless of the computation base (the `appliesTo` field still determines which label is used in the table) |
| FR-012 | Discounts are applied in the array order they appear in the rate card; each discount's base is computed before subsequent discounts are applied (i.e. discounts do not compound off each other's reductions) |
| FR-013 | The `total` equals `subtotal + marginAmount − sum(appliedDiscountAmounts)` |
| FR-014 | The `formattedMarkdown` field is a complete, ready-to-inject markdown string containing: a labelled table with all line items, a subtotal row, a margin row, one row per applied discount, and a total row |
| FR-015 | The currency code from the rate card is shown on all monetary values in the formatted markdown |
| FR-016 | The pricing model label is included in the formatted markdown header |
| FR-017 | When the rate card is null or undefined, the function returns a degraded result with `formattedMarkdown` set to `[PLACEHOLDER: pricing details required]` without throwing |
| FR-018 | When the scope line items array is null, undefined, or empty, the function returns a degraded result with `formattedMarkdown` set to `[PLACEHOLDER: pricing details required]` without throwing |
| FR-019 | The function is stateless and has no database access; all inputs are passed as parameters |
| FR-020 | All numeric output values (lineTotal, subtotal, marginAmount, discount amounts, total) are JavaScript `number` type rounded to 2 decimal places for monetary precision |
| FR-021 | The function is pure: identical inputs always produce identical outputs; no randomness, no side effects |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-001 | The computation function executes synchronously in under 50ms for rate cards with up to 50 roles and scope inputs with up to 100 line items |
| NFR-002 | The function is fully typed; all input parameters and return values have explicit TypeScript types with no `any` |
| NFR-003 | Unit test coverage for the pricing function must be ≥ 95% branch coverage (all mode/model/discount/degradation paths exercised) |
| NFR-004 | The function must not log any rate card values (rates, margin, discount amounts) to server-side output at log levels visible outside the process; this data is commercially sensitive |
| NFR-005 | The function produces identical markdown output for identical inputs; no locale-dependent formatting (e.g. comma vs period as decimal separator) |

---

## Edge Cases & Error Handling

### Rounding Arithmetic
- All intermediate computations that produce monetary values are rounded to 2 decimal places before being stored in the output object. This prevents floating-point drift across display values.
- The final `total` is computed from the rounded intermediate values (not re-derived from raw floats) so that: `total = subtotal + marginAmount − discountAmounts` holds exactly when rendered.
- **Documented resolution:** Integer cent arithmetic is used internally (multiply all currency values by 100, compute in integers, divide by 100 for output). This is a best-practice default chosen to eliminate floating-point drift without requiring an external library.

### Role Fallback in By-Role Mode
- When a scope line item specifies a role that does not match any rate card entry, the first role in the `roles` array is used.
- The fallback is applied silently; the formatted table shows the fallback role name in the role column.
- If the `roles` array itself is empty in by-role mode (an invalid but possible state from the data layer), the function treats this as a missing rate card and returns the placeholder.

### Discount Base and Order
- Percentage discounts on `appliesTo: 'total'` are calculated against `subtotal + marginAmount`, not the running net-after-previous-discounts. Discounts do not cascade into each other's bases. This matches the common accounting pattern where discounts are computed from a fixed reference.
- **Documented resolution:** Non-cascading discount application was chosen as the unambiguous default. Cascading would require explicit specification in rate card configuration which is not currently modelled.

### Fixed Discounts Exceeding Total
- If the sum of fixed discount amounts exceeds `subtotal + marginAmount`, the `total` floor is 0. A negative total is never returned.
- **Documented resolution:** Floor at zero protects proposal output from nonsensical negative pricing. A warning indicator is included in the return value when this floor is applied.

### Blended Mode with Zero BlendedRate
- If `blendedRate` is 0 (which should be rejected by rate card validation in F2 but could arrive as legacy data), the function computes normally (all line totals are 0). It does not treat zero as missing data.

### Scope Line Item with Zero Quantity
- A line item with quantity 0 produces a lineTotal of 0. It is included in the table with a note indicating the quantity. This preserves transparency about what was considered.

### No Margin Configured
- If `defaultMarginPct` is 0, the margin row shows $0.00 and is still included in the table for structural consistency.

### Currency Missing
- If the rate card's currency field is absent, the function defaults to displaying "USD" in formatted output.

---

## Test Coverage Requirements

The following test scenarios are explicitly required (not optional) to meet NFR-003 and the Phase 2 gate:

### Mode Tests
- [ ] Blended mode: single rate applied across multiple line items with different role names
- [ ] By-role mode: each line item matches its role and uses the correct rate
- [ ] By-role mode: role not found → fallback to first role, correct rate used
- [ ] By-role mode: roles array is empty → placeholder returned

### Pricing Model Tests
- [ ] T&M pricing model: table structure and labels correct
- [ ] Fixed price model: table labelled as fixed price, totals identical
- [ ] Cost-plus model: margin row labelled as cost-plus margin, correct amount

### Discount Tests
- [ ] Universal percentage discount (customerIds null): applied to every computation
- [ ] Customer-specific percentage discount: applied when matching customerId, not applied when different customerId
- [ ] Universal fixed discount: deducted correctly
- [ ] Customer-specific fixed discount: correctly filtered by customerId
- [ ] Multiple discounts in order: each discount base is computed from original reference, not cascaded
- [ ] Discount on subtotal vs discount on total: correct base used in each case

### Degradation Tests
- [ ] Null rate card → placeholder string returned, no exception thrown
- [ ] Empty scope lines array → placeholder string returned, no exception thrown
- [ ] Undefined scope lines → placeholder string returned, no exception thrown

### Math Edge Case Tests
- [ ] $33.33/hr × 3 hours = $99.99 (floating-point sensitive)
- [ ] 20% margin on $99.99 = $20.00 (rounding to nearest cent)
- [ ] Fixed discount exceeding total → total floored at 0, no negative value
- [ ] Zero quantity line item → lineTotal is 0, included in table
- [ ] Zero margin percentage → margin row shows $0.00

---

## Out of Scope

- Database reads or writes (the function is stateless; data is fetched by the pipeline before calling this function)
- LLM involvement in any arithmetic or formatting step
- Multi-currency conversion (USD-only in v1 per PRD §3)
- Per-RFP rate card overrides (the global rate card is used)
- Approval workflow before pricing is committed to the proposal
- Tax calculation
- Pricing model negotiation or dynamic adjustment
- Parsing scope line items from raw text (that is done by a scope line parser in F8)

---

## Success Metrics

- Unit test suite passes with 0 failures for all documented test scenarios
- Zero arithmetic errors when `computePricingEstimate` is invoked in pipeline integration tests (F8)
- Proposal generated against a configured rate card contains a pricing table with correct totals
- Graceful degradation confirmed: proposal generation completes without error when rate card is null
- No floating-point visible errors in any rendered monetary value (verified by edge case tests)

---

## Acceptance Criteria Summary

| Story | Done When |
|---|---|
| US-001 | Blended mode produces correct line totals, subtotal, margin, and total; currency shown |
| US-002 | By-role mode matches roles, falls back to first role when unmatched; same totalling behaviour |
| US-003 | All three pricing model labels render correctly in formattedMarkdown; arithmetic is identical |
| US-004 | Universal discounts applied always; customer discounts applied only for matching customerId; order respected |
| US-005 | Null rate card or empty scope → placeholder returned, no exception; all other sections unaffected |
| US-006 | $33.33 × 3 = $99.99 and all other edge case arithmetic tests pass with correct rounded values |
