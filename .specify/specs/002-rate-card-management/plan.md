# Implementation Plan: Rate Card Management

**Feature:** F2 — `002-rate-card-management`
**Branch:** `002-rate-card-management`
**Spec:** `.specify/specs/002-rate-card-management/spec.md`
**Created:** 2026-02-25

---

## Executive Summary

F2 delivers the settings UI and API for the organization rate card. The data model (JSONB columns, TypeScript types, Zod schemas) was landed in F1. This feature adds the read/write service layer, two API route handlers, and a multi-part settings page section.

One schema amendment is required: `blendedRateUnit` must be added to the `RateCard` interface and Zod schema — a field that was omitted in F1 but is needed by the UI and later by the F5 pricing engine.

The implementation touches **5 new files** and **2 amended files**:

| Category | File | New/Amended |
|---|---|---|
| Schema amendment | `src/lib/utils/validation.ts` | amended |
| Schema amendment | `src/lib/db/schema/tenant-settings.ts` | amended |
| Service layer | `src/lib/services/rate-card.ts` | new |
| API route | `src/app/api/settings/rate-card/route.ts` | new |
| Settings page | `src/app/(auth)/settings/rate-card/page.tsx` | new |
| UI component | `src/components/settings/RateCardForm.tsx` | new |
| Settings nav | `src/app/(auth)/settings/page.tsx` | amended |

---

## Architecture Overview

```
Browser
  └── /settings/rate-card (page.tsx — server component)
        └── RateCardForm (client component — all form state)
              ├── mode toggle (blended | by_role)
              ├── blended section: rate + unit fields
              ├── by-role section: RoleTable (add/edit/remove rows)
              ├── pricing defaults section (model, margin, terms, warranty, currency)
              └── discounts section: DiscountList (add/edit/remove/reorder rows)
                    └── on save → PATCH /api/settings/rate-card
                                    └── rateCardService.upsertRateCard()
                                          └── Drizzle → tenant_settings (JSONB columns)
              on mount → GET /api/settings/rate-card
                            └── rateCardService.getRateCard()
```

---

## Technology Stack

All decisions are documented in `research.md`. Summary:

| Concern | Choice | Rationale |
|---|---|---|
| API route structure | Dedicated sub-resource `/api/settings/rate-card/route.ts` | Follows integrations pattern; rate card is a distinct resource domain |
| DB access | Drizzle ORM via service layer (`rate-card.ts`) | Service layer enables F5 to reuse; avoids raw SQL debt of legacy settings route |
| Auth | `requireAuth()` + `isAdmin()` from existing `auth.ts` | Consistent with all existing routes |
| Form state | Local `useReducer` in `RateCardForm` | No new dependencies; consistent with existing settings forms |
| Save strategy | Server-first (await PATCH, then update local state) | Consistent with existing patterns; simplifies cross-field error display |
| Schema amendment | Add `blendedRateUnit` to F1 types and Zod schema | Required by spec; no migration needed for JSONB |

---

## Technical Decisions

### TD-001: `blendedRateUnit` amendment to F1 schemas

**Problem:** The F1 `RateCard` interface has `blendedRate: number | null` but no unit field. US-002 requires the admin to select a unit (hour/day/fixed) for blended mode.

**Decision:** Add `blendedRateUnit: 'hour' | 'day' | 'fixed' | null` to the TypeScript `RateCard` interface and a corresponding field to `rateCardSchema`. Add a `.refine()` that requires `blendedRateUnit !== null` when `mode === 'blended'`.

**Impact:** 2 files amended, 1 new test case in validation.test.ts. No DB migration.

---

### TD-002: Validation error format

**Problem:** The existing settings route returns `{ error: string }`. The spec requires per-field error messages (NFR-004).

**Decision:** Return `{ error: 'Validation failed', details: [{ field, message }] }` for 422s. The Zod `.safeParse()` `.error.issues` array maps cleanly to this format. Other status codes keep the simple `{ error }` envelope.

**Implementation:**
```typescript
const parsed = createRateCardPatchSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({
    error: 'Validation failed',
    details: parsed.error.issues.map(i => ({
      field: i.path.join('.'),
      message: i.message,
    }))
  }, { status: 422 })
}
```

---

### TD-003: Upsert strategy

**Problem:** `tenant_settings` may or may not have a row for the org. The PATCH must handle both insert and update.

**Decision:** Use Drizzle's `.insert().onConflictDoUpdate()` targeting `organization_id`. This is the safe, idempotent pattern — no `INSERT ... ON CONFLICT` raw SQL.

```typescript
await db.insert(tenantSettings)
  .values({ organizationId: orgId, rateCard, proposalDefaults, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: tenantSettings.organizationId,
    set: { rateCard, proposalDefaults, updatedAt: new Date() },
  })
```

---

### TD-004: Settings navigation

**Problem:** The settings page (`/settings`) has a hardcoded `tabs` array. "Rate Card" needs to be added.

**Decision:** Add `{ label: 'Rate Card', href: '/settings/rate-card' }` to the tabs array. The page component is a client component so this is a one-line change.

---

## Implementation Phases

### Phase 1: Schema Amendment (TDD)

**Files:** `src/lib/utils/validation.ts`, `src/lib/db/schema/tenant-settings.ts`

1. Write tests first for `blendedRateUnit` validation:
   - Blended mode requires `blendedRateUnit` to be non-null
   - Blended mode with null `blendedRateUnit` is rejected
   - `by_role` mode accepts `blendedRateUnit: null`
2. Add `blendedRateUnit` to TypeScript `RateCard` interface
3. Add `blendedRateUnit` field and `.refine()` to `rateCardSchema`
4. Add `createRateCardPatchSchema` to validation.ts
5. Run tests → all pass

### Phase 2: Service Layer (TDD)

**File:** `src/lib/services/rate-card.ts`

1. Write service tests first (mock Drizzle `db`):
   - `getRateCard` returns `{ rateCard: null, proposalDefaults: null }` when no row
   - `getRateCard` returns typed objects from JSONB
   - `upsertRateCard` calls insert with correct values
   - `upsertRateCard` passes orgId as organizationId (tenant isolation)
2. Implement `getRateCard(orgId)` and `upsertRateCard(orgId, rateCard, proposalDefaults)`
3. Export both functions

### Phase 3: API Route (TDD)

**File:** `src/app/api/settings/rate-card/route.ts`

1. Write route integration tests first:
   - `GET` returns 401 when unauthenticated
   - `GET` returns `{ rateCard: null, proposalDefaults: null }` when no config
   - `GET` returns saved rate card for any org member
   - `PATCH` returns 401 when unauthenticated
   - `PATCH` returns 403 when authenticated as non-admin
   - `PATCH` returns 422 with `details` array for invalid body
   - `PATCH` returns 422 for blended mode with null blendedRate
   - `PATCH` returns 422 for by_role mode with empty roles
   - `PATCH` returns 422 for percentage discount > 1
   - `PATCH` returns 422 for empty customerIds array
   - `PATCH` returns 200 and round-trips blended rate card
   - `PATCH` returns 200 and round-trips by-role rate card
2. Implement `GET` handler: `requireAuth()` → `getRateCard(orgId)` → 200
3. Implement `PATCH` handler: `requireAuth()` → `isAdmin()` check → Zod parse → `upsertRateCard()` → 200

### Phase 4: Settings UI (TDD)

**Files:**
- `src/app/(auth)/settings/rate-card/page.tsx` (server component)
- `src/components/settings/RateCardForm.tsx` (client component)
- `src/app/(auth)/settings/page.tsx` (amended — add tab)

#### Page Component
Server component that reads `isAdmin` from Clerk and passes to the form.

```typescript
export default async function RateCardSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false
  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Rate Card</h1>
      <RateCardForm isAdmin={admin} />
    </div>
  )
}
```

#### Client Component: `RateCardForm`

**State shape (useReducer):**
```typescript
type RateCardState = {
  mode: 'blended' | 'by_role'
  blendedRate: string          // string for controlled input, parsed on save
  blendedRateUnit: 'hour' | 'day' | 'fixed'
  roles: Array<{ id: string; name: string; unit: string; rate: string }>
  defaultMarginPct: string     // e.g. "20" (display as %), parsed to 0.2 on save
  currency: string
  pricingModel: string
  paymentTermsDays: string
  warrantyPeriodDays: string
  discounts: Array<{
    id: string; name: string; type: string; value: string
    appliesTo: string; customerIds: string  // comma-separated in UI
  }>
  saving: boolean
  errors: ValidationErrorDetail[]
}
```

**Sub-components (all within `RateCardForm.tsx` unless complex):**
- `BlendedRateSection` — rate input + unit select
- `RoleTable` — role rows with add/edit/delete; inline editing
- `PricingDefaultsSection` — margin, model, terms, warranty, currency inputs
- `DiscountList` — ordered discount rows with add/edit/delete/reorder; inline editing
- `DiscountRow` — single discount form: name, type, value, appliesTo, customerIds textarea

**On mount:** `GET /api/settings/rate-card` → populate form state
**On save:** Parse form strings to numbers → `PATCH /api/settings/rate-card` → show 422 errors inline or success toast

**Admin gating:** Non-admin sees all fields as read-only (disabled inputs). Save button hidden.

**Mode switching UX:**
- Switching from by-role to blended: show warning "This will not delete your roles. Switch back to by-role to restore them." (roles data preserved in state, not submitted in blended mode)
- Role list not submitted when mode = blended (send empty array or actual roles — spec allows empty array in blended mode)

#### Component Tests
- Renders empty state when rateCard is null
- Renders blended rate form with correct values
- Renders by-role table with correct rows
- Mode toggle switches visible sections
- Add role adds a row to the table
- Remove role removes the row; saving with zero roles shows client-side error
- Save button disabled for non-admin
- PATCH called with correct payload on save
- 422 details rendered as per-field error messages

### Phase 5: Settings Navigation

**File:** `src/app/(auth)/settings/page.tsx`

Add Rate Card tab to the existing nav:

```diff
 const tabs = [
   { label: 'General', href: '/settings' },
   { label: 'Users', href: '/settings/users' },
   { label: 'LLM Configuration', href: '/settings/llm' },
   { label: 'Integrations', href: '/settings/integrations' },
+  { label: 'Rate Card', href: '/settings/rate-card' },
 ]
```

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── settings/
│   │       └── rate-card/
│   │           └── route.ts                    # NEW — GET + PATCH handlers
│   └── (auth)/
│       └── settings/
│           ├── page.tsx                         # AMENDED — add Rate Card tab
│           └── rate-card/
│               └── page.tsx                    # NEW — server component page
├── components/
│   └── settings/
│       └── RateCardForm.tsx                    # NEW — client component + sub-components
└── lib/
    ├── db/
    │   └── schema/
    │       └── tenant-settings.ts              # AMENDED — add blendedRateUnit
    ├── services/
    │   └── rate-card.ts                        # NEW — getRateCard, upsertRateCard
    └── utils/
        └── validation.ts                       # AMENDED — blendedRateUnit + patch schema

tests/
└── unit/
    ├── api/
    │   └── rate-card-settings.test.ts          # NEW — route handler tests
    └── services/
        └── rate-card.test.ts                   # NEW — service layer tests
src/lib/utils/validation.test.ts                # AMENDED — blendedRateUnit cases
src/components/settings/RateCardForm.test.tsx   # NEW — component tests
```

---

## Security Considerations

**Tenant Isolation (Principle I):**
- `requireAuth()` always called first; `orgId` from session, never from request
- Service layer receives `orgId` as parameter; no user-supplied org scoping
- DB query: `WHERE organization_id = orgId` enforced in service layer

**Admin Authorization (Principle IV):**
- `PATCH` protected by `isAdmin(auth.orgRole)` → 403 if not admin
- `GET` accessible to all org members (read-only, no sensitive data beyond margin/rates which org members legitimately need to see)
- Non-admin sees disabled form in UI (belt-and-suspenders)

**Input Validation:**
- All inputs validated by Zod before DB write
- Cross-field rules enforced by `.refine()` (blendedRate/mode, roles/mode, customerIds non-empty)
- Error messages reference field paths only; no data values echoed in error responses

**Data Sensitivity:**
- Rate card values (margin, rates) are internal business data, not PII
- Not encrypted at rest (no `encrypt()` call) — consistent with how the DB stores other non-key business data
- Do not log rate card values in server console (only log errors at the structural level)

---

## Performance Strategy

**NFR-001 target:** PATCH < 2s P90

- Single `db.insert().onConflictDoUpdate()` call — one DB round-trip
- No encryption/decryption overhead (unlike API keys)
- JSONB column write is O(1) for the column update
- No vector operations or LLM calls
- Expected P99 < 200ms under normal Neon load

**GET optimization:**
- Select only `rate_card` and `proposal_defaults` columns (not `*`)
- Single DB query, no joins

---

## Testing Strategy

| Test type | Target | Coverage requirement |
|---|---|---|
| Unit — validation | `blendedRateUnit` in `validation.test.ts` | All new fields + new refine rules |
| Unit — service | `rate-card.test.ts` | `getRateCard` (empty, blended, by-role) + `upsertRateCard` (tenant scoping) |
| Unit — route | `rate-card-settings.test.ts` | All HTTP status codes (401, 403, 422, 200) + both modes |
| Unit — component | `RateCardForm.test.tsx` | Empty state, blended render, by-role render, mode toggle, save, 422 display |
| Type check | `tsc --noEmit` | Must pass with no errors |

**Coverage target:** ≥80% across all new/amended files (constitution Principle V)

---

## Constitutional Compliance

| Principle | How F2 Addresses It |
|---|---|
| I. Tenant Isolation | `orgId` always from `requireAuth()`, never from request; service layer enforces `WHERE organization_id = orgId` |
| II. Type Safety | `blendedRateUnit` amendment restores type safety for blended mode; `RateCard` interface fully typed; Zod inferred types throughout |
| III. Explicit Over Implicit | Validation is explicit Zod safeParse with detailed error output; no implicit coercion |
| IV. Secure by Default | `requireAuth()` on every handler; `isAdmin()` guard on PATCH; rate card values not logged |
| V. 80% Coverage | Service, route, and component all require comprehensive tests before implementation |
| IX. Progressive Disclosure | Mode toggle reveals only the relevant fields; discounts section is separate; complexity is task-oriented |
| X. Human Always in Control | Non-admin sees read-only view; admin explicitly saves; no auto-save |
| XI. Consistent Feedback | 422 details rendered inline per field; success shown via toast matching other settings forms |

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `blendedRateUnit` breaks F1 validation tests (strict schema) | Medium | Low | Update existing validation test cases to include the new field |
| Discount reorder UX complexity | Medium | Medium | Start with up/down arrow buttons; drag-and-drop is a future enhancement |
| Form state complexity with nested role/discount lists | Medium | Low | `useReducer` with explicit action types keeps state transitions auditable |
| F5 reads stale rate card without `blendedRateUnit` | Low | Low | F5 defaults to 'hour' when field is null; documented in data-model.md |

---

## Next Steps

1. Review this plan and `research.md` for technical accuracy
2. Run `/speckit-analyze` to validate cross-artifact consistency
3. Run `/speckit-tasks` to generate the executable task breakdown
4. Commit: `git commit -m "docs: add implementation plan for F2 rate card management"`
