# Tasks: 005-pricing-computation-engine

**Feature:** F5 — Pricing Computation Engine
**Branch:** `005-pricing-computation-engine`
**Date:** 2026-02-26
**Plan Source:** `.specify/specs/005-pricing-computation-engine/plan.md`
**Status:** Ready for Execution

---

## Summary

- **Total Tasks:** 22
- **Phases:** 8 implementation phases + 2 quality gates
- **Source Files:** 2 (one implementation file, one test file)
- **Estimated Effort:** ~8 hours total
- **Parallelization:** Test tasks within a phase cannot run in parallel with their implementation counterpart, but test writing for upcoming phases can begin while current-phase implementation is in review.

### Task Organization

| Phase | Tasks | Effort |
|---|---|---|
| Phase 1: Types + Placeholder Guard | 2 (test + impl) | 1.5h |
| Phase 2: Rate Resolution | 2 (test + impl) | 1.0h |
| Phase 3: Line Totals + Subtotal | 2 (test + impl) | 0.75h |
| Phase 4: Margin Computation | 2 (test + impl) | 0.5h |
| Phase 5: Discount Filtering + Computation | 2 (test + impl) | 1.0h |
| Phase 6: Total with Floor | 2 (test + impl) | 0.5h |
| Phase 7: Markdown Formatting | 2 (test + impl) | 1.25h |
| Phase 8: Integration + Coverage Gate | 2 (test + impl) | 0.75h |
| Quality Gates | 2 | 0.5h |
| **Total** | **22** | **~8h** |

### Critical Path

Task 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1 → 4.2 → 5.1 → 5.2 → 6.1 → 6.2 → 7.1 → 7.2 → 8.1 → 8.2 → QG.1 → QG.2

All phases are strictly sequential because each implementation phase builds on the previous one. Within a phase, tests must complete (RED) before implementation begins (GREEN).

---

## TDD Enforcement

**RULE:** Every implementation task is blocked by its corresponding test task. Tests must be written and confirmed to FAIL before implementation begins. This ordering is enforced by the dependency chain below.

```
Task 1.1 (write tests RED) → Task 1.2 (implement GREEN)
Task 2.1 (write tests RED) → Task 2.2 (implement GREEN)
... (pattern repeats for all phases)
```

---

## Phase 1: Types, Internal Helpers, and Placeholder Guard

**User Stories:** US-005 (Graceful Degradation)
**Files:** `src/lib/services/pricing-computation.ts`, `tests/unit/services/pricing-computation.test.ts`

---

### Task 1.1: Types + Placeholder Guard — Tests
**Status:** 🟡 Ready
**Effort:** 0.75h
**Dependencies:** None (first task)
**Parallel with:** None

**Description:**
Create `tests/unit/services/pricing-computation.test.ts`. Write the degradation test suite and helper function tests. All tests must be confirmed to FAIL (RED) before implementation starts. Do not create the source file yet.

**Test describe blocks to create:**
```typescript
describe('computePricingEstimate', () => {
  describe('internal helpers', () => {
    // toCents and fromCents are private — test indirectly via output values
    // OR export them temporarily; remove export after coverage confirmed
  })
  describe('degradation (US-005)', () => { ... })
})
```

**Tests to write (must all FAIL):**
- Null `rateCard` → returns `PricingEstimate` with `isPlaceholder: true`, does not throw
- Undefined `rateCard` → returns `PricingEstimate` with `isPlaceholder: true`, does not throw
- `rateCard` with `mode === 'blended'` and `blendedRate === null` → returns placeholder
- `rateCard` with `mode === 'by_role'` and `roles` is empty array → returns placeholder
- Null `scopeLines` → returns `PricingEstimate` with `isPlaceholder: true`, does not throw
- Undefined `scopeLines` → returns `PricingEstimate` with `isPlaceholder: true`, does not throw
- Empty `scopeLines` array (`[]`) → returns `PricingEstimate` with `isPlaceholder: true`, does not throw
- All placeholder results have `formattedMarkdown === '[PLACEHOLDER: pricing details required]'`
- All placeholder results have all numeric fields equal to `0`
- All placeholder results have `lineItems` as empty array `[]`
- All placeholder results have `discountsApplied` as empty array `[]`
- All placeholder results have `totalFlooredAtZero === false`

**Acceptance Criteria:**
- [ ] Test file created at `tests/unit/services/pricing-computation.test.ts`
- [ ] All 12 degradation/placeholder tests written
- [ ] `npx vitest run tests/unit/services/pricing-computation.test.ts` confirms tests FAIL (source file does not exist yet)

---

### Task 1.2: Types + Placeholder Guard — Implementation
**Status:** 🔴 Blocked by Task 1.1
**Effort:** 0.75h
**Dependencies:** Task 1.1

**Description:**
Create `src/lib/services/pricing-computation.ts`. Define and export all interfaces from the contract file. Implement the placeholder guard logic and internal helpers. Do not implement rate resolution, line totals, margin, discounts, total, or formatting yet — only what is needed to make Task 1.1 tests pass.

**Interfaces to export (from contracts/pricing-computation-types.ts):**
- `ScopeLineItem`
- `ComputedLineItem`
- `AppliedDiscount`
- `PricingEstimate`

**Constant to define (unexported):**
```typescript
const PLACEHOLDER_MARKDOWN = '[PLACEHOLDER: pricing details required]'
```

**Private helper stubs to implement:**
```typescript
function toCents(n: number): number
function fromCents(n: number): number
function round2(n: number): number
```

**Guard logic to implement in `computePricingEstimate`:**
- Return placeholder when `rateCard` is null or undefined
- Return placeholder when `rateCard.mode === 'blended'` and `blendedRate` is null
- Return placeholder when `rateCard.mode === 'by_role'` and `roles.length === 0`
- Return placeholder when `scopeLines` is null or undefined
- Return placeholder when `scopeLines.length === 0`

**Placeholder return shape:**
```typescript
{
  mode: rateCard?.mode ?? 'blended',
  model: pricingModel,
  lineItems: [],
  subtotal: 0,
  marginPct: 0,
  marginAmount: 0,
  discountsApplied: [],
  total: 0,
  currency: rateCard?.currency ?? 'USD',
  formattedMarkdown: PLACEHOLDER_MARKDOWN,
  isPlaceholder: true,
  totalFlooredAtZero: false,
}
```

**Acceptance Criteria:**
- [ ] Source file created at `src/lib/services/pricing-computation.ts`
- [ ] All interfaces exported (matching contract exactly)
- [ ] `computePricingEstimate` exported as named function
- [ ] `npx vitest run tests/unit/services/pricing-computation.test.ts` — all Task 1.1 tests PASS (GREEN)
- [ ] `npx tsc --noEmit` passes with no type errors

---

## Phase 2: Rate Resolution

**User Stories:** US-001 (Blended Mode), US-002 (By-Role Mode)
**FR:** FR-002, FR-003, FR-004

---

### Task 2.1: Rate Resolution — Tests
**Status:** 🔴 Blocked by Task 1.2
**Effort:** 0.5h
**Dependencies:** Task 1.2

**Description:**
Add rate resolution tests to the test file inside `describe('blended mode (US-001)')` and `describe('by-role mode (US-002)')`. Tests must FAIL before implementation.

**Tests to write (must FAIL):**
- Blended mode: single blended rate applied to line item with matching role name (role name ignored for rate)
- Blended mode: blended rate applied uniformly across multiple line items with different role names
- Blended mode: `ComputedLineItem.role` is `null` in blended mode
- Blended mode: `ComputedLineItem.isFallbackRole` is `false` in blended mode
- By-role mode: line item role name exactly matches rate card role → correct role rate used
- By-role mode: multiple line items each matched to their respective roles with correct rates
- By-role mode: role matching is case-insensitive (`'Senior Developer'` matches `'senior developer'`)
- By-role mode: role name not found in rate card → first role used as fallback, `isFallbackRole: true`
- By-role mode: fallback role's rate is used for the unmatched line item
- By-role mode: `ComputedLineItem.role` shows the fallback role's name (not the input role name)

**Acceptance Criteria:**
- [ ] 10 rate resolution tests added to test file
- [ ] All new tests FAIL (implementation not yet done for rate resolution)

---

### Task 2.2: Rate Resolution — Implementation
**Status:** 🔴 Blocked by Task 2.1
**Effort:** 0.5h
**Dependencies:** Task 2.1

**Description:**
Implement the private `resolveRate` helper and wire it into `computePricingEstimate` (stub the remaining computation steps — line totals, subtotal, margin, discounts, total, and markdown can return zeros/empty for now).

**Private function to implement:**
```typescript
function resolveRate(
  rateCard: RateCard,
  lineItem: ScopeLineItem,
): { unitRate: number; role: string | null; isFallbackRole: boolean }
```

**Logic:**
- Blended path: `{ unitRate: rateCard.blendedRate!, role: null, isFallbackRole: false }`
- By-role path: find first role where `role.name.toLowerCase() === lineItem.role?.toLowerCase()`
  - If found: `{ unitRate: matchedRole.rate, role: matchedRole.name, isFallbackRole: false }`
  - If not found: `{ unitRate: roles[0].rate, role: roles[0].name, isFallbackRole: true }`

**Acceptance Criteria:**
- [ ] `resolveRate` implemented as unexported private function
- [ ] Rate resolution wired into `computePricingEstimate` (produces `ComputedLineItem[]` with correct `unitRate`, `role`, `isFallbackRole`)
- [ ] All Task 2.1 tests PASS
- [ ] All Task 1.1 tests still PASS
- [ ] `npx tsc --noEmit` passes

---

## Phase 3: Line Total and Subtotal Computation

**User Stories:** US-001, US-002, US-006 (Arithmetic Correctness)
**FR:** FR-005, FR-006, FR-020

---

### Task 3.1: Line Totals + Subtotal — Tests
**Status:** 🔴 Blocked by Task 2.2
**Effort:** 0.25h
**Dependencies:** Task 2.2

**Description:**
Add line total and subtotal arithmetic tests inside `describe('arithmetic edge cases (US-006)')`.

**Tests to write (must FAIL):**
- `$33.33/hr × 3 hours = $99.99` — floating-point sensitive; verify no drift
- Multiple line items: subtotal is the correct sum of all line totals
- Zero quantity line item: `lineTotal === 0`, item is present in `lineItems` array
- Zero quantity line item: `quantity === 0` is preserved in the output `ComputedLineItem`
- All `lineTotal` values are rounded to exactly 2 decimal places

**Acceptance Criteria:**
- [ ] 5 arithmetic tests added
- [ ] All new tests FAIL (line total logic not yet implemented correctly for these cases)

---

### Task 3.2: Line Totals + Subtotal — Implementation
**Status:** 🔴 Blocked by Task 3.1
**Effort:** 0.5h
**Dependencies:** Task 3.1

**Description:**
Implement integer-cent line total and subtotal computation in `computePricingEstimate`.

**Computation to implement:**
```typescript
// For each scope line item after resolveRate:
const unitRateCents = toCents(resolved.unitRate)
const lineTotalCents = unitRateCents * lineItem.quantity   // quantity is NOT converted to cents
const lineTotal = fromCents(lineTotalCents)

// Subtotal:
const subtotalCents = computedLineItems.reduce((sum, li) => sum + toCents(li.lineTotal), 0)
const subtotal = fromCents(subtotalCents)
```

**Acceptance Criteria:**
- [ ] `lineTotal` computation uses integer cent arithmetic as specified
- [ ] `subtotal` computed as `fromCents(sum of toCents(lineTotal))`
- [ ] `PricingEstimate.lineItems` contains all input line items (including zero-quantity ones)
- [ ] `PricingEstimate.subtotal` is correct
- [ ] All Task 3.1 tests PASS
- [ ] All previous tests still PASS
- [ ] `npx tsc --noEmit` passes

---

## Phase 4: Margin Computation

**User Stories:** US-001, US-002, US-003 (Pricing Model), US-006
**FR:** FR-007

---

### Task 4.1: Margin Computation — Tests
**Status:** 🔴 Blocked by Task 3.2
**Effort:** 0.25h
**Dependencies:** Task 3.2

**Description:**
Add margin tests inside `describe('arithmetic edge cases (US-006)')`.

**Tests to write (must FAIL):**
- `20% margin on $99.99 = $20.00` (rounds half-up to nearest cent)
- Zero margin (`defaultMarginPct === 0`): `marginAmount === 0`, `marginPct === 0` in output
- Non-zero margin: `PricingEstimate.marginPct` reflects the rate card value (e.g. `0.20`)
- `marginAmount` is rounded to exactly 2 decimal places

**Acceptance Criteria:**
- [ ] 4 margin tests added
- [ ] All new tests FAIL

---

### Task 4.2: Margin Computation — Implementation
**Status:** 🔴 Blocked by Task 4.1
**Effort:** 0.25h
**Dependencies:** Task 4.1

**Description:**
Implement margin computation in `computePricingEstimate`.

**Computation to implement:**
```typescript
const marginPct = rateCard.defaultMarginPct
const marginAmountCents = Math.round(subtotalCents * marginPct)
const marginAmount = fromCents(marginAmountCents)
```

**Acceptance Criteria:**
- [ ] `marginAmount` computed using integer-cent rounding
- [ ] `PricingEstimate.marginPct` set from rate card
- [ ] `PricingEstimate.marginAmount` set correctly
- [ ] All Task 4.1 tests PASS
- [ ] All previous tests still PASS
- [ ] `npx tsc --noEmit` passes

---

## Phase 5: Discount Filtering and Computation

**User Stories:** US-004 (Customer-Scoped and Universal Discounts)
**FR:** FR-008, FR-009, FR-010, FR-011, FR-012

---

### Task 5.1: Discount Filtering + Computation — Tests
**Status:** 🔴 Blocked by Task 4.2
**Effort:** 0.5h
**Dependencies:** Task 4.2

**Description:**
Add all discount tests inside `describe('discounts (US-004)')`.

**Tests to write (must FAIL):**
- Universal percentage discount (`customerIds: null`): applied to every computation regardless of `customerId`
- Universal percentage discount with no `customerId` argument: applied
- Customer-specific percentage discount: applied when `customerId` matches an entry in `customerIds`
- Customer-specific percentage discount: NOT applied when `customerId` does not match
- Customer-specific percentage discount: NOT applied when `customerId` is `undefined`
- Universal fixed-amount discount: deducted correctly from total
- Customer-specific fixed-amount discount: correctly filtered by matching `customerId`
- Percentage discount with `appliesTo: 'subtotal'`: computed as `subtotal × value`
- Percentage discount with `appliesTo: 'total'`: computed as `(subtotal + marginAmount) × value`
- Multiple discounts in order: each uses the original reference base (non-cascading — discount 2's base is not reduced by discount 1)
- Applied discount appears in `PricingEstimate.discountsApplied` with correct `name` and `amount`
- Discount not applicable to the current customer is absent from `discountsApplied`
- `discountsApplied` preserves the order from the rate card's `discounts` array
- All `AppliedDiscount.amount` values are rounded to 2 decimal places

**Acceptance Criteria:**
- [ ] 14 discount tests added
- [ ] All new tests FAIL

---

### Task 5.2: Discount Filtering + Computation — Implementation
**Status:** 🔴 Blocked by Task 5.1
**Effort:** 0.5h
**Dependencies:** Task 5.1

**Description:**
Implement `filterDiscounts` and the discount computation loop in `computePricingEstimate`.

**Private function to implement:**
```typescript
function filterDiscounts(
  discounts: RateCardDiscount[],
  customerId?: string,
): RateCardDiscount[]
// Returns discounts where customerIds === null OR customerIds.includes(customerId)
```

**Discount amount computation (non-cascading):**
```typescript
// Compute reference bases ONCE before the loop
const subtotalCents = toCents(subtotal)
const subtotalPlusMarginCents = toCents(subtotal) + toCents(marginAmount)

for (const discount of filteredDiscounts) {
  const baseCents = discount.appliesTo === 'subtotal'
    ? subtotalCents
    : subtotalPlusMarginCents

  const amount = discount.type === 'percentage'
    ? fromCents(Math.round(baseCents * discount.value))
    : round2(discount.value)   // fixed: applied exactly

  discountsApplied.push({ name: discount.name, amount })
}
```

**Acceptance Criteria:**
- [ ] `filterDiscounts` implemented as unexported private function
- [ ] Discount computation uses pre-computed (non-cascading) reference bases
- [ ] `PricingEstimate.discountsApplied` populated correctly
- [ ] All Task 5.1 tests PASS
- [ ] All previous tests still PASS
- [ ] `npx tsc --noEmit` passes

---

## Phase 6: Total with Zero Floor

**User Stories:** US-006 (Arithmetic Correctness — edge case)
**FR:** FR-013
**Spec:** Edge Cases §Fixed Discounts Exceeding Total

---

### Task 6.1: Total with Floor — Tests
**Status:** 🔴 Blocked by Task 5.2
**Effort:** 0.25h
**Dependencies:** Task 5.2

**Description:**
Add total computation and floor tests inside `describe('arithmetic edge cases (US-006)')`.

**Tests to write (must FAIL):**
- Normal case: `total = subtotal + marginAmount − sum(discountAmounts)` holds exactly
- Fixed discount(s) exceeding `subtotal + marginAmount`: `total === 0` (not negative)
- When total is floored: `totalFlooredAtZero === true`
- When total is not floored: `totalFlooredAtZero === false`
- Known value chain: `$99.99 subtotal + $20.00 margin − $0.00 discounts = $119.99 total`

**Acceptance Criteria:**
- [ ] 5 total/floor tests added
- [ ] All new tests FAIL

---

### Task 6.2: Total with Floor — Implementation
**Status:** 🔴 Blocked by Task 6.1
**Effort:** 0.25h
**Dependencies:** Task 6.1

**Description:**
Implement total computation with zero floor in `computePricingEstimate`.

**Computation to implement:**
```typescript
const discountSumCents = discountsApplied.reduce((sum, d) => sum + toCents(d.amount), 0)
const rawTotalCents = toCents(subtotal) + toCents(marginAmount) - discountSumCents
const totalFlooredAtZero = rawTotalCents < 0
const total = fromCents(Math.max(0, rawTotalCents))
```

**Acceptance Criteria:**
- [ ] `total` computed using integer cent arithmetic
- [ ] `total` floored at 0 (never negative)
- [ ] `totalFlooredAtZero` flag set correctly
- [ ] `PricingEstimate.total` and `totalFlooredAtZero` populated
- [ ] All Task 6.1 tests PASS
- [ ] All previous tests still PASS
- [ ] `npx tsc --noEmit` passes

---

## Phase 7: Markdown Formatting

**User Stories:** US-001, US-002, US-003 (Pricing Model table structure), US-004 (discount rows)
**FR:** FR-014, FR-015, FR-016
**Tech Decision:** TD-006

---

### Task 7.1: Markdown Formatting — Tests
**Status:** 🔴 Blocked by Task 6.2
**Effort:** 0.5h
**Dependencies:** Task 6.2

**Description:**
Add markdown formatting tests inside `describe('markdown formatting')` and within each user story describe block where appropriate.

**Tests to write (must FAIL):**

**Header and structure:**
- `formattedMarkdown` contains `**Pricing (Time & Materials)**` when `pricingModel === 'time_and_materials'`
- `formattedMarkdown` contains `**Pricing (Fixed Price)**` when `pricingModel === 'fixed_price'`
- `formattedMarkdown` contains `**Pricing (Cost-Plus)**` when `pricingModel === 'cost_plus'`
- `formattedMarkdown` contains the currency code (e.g. `USD`) on all monetary values
- When `currency` is absent from rate card: `formattedMarkdown` uses `USD` as default

**Blended mode columns:**
- Blended mode: markdown table has columns `Description | Qty | Unit | Rate | Total` (no Role column)
- Blended mode: each line item row contains description, quantity, unit, rate, and line total

**By-role mode columns:**
- By-role mode: markdown table has columns `Description | Role | Qty | Unit | Rate | Total`
- By-role mode: each line item row contains description, role name, quantity, unit, rate, and line total
- By-role mode fallback: fallback role name (not input role name) appears in Role column

**Summary rows:**
- `formattedMarkdown` contains a subtotal row with the correct subtotal value
- `formattedMarkdown` contains a margin row; label is `Cost-Plus Margin` when `pricingModel === 'cost_plus'`, otherwise a generic margin label
- `formattedMarkdown` contains one row per applied discount with the discount name and deduction amount
- `formattedMarkdown` final total row label is `Fixed Price Total` when `pricingModel === 'fixed_price'`, `Total` otherwise

**Edge cases in markdown:**
- Zero quantity line item: appears in table with `0` quantity and `$0.00` total
- Zero margin: margin row shows `$0.00` and is still present
- No applicable discounts: no discount rows appear in `formattedMarkdown`

**Acceptance Criteria:**
- [ ] 18 markdown formatting tests added
- [ ] All new tests FAIL

---

### Task 7.2: Markdown Formatting — Implementation
**Status:** 🔴 Blocked by Task 7.1
**Effort:** 0.75h
**Dependencies:** Task 7.1

**Description:**
Implement the private `formatMarkdown` helper and wire it as the final step in `computePricingEstimate`.

**Private function signature:**
```typescript
function formatMarkdown(
  lineItems: ComputedLineItem[],
  subtotal: number,
  marginPct: number,
  marginAmount: number,
  discountsApplied: AppliedDiscount[],
  total: number,
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus',
  currency: string,
  mode: 'blended' | 'by_role',
): string
```

**Table structure (blended mode):**
```
**Pricing (Time & Materials)** — USD

| Description | Qty | Unit | Rate | Total |
|---|---|---|---|---|
| {description} | {qty} | {unit} | {currency} {rate} | {currency} {lineTotal} |
| | | | **Subtotal** | {currency} {subtotal} |
| | | | *Margin (20%)* | {currency} {marginAmount} |
| *{discountName}* | | | | −{currency} {discountAmount} |
| | | | **Total** | {currency} {total} |
```

**Table structure (by-role mode):** insert `Role` column after `Description`.

**Pricing model label variations:**
- `time_and_materials` → header: `**Pricing (Time & Materials)**`; total row: `**Total**`
- `fixed_price` → header: `**Pricing (Fixed Price)**`; total row: `**Fixed Price Total**`
- `cost_plus` → header: `**Pricing (Cost-Plus)**`; margin row: `*Cost-Plus Margin*`; total row: `**Total**`

**Acceptance Criteria:**
- [ ] `formatMarkdown` implemented as unexported private function
- [ ] Wired into `computePricingEstimate` as the last step before return
- [ ] `PricingEstimate.formattedMarkdown` populated with valid GFM table string
- [ ] All Task 7.1 tests PASS
- [ ] All previous tests still PASS
- [ ] `npx tsc --noEmit` passes

---

## Phase 8: Integration and Full Coverage Gate

**User Stories:** All (US-001 through US-006)
**NFR:** NFR-003 (≥95% branch coverage), NFR-002 (no `any`), NFR-004 (no rate card logging)

---

### Task 8.1: Full Spec Coverage — Integration Tests
**Status:** 🔴 Blocked by Task 7.2
**Effort:** 0.5h
**Dependencies:** Task 7.2

**Description:**
Write end-to-end integration tests that compose all phases together against realistic inputs. These tests verify the complete `computePricingEstimate` function from input to output without stubbing any internal phase. Cross-check against all spec §Test Coverage Requirements scenarios not already covered by phase-specific tests.

**Tests to write (covering any remaining spec scenarios):**

**Full US-001 integration (blended):**
- Blended mode with 3 line items, 20% margin, one universal discount: verify all output fields including `formattedMarkdown` structure

**Full US-002 integration (by-role):**
- By-role mode with 3 roles, one unmatched (fallback), 15% margin, no discounts: verify all output fields

**Full US-003 integration (pricing models):**
- Same inputs, three separate calls with `time_and_materials`, `fixed_price`, `cost_plus`: arithmetic identical, only labels differ

**Full US-004 integration (discounts):**
- Rate card with 3 discounts: one universal percentage on subtotal, one customer-specific percentage on total, one universal fixed; invoke with matching `customerId` — verify 3 discounts applied; invoke with non-matching `customerId` — verify 2 discounts applied

**Full US-006 integration (arithmetic):**
- `$33.33/hr × 3 hours = $99.99 subtotal + $20.00 margin (20%) = $119.99 total` — verify complete chain
- Fixed discount of $200.00 on a $119.99 total → `total === 0`, `totalFlooredAtZero === true`

**Acceptance Criteria:**
- [ ] Integration tests added to test file in a `describe('integration scenarios')` block
- [ ] All integration tests PASS (source implementation already complete from prior phases)
- [ ] No new test failures introduced

---

### Task 8.2: Coverage Verification and TypeScript Gate
**Status:** 🔴 Blocked by Task 8.1
**Effort:** 0.25h
**Dependencies:** Task 8.1

**Description:**
Run coverage and type checks. Verify all gates pass before triggering quality review.

**Commands to run:**
```bash
npx vitest run tests/unit/services/pricing-computation.test.ts --coverage --reporter=text
npx tsc --noEmit
```

**Branches to verify are covered (from plan.md §Coverage Target):**
- [ ] `mode === 'blended'` branch
- [ ] `mode === 'by_role'` branch
- [ ] Role found vs not found (fallback) in by_role
- [ ] `roles.length === 0` (empty by_role → placeholder)
- [ ] `customerId` provided vs absent (discount filtering)
- [ ] Each `pricingModel` value (`time_and_materials`, `fixed_price`, `cost_plus`)
- [ ] Each discount `type` (`percentage`, `fixed`)
- [ ] Each discount `appliesTo` (`subtotal`, `total`)
- [ ] `customerIds === null` vs array match vs array no-match
- [ ] `rawTotalCents < 0` (floor branch) vs `rawTotalCents >= 0`
- [ ] `currency` present vs absent (default to USD)
- [ ] `blendedRate === null` (rare legacy case → placeholder)
- [ ] `quantity === 0` (zero quantity line)
- [ ] `marginPct === 0` (zero margin)

**Acceptance Criteria:**
- [ ] Branch coverage ≥ 95% for `src/lib/services/pricing-computation.ts`
- [ ] Zero TypeScript type errors (`npx tsc --noEmit` exits 0)
- [ ] Zero failing tests across the full test suite (`npx vitest run`)

---

## Quality Gate 1: Security Review

### Task QG.1: Security Review
**Status:** 🔴 Blocked by Task 8.2
**Effort:** 0.25h
**Dependencies:** Task 8.2

**Description:**
Run security review checklist against `src/lib/services/pricing-computation.ts`. This is a pure function with no I/O, but NFR-004 (no rate card value logging) must be formally verified.

**Checklist:**
- [ ] No `console.log`, `console.warn`, `console.error`, or any logging inside the file
- [ ] No hardcoded secrets or rate values
- [ ] No external calls (network, filesystem, database)
- [ ] No `any` types in the implementation (NFR-002)
- [ ] Input types accept null/undefined gracefully without uncaught exceptions
- [ ] No mutation of input objects (function is pure — inputs must not be modified)

**Acceptance Criteria:**
- [ ] All security checklist items pass
- [ ] If any item fails: open a blocking issue and resolve before QG.2

---

## Quality Gate 2: Code Review

### Task QG.2: Code Review
**Status:** 🔴 Blocked by Task QG.1
**Effort:** 0.25h
**Dependencies:** Task QG.1

**Description:**
Perform final code review of both files before committing the feature.

**Review checklist:**

**`src/lib/services/pricing-computation.ts`:**
- [ ] All exported interfaces match the contract exactly (`contracts/pricing-computation-types.ts`)
- [ ] All private helpers are unexported
- [ ] `computePricingEstimate` is the single named export function
- [ ] Integer cent arithmetic used throughout (no raw float multiplication for monetary values)
- [ ] Discount bases computed once before the loop (non-cascading per TD-005)
- [ ] File is ≤ 250 lines (target ~200 per plan.md)
- [ ] No deep nesting (max 4 levels)
- [ ] Coding style: immutable patterns (no mutation of inputs), no `var`

**`tests/unit/services/pricing-computation.test.ts`:**
- [ ] Tests organized by `describe` block matching spec user stories
- [ ] All 20+ spec §Test Coverage Requirements scenarios are present
- [ ] Test file is ≤ 500 lines (target ~400 per plan.md)
- [ ] No test imports implementation internals (only the named export)
- [ ] No `any` in test code

**Commit readiness:**
- [ ] `npx vitest run` — all tests PASS, zero failures
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] Branch coverage ≥ 95%
- [ ] Ready to commit: `feat: add pricing computation engine (F5)`

---

## Dependency Graph

```
Task 1.1 (tests RED)
    └── Task 1.2 (impl GREEN)
            └── Task 2.1 (tests RED)
                    └── Task 2.2 (impl GREEN)
                            └── Task 3.1 (tests RED)
                                    └── Task 3.2 (impl GREEN)
                                            └── Task 4.1 (tests RED)
                                                    └── Task 4.2 (impl GREEN)
                                                            └── Task 5.1 (tests RED)
                                                                    └── Task 5.2 (impl GREEN)
                                                                            └── Task 6.1 (tests RED)
                                                                                    └── Task 6.2 (impl GREEN)
                                                                                            └── Task 7.1 (tests RED)
                                                                                                    └── Task 7.2 (impl GREEN)
                                                                                                            └── Task 8.1 (integration tests)
                                                                                                                    └── Task 8.2 (coverage + tsc gate)
                                                                                                                            └── Task QG.1 (security review)
                                                                                                                                    └── Task QG.2 (code review)
```

---

## Next Steps

1. Review this task breakdown for completeness
2. Start with Task 1.1 — create the test file and write all degradation tests
3. Confirm tests FAIL (RED) before moving to Task 1.2
4. Proceed phase by phase following the dependency graph above
5. Run `/speckit-implement` (or proceed manually) to execute tasks
6. After QG.2 passes: `git commit -m "feat: add pricing computation engine (F5)"`

### Integration with Claude Tools

Tasks can be imported to TaskCreate for tracking:
```bash
# Example: start Task 1.1
TaskCreate("Phase 1: Types + Placeholder Guard — Tests", "Write degradation tests for computePricingEstimate. See Task 1.1 in tasks.md.")
```
