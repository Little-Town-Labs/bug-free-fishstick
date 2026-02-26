# Technology Research: 005-pricing-computation-engine

**Feature:** F5 — Pricing Computation Engine
**Date:** 2026-02-26

---

## Decision 1: Integer Cent Arithmetic vs Decimal Library

**Context:** The spec explicitly requires avoiding floating-point drift. The example `$33.33/hr × 3 hours = $99.99` is a known IEEE 754 failure case (`33.33 * 3 = 99.99000000000001` in native JS). The spec mandates rounding to 2 decimal places throughout, and the total must hold exactly as `subtotal + marginAmount − sum(discountAmounts)`.

**Options Considered:**

1. **Native `number` with `Math.round` at each step**
   - Pros: No dependencies, trivial to read.
   - Cons: Floating-point drift still occurs in intermediate values before rounding. Cascading rounding calls can compound error. `33.33 * 3` fails before rounding is applied.

2. **`decimal.js` or `big.js` external library**
   - Pros: Arbitrary precision, no drift, widely used in financial code.
   - Cons: Adds a dependency; output must be converted back to `number` for the return type; library overhead is unnecessary given the capped complexity (NFR-001: <50ms for 100 line items).

3. **Integer cent arithmetic (multiply × 100, compute in integers, divide ÷ 100 for output)**
   - Pros: No dependencies. Integers are exact in JS up to `Number.MAX_SAFE_INTEGER` (2^53−1 ≈ 9×10^15). At 2 decimal-place precision, values up to ~$90 trillion are safe — far beyond any realistic proposal. Eliminates all drift.
   - Cons: Requires careful conversion helpers at the boundary. Slightly less readable for first-time readers.

**Chosen:** Integer cent arithmetic (Option 3).

**Rationale:** The spec itself documents this choice in the Edge Cases section: "Integer cent arithmetic is used internally." It satisfies NFR-001 without a runtime dependency, aligns with constitutional Principle II (explicit, typed, no magic), and is the industry pattern for monetary computation in JavaScript without pulling a full accounting library.

**Tradeoffs:** Slightly more complex helper functions at the conversion boundary vs. one-liner `Math.round` calls. Addressed by extracting two tiny pure helpers: `toCents(n: number): number` and `fromCents(n: number): number`.

---

## Decision 2: Rounding Convention for Monetary Display

**Context:** The spec requires "rounded to 2 decimal places for display" throughout. The question is which rounding mode to use (half-up, banker's rounding, truncation).

**Options Considered:**

1. **Half-up (standard "school" rounding):** 0.005 → 0.01, 0.004 → 0.00. The universal commercial default.
2. **Banker's rounding (round half to even):** Used in IEEE 754 default mode. Can diverge from customer expectations for monetary values.
3. **Truncation:** Never rounds up. Creates systematic understatement.

**Chosen:** Half-up via `Math.round(n * 100) / 100` at the `fromCents` output boundary (since cent values are already integers, rounding only applies to division by 100).

**Rationale:** Half-up is the commercial standard in the US. Using integer arithmetic internally means division by 100 is the only place a fractional cent can arise (e.g., when a percentage discount on a subtotal produces a non-whole-cent amount). `Math.round` at that single boundary is the minimal, explicit implementation.

---

## Decision 3: Non-Cascading Discount Base

**Context:** FR-012 states discounts do not compound off each other's reductions — each discount's base is computed before subsequent discounts are applied. The spec explicitly documents this as the chosen pattern.

**Options Considered:**

1. **Non-cascading (parallel bases):** Each discount is computed against a fixed reference (`subtotal` or `subtotal + marginAmount`). This is the standard commercial pattern (price lists, government contracting).
2. **Cascading (running total):** Each discount is computed against the net-after-previous-discounts. Common in retail but creates ambiguity and is not modelled in the current data schema.

**Chosen:** Non-cascading (Option 1).

**Rationale:** Documented in spec as the resolved decision. Simpler to implement, auditable, and matches the accounting pattern where each discount references the original quoted amount.

---

## Decision 4: Markdown Table Format

**Context:** `formattedMarkdown` must be a "ready-to-inject" string. The spec requires: a labelled table with all line items, subtotal row, margin row, one row per applied discount, and total row. The currency and pricing model must appear.

**Options Considered:**

1. **GitHub-Flavored Markdown table** (pipes and dashes): Standard, widely supported, renders correctly in Next.js markdown renderers (e.g. `react-markdown`).
2. **HTML table:** More control over styling but breaks the plain-text portability guarantee.
3. **Custom format:** Non-standard, fragile.

**Chosen:** GitHub-Flavored Markdown table (Option 1).

**Rationale:** The existing proposal output is markdown-based. GFM tables render in all common markdown consumers including the proposal viewer. No additional parser dependencies needed.

**Table structure per pricing model:**
- **T&M:** Caption "Pricing (Time & Materials)"; columns: Description | Role | Qty | Unit | Rate | Total
- **Fixed Price:** Caption "Pricing (Fixed Price)"; same columns; final row labelled "Fixed Price Total"
- **Cost-Plus:** Caption "Pricing (Cost-Plus)"; margin row labelled "Cost-Plus Margin"

---

## Decision 5: Module Location and Export Shape

**Context:** The spec specifies `src/lib/services/pricing-computation.ts` as the target file. This is a pure function — no class, no DB dependency, no LLM.

**Options Considered:**

1. **Named export `computePricingEstimate`** from `src/lib/services/pricing-computation.ts`. Consistent with how `rate-card.ts`, `company-profile.ts`, etc. are structured (named exports, no default exports).
2. **Class-based service**: Unnecessary complexity for a stateless pure function.

**Chosen:** Named export `computePricingEstimate` (Option 1).

**Rationale:** Matches existing service file conventions. Named exports are tree-shakeable and explicit (Constitution Principle III). No class overhead for a pure function.

---

## Decision 6: TypeScript Type Definitions — New vs Reuse

**Context:** The function needs `ScopeLineItem` and `PricingEstimate` types that do not yet exist in the codebase.

**Options Considered:**

1. **Add types to `src/lib/db/schema/tenant-settings.ts`:** Convenient but semantically wrong — scope line items and pricing estimates are not database schema types.
2. **Add types inline in `pricing-computation.ts`:** Simple but creates duplication if other modules need them.
3. **Export from `pricing-computation.ts` alongside the function:** Correct for a pure computational module. Other modules that need the types import from the same file. Consistent with how Drizzle inferred types are exported from schema files.

**Chosen:** Option 3 — export types from `pricing-computation.ts`.

**Rationale:** The types are semantically owned by the pricing computation domain. Keeping them co-located with the function that uses them follows the high-cohesion principle (CLAUDE.md). F8 (the pipeline) will import both the function and the types from this one file.

---

## Decision 7: Test File Location and Framework

**Context:** NFR-003 requires ≥95% branch coverage. The spec lists 20+ explicit test scenarios.

**Options Considered:**

1. **`tests/unit/services/pricing-computation.test.ts`**: Consistent with all other service unit tests in the repo (see `tests/unit/services/rate-card.test.ts`).
2. **Co-located test `src/lib/services/pricing-computation.test.ts`**: Alternate pattern; not used elsewhere in this codebase.

**Chosen:** Option 1 — `tests/unit/services/pricing-computation.test.ts`.

**Rationale:** Matches the established convention for all 8 existing service unit tests. Vitest config includes `tests/**/*.test.{ts,tsx}` so no config change needed.

**Framework:** Vitest with jsdom environment (already configured). No new test dependencies required. Since the function is pure (no DB, no LLM, no external calls), no mocking is needed — tests use real inputs and assert real outputs.
