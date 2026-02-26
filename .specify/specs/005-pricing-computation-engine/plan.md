# Implementation Plan: 005-pricing-computation-engine

**Feature:** F5 — Pricing Computation Engine
**Branch:** `005-pricing-computation-engine`
**Date:** 2026-02-26
**Status:** Ready for Implementation

---

## Executive Summary

F5 delivers a single pure TypeScript function `computePricingEstimate` at `src/lib/services/pricing-computation.ts`. The function accepts a rate card, scope line items, a pricing model, and an optional customer ID; it returns a complete `PricingEstimate` containing all computed monetary values and a ready-to-inject GFM markdown table.

No database migrations are required. No new runtime dependencies are required. The implementation consists of one source file (~200 lines) and one test file (~400 lines). This is the smallest possible surface area to satisfy the spec, which mandates a stateless, pure, synchronous computation layer.

---

## Architecture Overview

```
F8 Pipeline (Inngest)
        │
        │  rateCard (fetched from tenant_settings)
        │  scopeLines (parsed from clarifying question answers)
        │  pricingModel (from proposalDefaults)
        │  customerId (from RFP customer record)
        ▼
┌─────────────────────────────────────────────────────┐
│  computePricingEstimate(rateCard, scopeLines,        │
│                         pricingModel, customerId?)   │
│                                                     │
│  Phase 1: Guard — null/empty inputs → placeholder   │
│  Phase 2: Rate resolution (blended or by_role)      │
│  Phase 3: Line total computation (integer cents)    │
│  Phase 4: Subtotal aggregation                      │
│  Phase 5: Margin computation                        │
│  Phase 6: Discount filtering + computation          │
│  Phase 7: Total with floor                          │
│  Phase 8: Markdown formatting                       │
│                                                     │
│  Returns: PricingEstimate (always, never throws)    │
└─────────────────────────────────────────────────────┘
        │
        ▼
  PricingEstimate
  ├── lineItems[]         ← injected into proposal narrative context
  ├── subtotal / total    ← injected into proposal pricing section
  ├── formattedMarkdown   ← injected verbatim into proposal document
  └── isPlaceholder       ← checked by pipeline for logging/tracking
```

---

## Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript strict mode | Constitutional requirement (Principle II); consistent with entire codebase |
| Runtime arithmetic | Integer cent arithmetic (no external lib) | Eliminates float drift; no dependency overhead; explicit per spec (see research.md §Decision 1) |
| Rounding mode | Half-up via `Math.round` at output boundary | Commercial standard; only one rounding call needed per cent value (research.md §Decision 2) |
| Markdown format | GitHub-Flavored Markdown table | Matches existing proposal output; renders in all project markdown consumers (research.md §Decision 4) |
| Test framework | Vitest (already configured) | Consistent with all 8 existing service unit tests; no new dependencies |
| Mocking | None required | Pure function; no DB/LLM/external calls to mock |

---

## Technical Decisions

### TD-001: Single-File, No-Class Architecture

**Decision:** One source file, one named export, zero classes.

**Rationale:** The function is pure and stateless. Classes add no value here and would conflict with the constitutional preference for explicit, simple interfaces (Principle III). Helper functions (rate resolution, discount filtering, markdown formatting, integer conversion) are private unexported functions in the same file, co-located with the export they serve.

**File structure:**
```
src/lib/services/pricing-computation.ts
  export function computePricingEstimate(...)
  export interface ScopeLineItem { ... }
  export interface ComputedLineItem { ... }
  export interface AppliedDiscount { ... }
  export interface PricingEstimate { ... }
  // private helpers:
  function toCents(n: number): number
  function fromCents(n: number): number
  function round2(n: number): number
  function resolveRate(rateCard, lineItem): { unitRate, role, isFallbackRole }
  function filterDiscounts(discounts, customerId?): RateCardDiscount[]
  function computeDiscountAmount(discount, subtotalCents, totalCents): number
  function formatMarkdown(estimate, pricingModel, currency): string
```

### TD-002: Placeholder Return Value

**Decision:** Missing inputs return a fully-formed `PricingEstimate` with `isPlaceholder: true` rather than `null`, `undefined`, or a thrown error.

**Rationale:** FR-017 and FR-018 both state "the function does not throw an error." The F8 pipeline always receives a `PricingEstimate`; it checks `isPlaceholder` to decide whether to inject the placeholder string or the real table. A union return type would require type guards at every call site. Single return type is simpler and explicit (Constitution Principle III).

**Placeholder constant:**
```typescript
const PLACEHOLDER_MARKDOWN = '[PLACEHOLDER: pricing details required]'
```

### TD-003: Integer Cent Arithmetic Boundary

**Decision:** Convert all monetary inputs to integer cents at the top of each computation, perform all arithmetic in integers, and convert back at the output boundary.

**Implementation:**
```typescript
function toCents(n: number): number {
  return Math.round(n * 100)
}
function fromCents(n: number): number {
  return Math.round(n) / 100  // Math.round handles any sub-cent remainder
}
```

**Where applied:**
- `unitRate` → cents before multiplying by `quantity`
- `quantity` is NOT converted to cents (it is a count, not a monetary value)
- `lineTotal = fromCents(toCents(unitRate) * quantity)`
- `subtotal = fromCents(sum of toCents(lineTotal) for each line)`
- `marginAmount = fromCents(toCents(subtotal) * marginPct)` — note: `toCents(subtotal)` is already an integer; multiply by `marginPct` (float) then `Math.round` to get an integer cents value
- Discount amounts: same pattern as marginAmount

### TD-004: Role Matching — Case-Insensitive

**Decision:** Role name matching between scope line items and rate card roles uses `.toLowerCase()` comparison.

**Rationale:** FR-003 specifies case-insensitive matching. Using `toLowerCase()` on both sides is the simplest, locale-stable approach. `localeCompare` with `sensitivity: 'base'` is more correct for international text but adds complexity not warranted for English role names (per PRD §3 USD-only scope).

**Fallback:** When no match is found, use `roles[0]`. When `roles` array is empty in by_role mode, return placeholder (spec §Edge Cases: Role Fallback).

### TD-005: Discount Non-Cascading Application

**Decision:** Each discount is computed against a fixed reference base (`subtotal` or `subtotal + marginAmount`), not the running net.

**Rationale:** Documented as resolved decision in spec §Edge Cases. Matches the `appliesTo` field semantics. Implementation: compute `subtotalCents` and `subtotalPlusMarginCents` once before the discount loop; each discount uses these pre-computed values.

### TD-006: Markdown Table Format

**Decision:** GFM table with a text header line, column separator row, and one data row per line item, followed by separator rows for subtotal, margin, discounts, and total.

**Column sets by mode:**
- Blended: `Description | Qty | Unit | Rate | Total`
- By-role: `Description | Role | Qty | Unit | Rate | Total`

**Pricing model header:**
```
**Pricing (Time & Materials)** — USD
**Pricing (Fixed Price)** — USD
**Pricing (Cost-Plus)** — USD
```

**Discount rows:** each applied discount appears as `| *{name}* | | | | | −{currency} {amount} |`

**Total row label by pricing model:**
- T&M: `**Total**`
- Fixed Price: `**Fixed Price Total**`
- Cost-Plus: `**Total**` (margin row is labelled `*Cost-Plus Margin*`)

---

## Implementation Phases

### Phase 1: Types and Internal Helpers (foundation)

**Files:**
- `src/lib/services/pricing-computation.ts` (create)
- `tests/unit/services/pricing-computation.test.ts` (create)

**Work:**
1. Define and export `ScopeLineItem`, `ComputedLineItem`, `AppliedDiscount`, `PricingEstimate` interfaces.
2. Implement and test `toCents` and `fromCents` helpers.
3. Implement the placeholder guard: return `isPlaceholder: true` result when `rateCard` is null/undefined/missing, or when `scopeLines` is null/undefined/empty.
4. **Test first (TDD):** Write degradation tests (US-005 scenarios) before implementing the guard.

**Tests in this phase:**
- Null rate card → placeholder returned, no exception
- Undefined rate card → placeholder returned
- Empty scopeLines array → placeholder returned
- Undefined scopeLines → placeholder returned
- `isPlaceholder` flag is true in all degraded cases
- `toCents(33.33) = 3333`, `fromCents(3333) = 33.33`

### Phase 2: Rate Resolution

**Work:**
1. Implement `resolveRate(rateCard, lineItem)` — returns `{ unitRate, role, isFallbackRole }`.
2. Blended path: return `{ unitRate: rateCard.blendedRate, role: null, isFallbackRole: false }`.
3. By-role path: find role by case-insensitive name match; if not found, use `roles[0]` with `isFallbackRole: true`.
4. Empty `roles` array in by_role mode → treat as missing rate card (return placeholder from main function).

**Tests in this phase:**
- Blended mode: single rate applied across multiple line items with different role names
- By-role mode: each line item matches its role and uses the correct rate
- By-role mode: role not found → fallback to first role, `isFallbackRole: true`
- By-role mode: `roles` array empty → placeholder returned from main function
- Role matching is case-insensitive: `'Senior Developer'` matches `'senior developer'`

### Phase 3: Line Total and Subtotal Computation

**Work:**
1. For each scope line item: call `resolveRate`, compute `lineTotal = fromCents(toCents(unitRate) * quantity)`.
2. Assemble `ComputedLineItem[]`.
3. Compute `subtotal = fromCents(sum of toCents(lineTotal))`.

**Tests in this phase:**
- `$33.33/hr × 3 hours = $99.99` (floating-point sensitive edge case)
- Zero quantity line item → `lineTotal = 0`, item included in output
- Multiple line items → subtotal is correct sum

### Phase 4: Margin Computation

**Work:**
1. `marginAmount = fromCents(Math.round(toCents(subtotal) * marginPct))`.
2. Zero margin (`marginPct = 0`) → `marginAmount = 0`, row still appears in table.

**Tests in this phase:**
- `20% margin on $99.99 = $20.00` (rounds correctly)
- Zero margin → $0.00, included in output

### Phase 5: Discount Filtering and Computation

**Work:**
1. Implement `filterDiscounts(discounts, customerId?)`: returns discounts where `customerIds === null` OR `customerIds.includes(customerId)`.
2. For each filtered discount: compute `amount` from pre-computed `subtotalCents` or `subtotalPlusMarginCents` based on `appliesTo`.
3. Percentage discount: `fromCents(Math.round(baseCents * discount.value))`.
4. Fixed discount: `round2(discount.value)` (applied exactly, no cents conversion needed since it is a currency amount already).
5. Assemble `AppliedDiscount[]`.

**Tests in this phase:**
- Universal percentage discount (customerIds null): applied
- Customer-specific percentage discount: applied when matching, not applied when different customerId
- Universal fixed discount: deducted correctly
- Customer-specific fixed discount: correctly filtered
- Multiple discounts in order: each uses original reference base (non-cascading)
- Discount on `subtotal` vs `total` base: correct base used

### Phase 6: Total with Floor

**Work:**
1. `total = Math.max(0, fromCents(toCents(subtotal) + toCents(marginAmount) - sum(toCents(d.amount))))`
2. Set `totalFlooredAtZero = (raw total < 0)`.

**Tests in this phase:**
- Fixed discount exceeding total → `total = 0`, `totalFlooredAtZero = true`, no negative value

### Phase 7: Markdown Formatting

**Work:**
1. Implement `formatMarkdown(lineItems, subtotal, marginPct, marginAmount, discountsApplied, total, pricingModel, currency, mode)`.
2. Build header line with pricing model label and currency.
3. Build column header row (with or without Role column based on mode).
4. Build one data row per `ComputedLineItem` (format: `description | [role] | qty | unit | currency rate | currency lineTotal`).
5. Add separator, subtotal row, margin row (label varies for cost_plus), discount rows (one per applied discount, named), total row (label varies for fixed_price).
6. Return complete string.

**Tests in this phase:**
- T&M: correct header label, correct column structure
- Fixed price: "Fixed Price Total" as final row label
- Cost-plus: "Cost-Plus Margin" as margin row label
- Currency code appears on all monetary values
- Pricing model label in header
- Blended mode: no Role column
- By-role mode: Role column present; fallback role name shown
- Zero quantity line item: included in table with $0.00 total

### Phase 8: Integration and Final Tests

**Work:**
1. Compose all phases into `computePricingEstimate`.
2. Run full acceptance test suite covering all spec test scenarios.
3. Run `npx vitest run --coverage` to verify ≥95% branch coverage for this file.
4. Verify TypeScript strict mode passes: `npx tsc --noEmit`.

**Tests in this phase (full spec scenario coverage):**
All 20+ scenarios from spec §Test Coverage Requirements.

---

## File Inventory

| File | Action | Notes |
|---|---|---|
| `src/lib/services/pricing-computation.ts` | Create | ~200 lines; pure function + types |
| `tests/unit/services/pricing-computation.test.ts` | Create | ~400 lines; 95%+ branch coverage |

No other files are modified in this feature. The types exported from `pricing-computation.ts` will be imported by F8 when the pipeline is wired up, but that import is authored in F8 — not in this feature.

---

## Security Considerations

### Rate Card Value Logging (NFR-004)

The function must not log any rate card values (rates, margin, discount amounts). This is commercially sensitive data.

**Implementation rule:** No `console.log`, `console.warn`, `console.error`, or any logging calls inside `computePricingEstimate` or its helper functions. The PostToolUse hook in the project will warn about `console.log` statements — this is an additional safeguard.

**Constitutional compliance:** Constitution Principle IV (Secure by Default) — sensitive data never appears in logs.

### Input Validation

The function accepts data already validated by `rateCardSchema` at the API layer (F2). However, the function must not assume valid data — it performs its own defensive checks for:
- `blendedRate` being null in blended mode (treats as missing rate card → placeholder)
- `roles` array being empty in by_role mode (treats as missing rate card → placeholder)
- `currency` being absent (defaults to 'USD')

These defensive checks are belt-and-suspenders for legacy data pre-validation (spec §Edge Cases).

### No SQL / No External Calls

The function is stateless with no DB access and no network calls. There is no injection surface.

---

## Performance Strategy

**NFR-001:** Execute synchronously in <50ms for rate cards with up to 50 roles and 100 scope line items.

**Analysis:** The function is O(R × L) where R = number of roles and L = number of scope line items (role lookup is a linear scan through `roles[]`). At R=50, L=100: 5,000 string comparisons. Each comparison is a `toLowerCase()` + `===`. In V8, this runs in microseconds. Total execution for maximum input is well under 1ms, providing a 50x margin against the 50ms budget.

**No optimization needed.** The function is already fast by construction. A role name lookup using a `Map<string, RateCardRole>` pre-built from the roles array would be O(1) per lookup (O(L) total), but the O(R × L) linear scan is fast enough and simpler. The `Map` optimization is noted here but not implemented — it would be premature given the performance budget.

---

## Testing Strategy

### Test File Location

`tests/unit/services/pricing-computation.test.ts` — consistent with all 8 existing service unit tests.

### Test Pattern

Pure function tests: no mocking required. Each test constructs inputs directly and asserts on the returned `PricingEstimate`. Tests are organized by `describe` block matching the spec user stories and test scenarios.

```typescript
describe('computePricingEstimate', () => {
  describe('degradation (US-005)', () => { ... })
  describe('blended mode (US-001)', () => { ... })
  describe('by-role mode (US-002)', () => { ... })
  describe('pricing models (US-003)', () => { ... })
  describe('discounts (US-004)', () => { ... })
  describe('arithmetic edge cases (US-006)', () => { ... })
  describe('markdown formatting', () => { ... })
})
```

### Coverage Target

NFR-003 requires ≥95% branch coverage for this file. The global Vitest threshold is 80% branches; this feature sets a higher internal bar. The test file will exercise all branches including:
- `mode === 'blended'` vs `mode === 'by_role'`
- Role found vs not found (fallback)
- `roles.length === 0` (invalid by_role)
- `customerId` provided vs absent
- Each `pricingModel` value (3 branches)
- Each discount `type` value (`percentage`, `fixed`)
- Each discount `appliesTo` value (`subtotal`, `total`)
- `customerIds === null` vs array match vs array no-match
- `total < 0` (floor branch)
- `currency` present vs absent (default to USD)
- `blendedRate === null` (rare legacy case)
- `quantity === 0` (zero quantity line)
- `marginPct === 0` (zero margin)

---

## Deployment Strategy

This feature has no deployment-specific concerns:
- No environment variables added
- No database migrations
- No API routes added or modified
- The new service file is imported in F8 (not in this feature); no Vercel build change until F8

The feature branch can be merged and deployed independently without activating any user-facing behavior. `computePricingEstimate` will be a dead export until F8 wires it into the Inngest pipeline.

---

## Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Float arithmetic edge case not caught | Low | High | Integer cent arithmetic eliminates root cause; explicit test for `$33.33 × 3 = $99.99` |
| F8 calls with incompatible `ScopeLineItem` shape | Medium | Medium | TypeScript strict mode catches mismatches at compile time; contract file in `contracts/` serves as the shared interface reference |
| Discount base confusion (subtotal vs total) | Low | Medium | Non-cascading pattern + explicit test for each `appliesTo` value |
| Performance regression for large inputs | Very Low | Low | Pure sync function with no I/O; O(R×L) is microseconds at scale |
| Rate card value logged inadvertently | Low | High (commercial sensitivity) | Code review checklist + PostToolUse `console.log` warning hook |

---

## Constitutional Compliance

| Principle | Status | Notes |
|---|---|---|
| I. Tenant Isolation | N/A | Stateless function; no data access; tenant context enforced by caller |
| II. Type Safety | Compliant | All parameters and return values fully typed; no `any`; strict mode |
| III. Explicit Over Implicit | Compliant | Named export; typed interfaces; placeholder flag instead of null return |
| IV. Secure by Default | Compliant | No logging of rate card values; no external calls; input defensive checks |
| V. 80% Coverage Minimum | Exceeds (95%) | NFR-003 sets internal bar at 95% branch coverage |
| VI. Test the Agents | N/A | No LLM agents in this feature |
| VII. Integration Tests | Future (F8) | Pipeline integration tested when F8 wires the function |
| VIII. Document Fidelity | N/A | No PDF/Word output |
| XIII. Sub-3-Second Parse | Exceeds | <1ms execution |
| XVI. Graceful Degradation | Compliant | Null inputs return placeholder, never throw |

No constitutional exceptions. All principles are either satisfied or not applicable to a pure computation function.

---

## Next Steps

1. Run `/speckit-tasks` to generate the task breakdown from this plan.
2. Implement using TDD workflow:
   - Phase 1 (types + degradation guard) first
   - Write tests before each phase of implementation
   - Run `npx vitest run tests/unit/services/pricing-computation.test.ts` after each phase
3. Verify coverage: `npx vitest run --coverage --reporter=text`
4. TypeScript check: `npx tsc --noEmit`
5. Commit: `feat: add pricing computation engine (F5)`
