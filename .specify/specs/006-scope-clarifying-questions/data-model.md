# Data Model — F6: Scope Clarifying Questions

## Summary

This feature introduces **no schema changes**. All required data types already exist in the
codebase. The section below documents the existing structures that F6 reads from and writes to, so
that downstream features (F8) have a clear reference.

---

## Existing Types Consumed by F6

### `ProposalDefaults.pricingModel` (read)

Source: `src/lib/db/schema/tenant-settings.ts`

```typescript
export interface ProposalDefaults {
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: number
  warrantyPeriodDays: number
}
```

The `pricingModel` field is the only field F6 reads from `ProposalDefaults`. It is fetched from
`tenant_settings.proposal_defaults` (JSONB column) via `getRateCard(orgId)`.

If `proposalDefaults` is `null` or `proposalDefaults.pricingModel` is absent, F6 treats this as
`'time_and_materials'`.

---

### `ClarifyingQuestion` (written)

Source: `src/lib/db/schema/proposal-drafts.ts`

```typescript
export interface ClarifyingQuestion {
  id: string        // Stable ID — for mandatory questions: 'scope-deliverables' | 'scope-exclusions' | 'scope-timeline'
  question: string  // Human-readable question text
  rfpSection: string // Section label shown in the UI
  answer: string | null // Null until the Preparer submits answers
}
```

The three mandatory questions produced by F6 have fixed IDs. All other questions produced by the
LLM retain the LLM-generated IDs (`q1`, `q2`, ...).

**Mandatory question IDs (F8 contract):**

| `id` | Purpose | Stable? |
|------|---------|---------|
| `scope-deliverables` | Deliverables + effort/pricing per model | Yes — code constant |
| `scope-exclusions` | Explicit out-of-scope work | Yes — code constant |
| `scope-timeline` | Target delivery timeline / milestones | Yes — code constant |

These IDs are declared as `const` values in `proposal-question-generator.ts` and are the
authoritative contract for F8's scope-line parser.

---

### `tenant_settings.proposalDefaults` (read — existing JSONB column)

| Column | Type | Notes |
|--------|------|-------|
| `proposal_defaults` | `jsonb.$type<ProposalDefaults>()` | Already exists; no migration needed |

Fetched via `getRateCard(orgId)` which is already implemented in
`src/lib/services/rate-card.ts`.

---

## No New Tables or Columns

F6 does not require a Drizzle migration. The questions it injects are stored in
`proposal_drafts.clarifying_questions` (existing JSONB array) alongside LLM-generated questions.
No structural distinction is stored in the database between mandatory and LLM-generated questions
beyond the question `id` prefix convention (`scope-*` vs `q*`).
