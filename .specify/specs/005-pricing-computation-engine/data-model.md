# Data Model: 005-pricing-computation-engine

**Feature:** F5 — Pricing Computation Engine
**Date:** 2026-02-26

---

## Overview

This feature introduces no new database tables and no schema migrations. All data structures are TypeScript-only types that exist in memory during computation. The pricing function is stateless: rate card data is fetched by the caller (the Inngest pipeline in F8) and passed in as arguments.

The existing database types (`RateCard`, `RateCardRole`, `RateCardDiscount`, `ProposalDefaults`) defined in `src/lib/db/schema/tenant-settings.ts` are reused as input types. Two new TypeScript types are introduced and exported from `src/lib/services/pricing-computation.ts`.

---

## Input Types (reused from existing schema)

These types are already defined in `src/lib/db/schema/tenant-settings.ts` and are imported by the pricing function.

### `RateCard` (existing)

| Field | Type | Description |
|---|---|---|
| `mode` | `'blended' \| 'by_role'` | Billing mode selector |
| `blendedRate` | `number \| null` | Single rate for blended mode |
| `blendedRateUnit` | `'hour' \| 'day' \| 'fixed' \| null` | Unit for blended rate |
| `roles` | `RateCardRole[]` | Role-rate pairs for by_role mode |
| `defaultMarginPct` | `number` | Margin as decimal (0.20 = 20%) |
| `currency` | `string` | ISO 4217 code (e.g. 'USD') |
| `discounts` | `RateCardDiscount[]` | Ordered discount rules |

### `RateCardRole` (existing)

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Role name (used for case-insensitive matching) |
| `unit` | `'hour' \| 'day' \| 'fixed'` | Billing unit |
| `rate` | `number` | Rate per unit |

### `RateCardDiscount` (existing)

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Display name for the discount row |
| `type` | `'percentage' \| 'fixed'` | Discount calculation type |
| `value` | `number` | Decimal fraction (0.10 = 10%) or fixed currency amount |
| `appliesTo` | `'subtotal' \| 'total'` | Reference base for percentage discounts |
| `customerIds` | `string[] \| null` | Null = universal; array = customer-scoped |

---

## New Types (introduced in this feature)

Both types are defined and exported from `src/lib/services/pricing-computation.ts`.

### `ScopeLineItem` (new input type)

Represents a single deliverable line item provided by the proposal preparer (captured during clarifying questions in F6 and parsed in F8).

| Field | Type | Required | Description |
|---|---|---|---|
| `description` | `string` | Yes | Human-readable deliverable description |
| `role` | `string \| null` | Yes | Role name for by_role mode; null or any value in blended mode |
| `quantity` | `number` | Yes | Quantity of units (hours, days, or fixed count) |
| `unit` | `'hour' \| 'day' \| 'fixed'` | Yes | Unit type; used for display in the table |

**Notes:**
- `quantity` of 0 is valid (produces a $0.00 line, retained for transparency).
- `role` is ignored for rate lookup in blended mode but may appear in the rendered description.
- `unit` on the scope line item is used for table display in all modes. The rate card's `blendedRateUnit` field is not used by the pricing computation function; it exists on the rate card for display purposes elsewhere but does not affect pricing table output.

### `ComputedLineItem` (new intermediate/output type)

Represents a scope line item after rate resolution and total computation. Included in `PricingEstimate.lineItems`.

| Field | Type | Description |
|---|---|---|
| `description` | `string` | From input scope line item |
| `role` | `string \| null` | Null in blended mode; resolved role name in by_role mode (may be fallback role) |
| `quantity` | `number` | From input scope line item |
| `unit` | `'hour' \| 'day' \| 'fixed'` | From input scope line item |
| `unitRate` | `number` | Resolved rate (blended rate or matched role rate) |
| `lineTotal` | `number` | `quantity × unitRate`, rounded to 2 decimal places |
| `isFallbackRole` | `boolean` | True when by_role mode used first-role fallback for this item |

### `AppliedDiscount` (new intermediate/output type)

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Discount rule name |
| `amount` | `number` | Computed deduction, rounded to 2 decimal places |

### `PricingEstimate` (new primary output type)

The complete return value of `computePricingEstimate`.

| Field | Type | Description |
|---|---|---|
| `mode` | `'blended' \| 'by_role'` | Rate card mode used |
| `model` | `'time_and_materials' \| 'fixed_price' \| 'cost_plus'` | Pricing model label |
| `lineItems` | `ComputedLineItem[]` | All scope line items with resolved rates and totals |
| `subtotal` | `number` | Sum of all `lineTotal` values, rounded to 2 decimal places |
| `marginPct` | `number` | Margin percentage from rate card (e.g. 0.20) |
| `marginAmount` | `number` | `subtotal × marginPct`, rounded to 2 decimal places |
| `discountsApplied` | `AppliedDiscount[]` | Ordered list of discounts that were applied |
| `total` | `number` | `subtotal + marginAmount − sum(discountAmounts)`, floored at 0 |
| `currency` | `string` | Currency code from rate card; defaults to 'USD' if absent |
| `formattedMarkdown` | `string` | Ready-to-inject GFM table string |
| `isPlaceholder` | `boolean` | True when inputs are missing and placeholder was returned |
| `totalFlooredAtZero` | `boolean` | True when discount sum exceeded subtotal+margin; total was set to 0 |

### Degraded / Placeholder State (not a separate exported type)

When `isPlaceholder` is true, `formattedMarkdown` equals `[PLACEHOLDER: pricing details required]` and all numeric fields are 0. This is a valid `PricingEstimate` — the `isPlaceholder` flag distinguishes it. There is no separate `DegradedPricingEstimate` interface exported; the single `PricingEstimate` type covers both normal and placeholder results.

**Design rationale:** Using a single return type with an `isPlaceholder` flag rather than a union type keeps the F8 pipeline code simple — it always receives a `PricingEstimate` and checks `isPlaceholder` to decide whether to log a warning. A union type would require a type guard at every call site.

---

## Function Signature

```typescript
function computePricingEstimate(
  rateCard: RateCard | null | undefined,
  scopeLines: ScopeLineItem[] | null | undefined,
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus',
  customerId?: string,
): PricingEstimate
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `rateCard` | `RateCard \| null \| undefined` | Rate card from tenant settings; null/undefined triggers placeholder |
| `scopeLines` | `ScopeLineItem[] \| null \| undefined` | Scope line items; null/undefined/empty triggers placeholder |
| `pricingModel` | `'time_and_materials' \| 'fixed_price' \| 'cost_plus'` | From `proposalDefaults.pricingModel` |
| `customerId` | `string \| undefined` | Optional; used to filter customer-scoped discounts |

**Return type:** `PricingEstimate` (always — never throws for missing inputs)

---

## Computation Invariants

The following invariants must hold for any non-placeholder result:

1. `lineItems[i].lineTotal = round2(lineItems[i].quantity × lineItems[i].unitRate)`
2. `subtotal = round2(sum(lineItems[i].lineTotal))`
3. `marginAmount = round2(subtotal × marginPct)`
4. For each percentage discount: `amount = round2(base × discount.value)` where `base = subtotal` if `appliesTo='subtotal'` else `subtotal + marginAmount`
5. For each fixed discount: `amount = round2(discount.value)`
6. `total = max(0, subtotal + marginAmount − sum(discountsApplied[i].amount))`
7. `totalFlooredAtZero = (subtotal + marginAmount − sum(...)) < 0`

---

## No Database Changes

This feature requires no Drizzle migration. All types are TypeScript-only. The existing `rateCard` JSONB column in `tenant_settings` (added in F1/F2) is the data source; `pricing-computation.ts` operates exclusively on the in-memory deserialized value passed to it.
