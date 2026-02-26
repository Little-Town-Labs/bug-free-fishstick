# Data Model: Rate Card Management

**Feature:** F2 — `002-rate-card-management`

---

## Overview

No new database tables or columns are introduced by F2. The F1 migration (`drizzle/0008_proposal_bid_engine.sql`) already added `rate_card` (JSONB) and `proposal_defaults` (JSONB) to `tenant_settings`.

F2 introduces one **minor amendment** to the existing TypeScript types and Zod schemas to fix a gap discovered during planning: `blendedRateUnit` is missing from the `RateCard` structure (see research.md Decision 3).

---

## Existing Table: `tenant_settings`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `organization_id` | text | Primary Key | Clerk org ID; scopes all data |
| `rate_card` | jsonb | nullable | RateCard object (see below) |
| `proposal_defaults` | jsonb | nullable | ProposalDefaults object (see below) |
| `company_profile` | text | nullable | Added in F1, used by F3 |
| `llm_provider` | text | not null, default 'claude' | Unaffected by F2 |
| `confidence_threshold` | real | not null | Unaffected by F2 |
| `auto_learn_enabled` | boolean | not null | Unaffected by F2 |
| `created_at` | timestamp | not null | Unaffected by F2 |
| `updated_at` | timestamp | not null | Updated on every PATCH |

---

## JSONB Structure: `rate_card`

### RateCard (amended from F1)

```typescript
interface RateCard {
  mode: 'blended' | 'by_role'
  blendedRate: number | null        // positive when mode=blended; null when mode=by_role
  blendedRateUnit: 'hour' | 'day' | 'fixed' | null  // NEW — required when mode=blended
  roles: RateCardRole[]             // non-empty when mode=by_role; may be [] when blended
  defaultMarginPct: number          // decimal fraction 0–1
  currency: string                  // /^[A-Z]{3}$/ e.g. 'USD'
  discounts: RateCardDiscount[]
}
```

**Amendment rationale:** The existing `RateCard` interface lacked a unit for the blended rate. Without this field, a blended rate of $150 could not be stored as "$150/day" vs "$150/hour". The F5 pricing engine needs this to label the pricing table column correctly.

**Backward compatibility:** Existing `rate_card` JSONB rows (none in production yet — F1 was just applied) will have no `blendedRateUnit` key. The TypeScript type makes it `| null`, and the F5 pricing engine will default to `'hour'` if the field is absent from a legacy row.

### RateCardRole

```typescript
interface RateCardRole {
  name: string          // non-empty, unique within roles array
  unit: 'hour' | 'day' | 'fixed'
  rate: number          // positive
}
```

*(Unchanged from F1)*

### RateCardDiscount

```typescript
interface RateCardDiscount {
  name: string
  type: 'percentage' | 'fixed'
  value: number                     // percentage: 0–1; fixed: non-negative amount
  appliesTo: 'subtotal' | 'total'
  customerIds: string[] | null      // null = universal; non-empty array = customer-scoped
}
```

*(Unchanged from F1)*

---

## JSONB Structure: `proposal_defaults`

### ProposalDefaults

```typescript
interface ProposalDefaults {
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: number          // integer >= 0
  warrantyPeriodDays: number        // integer >= 0
}
```

*(Unchanged from F1)*

---

## Zod Schema Amendments (F2 scope)

### `rateCardSchema` — add `blendedRateUnit`

```typescript
// In src/lib/utils/validation.ts
export const rateCardSchema = z.object({
  mode: z.enum(['blended', 'by_role']),
  blendedRate: z.number().positive().nullable(),
  blendedRateUnit: z.enum(['hour', 'day', 'fixed']).nullable(),  // NEW
  roles: z.array(rateCardRoleSchema),
  defaultMarginPct: z.number().min(0).max(1),
  currency: z.string().regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code (e.g. USD)'),
  discounts: z.array(rateCardDiscountSchema),
}).strict()
  .refine(
    (d) => d.mode !== 'blended' || (d.blendedRate !== null && d.blendedRate > 0),
    { message: 'blendedRate is required and must be positive when mode is blended', path: ['blendedRate'] }
  )
  .refine(
    (d) => d.mode !== 'blended' || d.blendedRateUnit !== null,  // NEW
    { message: 'blendedRateUnit is required when mode is blended', path: ['blendedRateUnit'] }
  )
  .refine(
    (d) => d.mode !== 'by_role' || d.roles.length > 0,
    { message: 'at least one role is required when mode is by_role', path: ['roles'] }
  )
```

### `createRateCardPatchSchema` — new validation schema for PATCH body

A wrapper schema for the full PATCH request body (both objects required, non-nullable):

```typescript
export const createRateCardPatchSchema = z.object({
  rateCard: rateCardSchema,
  proposalDefaults: proposalDefaultsSchema,
})

export type CreateRateCardPatchInput = z.infer<typeof createRateCardPatchSchema>
```

---

## Read Access Pattern (Service Layer)

```typescript
// src/lib/services/rate-card.ts
async function getRateCard(orgId: string): Promise<{ rateCard: RateCard | null; proposalDefaults: ProposalDefaults | null }>
```

Reads `rate_card` and `proposal_defaults` columns from `tenant_settings` where `organization_id = orgId`.

## Write Access Pattern (Service Layer)

```typescript
async function upsertRateCard(
  orgId: string,
  rateCard: RateCard,
  proposalDefaults: ProposalDefaults
): Promise<void>
```

Upserts the `tenant_settings` row (insert on conflict do update) setting `rate_card`, `proposal_defaults`, and `updated_at`.

---

## No Migration Required

JSONB is schema-flexible. Adding `blendedRateUnit` to the TypeScript type and Zod schema does not require a DDL migration — existing rows will simply omit the field and be read as `null`.
