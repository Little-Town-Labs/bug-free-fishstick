# Task Breakdown: Rate Card Management

**Feature:** F2 — `002-rate-card-management`
**Plan:** `.specify/specs/002-rate-card-management/plan.md`
**Created:** 2026-02-25

---

## Summary

| Metric | Value |
|---|---|
| Total Tasks | 17 |
| Phases | 5 + Quality Gates |
| Implementation Tasks | 7 |
| Test Tasks | 7 |
| Quality Gate Tasks | 3 |
| Total Effort | ~14h |
| Critical Path Duration | ~10h sequential |

**Critical Path:**
`1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1 → 4.2 → QG.1 → QG.2`

**Parallelization:**
- Tasks 4.3 (nav tab) can run parallel to 4.1/4.2 (independent file)
- QG.1 (TypeScript check) and QG.2 (security review) run in parallel after Phase 4

---

## Phase 1: Schema Amendment

**Goal:** Add `blendedRateUnit` field to the F1 schemas and add the new `createRateCardPatchSchema`. No migration required.

**Files touched:**
- `src/lib/utils/validation.ts` (amended)
- `src/lib/db/schema/tenant-settings.ts` (amended)
- `src/lib/utils/validation.test.ts` (amended)

---

### Task 1.1: Schema Amendment — Tests
**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None

**Description:**
Amend `src/lib/utils/validation.test.ts` to add test cases for the `blendedRateUnit` field and the new `createRateCardPatchSchema`. **Tests must be written and confirmed FAILING before Task 1.2 begins.**

**What to test:**
- `rateCardSchema` — blended mode with `blendedRateUnit: 'hour'` passes
- `rateCardSchema` — blended mode with `blendedRateUnit: null` is rejected (refine violation)
- `rateCardSchema` — blended mode with `blendedRateUnit: 'day'` passes
- `rateCardSchema` — blended mode with `blendedRateUnit: 'fixed'` passes
- `rateCardSchema` — `by_role` mode accepts `blendedRateUnit: null` (unit on role, not card-level)
- `rateCardSchema` — extra key `blendedRateUnit: 'week'` fails (not in enum, strict mode)
- `createRateCardPatchSchema` — accepts valid `{ rateCard, proposalDefaults }` (both modes)
- `createRateCardPatchSchema` — rejects body missing `proposalDefaults`
- `createRateCardPatchSchema` — rejects body missing `rateCard`

**Acceptance Criteria:**
- [ ] 9 new test cases added to `validation.test.ts`
- [ ] All 9 tests FAIL (schemas not yet amended)
- [ ] TypeScript compiles (test file may have type errors that resolve after 1.2)

---

### Task 1.2: Schema Amendment — Implementation
**Status:** 🔴 Blocked by 1.1
**Effort:** 0.5h
**Dependencies:** Task 1.1

**Description:**
Amend the Zod schema and TypeScript interface:

1. **`src/lib/db/schema/tenant-settings.ts`** — Add `blendedRateUnit: 'hour' | 'day' | 'fixed' | null` to the `RateCard` TypeScript interface.

2. **`src/lib/utils/validation.ts`** — Make the following changes:
   - Add `blendedRateUnit: z.enum(['hour', 'day', 'fixed']).nullable()` to `rateCardSchema` object
   - Add a new `.refine()` to `rateCardSchema`: mode `blended` requires `blendedRateUnit !== null`
   - Add `createRateCardPatchSchema` after the bid engine schemas:
     ```typescript
     export const createRateCardPatchSchema = z.object({
       rateCard: rateCardSchema,
       proposalDefaults: proposalDefaultsSchema,
     })
     export type CreateRateCardPatchInput = z.infer<typeof createRateCardPatchSchema>
     ```

**Acceptance Criteria:**
- [ ] `blendedRateUnit` field in `RateCard` interface
- [ ] `blendedRateUnit` field in `rateCardSchema` with `.nullable()` and `.strict()` preserved
- [ ] Blended-mode refine rejects `blendedRateUnit: null`
- [ ] `createRateCardPatchSchema` exported
- [ ] `CreateRateCardPatchInput` type exported
- [ ] All 9 new tests from Task 1.1 PASS
- [ ] All pre-existing validation tests still PASS (no regressions)
- [ ] `tsc --noEmit` passes

---

## Phase 2: Service Layer

**Goal:** Extract DB access into a reusable service so the route handler and future F5 pricing engine can share it.

**Files touched:**
- `src/lib/services/rate-card.ts` (new)
- `tests/unit/services/rate-card.test.ts` (new)

---

### Task 2.1: Service Layer — Tests
**Status:** 🔴 Blocked by 1.2
**Effort:** 1h
**Dependencies:** Task 1.2

**Description:**
Create `tests/unit/services/rate-card.test.ts`. Mock the Drizzle `db` import. **Tests must be confirmed FAILING before Task 2.2 begins.**

**What to test:**

`getRateCard(orgId)`:
- Returns `{ rateCard: null, proposalDefaults: null }` when no row found in DB
- Returns `{ rateCard: <object>, proposalDefaults: <object> }` when row exists
- Queries with `WHERE organization_id = orgId` (tenant isolation — verify the query includes orgId)
- Selects only `rate_card` and `proposal_defaults` columns (not `*`)

`upsertRateCard(orgId, rateCard, proposalDefaults)`:
- Calls `db.insert().onConflictDoUpdate()` with `organization_id = orgId`
- Sets `rate_card` to the provided rateCard object
- Sets `proposal_defaults` to the provided proposalDefaults object
- Sets `updated_at` to a recent timestamp

**Mocking approach:**
```typescript
// Mock db using the existing pattern from other service tests
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn(),
  }
}))
```

**Acceptance Criteria:**
- [ ] Test file created at `tests/unit/services/rate-card.test.ts`
- [ ] `getRateCard` — 4 test cases (null result, populated result, tenant scoping, column selection)
- [ ] `upsertRateCard` — 4 test cases (insert called, orgId correct, rateCard persisted, updatedAt set)
- [ ] All 8 tests FAIL (service not yet implemented)

---

### Task 2.2: Service Layer — Implementation
**Status:** 🔴 Blocked by 2.1
**Effort:** 1h
**Dependencies:** Task 2.1

**Description:**
Create `src/lib/services/rate-card.ts`:

```typescript
import { db } from '@/lib/db'
import { tenantSettings } from '@/lib/db/schema'
import type { RateCard, ProposalDefaults } from '@/lib/db/schema/tenant-settings'
import { eq } from 'drizzle-orm'

export async function getRateCard(orgId: string): Promise<{
  rateCard: RateCard | null
  proposalDefaults: ProposalDefaults | null
}> {
  const [row] = await db
    .select({
      rateCard: tenantSettings.rateCard,
      proposalDefaults: tenantSettings.proposalDefaults,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, orgId))
    .limit(1)

  return {
    rateCard: row?.rateCard ?? null,
    proposalDefaults: row?.proposalDefaults ?? null,
  }
}

export async function upsertRateCard(
  orgId: string,
  rateCard: RateCard,
  proposalDefaults: ProposalDefaults
): Promise<void> {
  await db
    .insert(tenantSettings)
    .values({
      organizationId: orgId,
      rateCard,
      proposalDefaults,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenantSettings.organizationId,
      set: { rateCard, proposalDefaults, updatedAt: new Date() },
    })
}
```

**Acceptance Criteria:**
- [ ] `getRateCard` function exported
- [ ] `upsertRateCard` function exported
- [ ] Both functions fully typed (no `any`)
- [ ] `upsertRateCard` uses `.onConflictDoUpdate()` (not raw SQL)
- [ ] All 8 tests from Task 2.1 PASS
- [ ] `tsc --noEmit` passes

---

## Phase 3: API Route

**Goal:** Implement `GET` and `PATCH /api/settings/rate-card` following the OpenAPI contract.

**Files touched:**
- `src/app/api/settings/rate-card/route.ts` (new)
- `tests/unit/api/rate-card-settings.test.ts` (new)

---

### Task 3.1: API Route — Tests
**Status:** 🔴 Blocked by 2.2
**Effort:** 2h
**Dependencies:** Task 2.2

**Description:**
Create `tests/unit/api/rate-card-settings.test.ts`. Mock `requireAuth`, `isAdmin`, and the `rate-card` service. **Tests must be confirmed FAILING before Task 3.2 begins.**

**Mock setup:**
```typescript
vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  isAdmin: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) { super(message) }
  },
}))

vi.mock('@/lib/services/rate-card', () => ({
  getRateCard: vi.fn(),
  upsertRateCard: vi.fn(),
}))
```

**GET tests:**
- Returns 401 when `requireAuth` throws `AuthError(401)`
- Returns 500 on unexpected error
- Returns `{ rateCard: null, proposalDefaults: null }` with status 200 when service returns nulls
- Returns populated rate card object with status 200 when service returns data
- Calls `getRateCard` with the `orgId` from session (tenant isolation)

**PATCH tests:**
- Returns 401 when `requireAuth` throws `AuthError(401)`
- Returns 403 when `isAdmin` returns false
- Returns 422 with `details` array when body fails Zod validation (malformed JSON test: missing `rateCard`)
- Returns 422 for blended mode with null `blendedRate`
- Returns 422 for blended mode with null `blendedRateUnit`
- Returns 422 for `by_role` mode with empty `roles` array
- Returns 422 for percentage discount `value > 1`
- Returns 422 for `customerIds: []` (empty array — must be null or non-empty)
- Returns 422 for invalid currency code (e.g. `'usd'` — lowercase)
- Returns 200 `{ success: true }` for valid blended rate card
- Returns 200 `{ success: true }` for valid by-role rate card
- Calls `upsertRateCard` with `orgId` from session (tenant isolation)
- Does NOT call `upsertRateCard` when validation fails

**Acceptance Criteria:**
- [ ] 16 test cases covering GET (5) and PATCH (11)
- [ ] All 16 tests FAIL (route not yet implemented)
- [ ] Mock structure matches existing test patterns (see `tests/unit/api/proposals-export.test.ts`)

---

### Task 3.2: API Route — Implementation
**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5h
**Dependencies:** Task 3.1

**Description:**
Create `src/app/api/settings/rate-card/route.ts`:

**GET handler:**
```typescript
export async function GET() {
  try {
    const auth = await requireAuth()
    const result = await getRateCard(auth.orgId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**PATCH handler:**
```typescript
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth()

    if (!isAdmin(auth.orgRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
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

    await upsertRateCard(auth.orgId, parsed.data.rateCard, parsed.data.proposalDefaults)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- [ ] Route file created at correct path
- [ ] Both `GET` and `PATCH` exported
- [ ] `GET` accessible to any authenticated user (no `isAdmin` guard on GET)
- [ ] `PATCH` guarded by `isAdmin` returning 403 if false
- [ ] Zod `safeParse` used (not `parse`) — errors produce 422 with `details` array
- [ ] `upsertRateCard` called with `auth.orgId` (not from request body)
- [ ] All 16 tests from Task 3.1 PASS
- [ ] `tsc --noEmit` passes

---

## Phase 4: Settings UI

**Goal:** Implement the `/settings/rate-card` page with full form functionality.

**Files touched:**
- `src/components/settings/RateCardForm.tsx` (new)
- `src/components/settings/RateCardForm.test.tsx` (new)
- `src/app/(auth)/settings/rate-card/page.tsx` (new)
- `src/app/(auth)/settings/page.tsx` (amended — add tab)

---

### Task 4.1: RateCardForm — Tests
**Status:** 🔴 Blocked by 3.2
**Effort:** 2h
**Dependencies:** Task 3.2

**Description:**
Create `src/components/settings/RateCardForm.test.tsx`. Use `@testing-library/react` (already used in the project). Mock `fetch` for API calls. **Tests must be confirmed FAILING before Task 4.2 begins.**

**Setup:**
```typescript
// Mock fetch globally in test setup
global.fetch = vi.fn()
```

**Render tests:**
- Renders empty state when `GET /api/settings/rate-card` returns null
- Renders blended rate card form with correct values populated
- Renders by-role table with role rows populated
- Shows mode as "Blended" when `mode: 'blended'`
- Shows mode as "By Role" when `mode: 'by_role'`

**Interaction tests:**
- Clicking mode toggle from blended → by-role changes visible section
- Clicking "Add Role" adds a new row to the role table
- Clicking the delete icon on a role removes that row
- Entering a blended rate updates the rate field
- Entering an invalid rate (e.g. "0") does not enable save (client-side guard)

**Save tests:**
- Clicking Save calls `PATCH /api/settings/rate-card` with correct payload
- Non-admin user sees all inputs as disabled (no Save button rendered)
- 422 response details rendered as per-field error messages inline
- Successful 200 response shows success feedback (toast or success state)

**Discount tests:**
- "Add Discount" button renders a new discount row
- Discount type dropdown shows "Percentage" and "Fixed"
- Removing a discount row removes it from the list

**Acceptance Criteria:**
- [ ] 15 test cases covering render (5), interaction (5), save (4), discounts (3)
- [ ] All 15 tests FAIL (component not yet implemented)
- [ ] Tests use `@testing-library/react` and `userEvent` patterns consistent with codebase

---

### Task 4.2: RateCardForm — Implementation
**Status:** 🔴 Blocked by 4.1
**Effort:** 3h
**Dependencies:** Task 4.1

**Description:**
Create `src/components/settings/RateCardForm.tsx`. This is the most complex task in F2.

**Component structure:**
```
RateCardForm (useReducer state, isAdmin prop)
├── Mode toggle (blended | by_role)
├── BlendedRateSection (hidden when by_role)
│     ├── Rate input
│     └── Unit select (hour | day | fixed)
├── RoleTable (hidden when blended)
│     ├── RoleRow[] (name input, unit select, rate input, delete button)
│     └── "Add Role" button
├── PricingDefaultsSection
│     ├── Margin % input
│     ├── Currency input
│     ├── Pricing model select (time_and_materials | fixed_price | cost_plus)
│     ├── Payment terms (days) input
│     └── Warranty period (days) input
├── DiscountList
│     ├── DiscountRow[] (name, type, value, appliesTo, customerIds, delete, reorder)
│     └── "Add Discount" button
├── Error display (per-field, keyed by field path)
└── Save button (hidden when !isAdmin)
```

**useReducer state:**
```typescript
type FormState = {
  mode: 'blended' | 'by_role'
  blendedRate: string
  blendedRateUnit: 'hour' | 'day' | 'fixed'
  roles: Array<{ id: string; name: string; unit: 'hour' | 'day' | 'fixed'; rate: string }>
  defaultMarginPct: string   // display as %, stored as fraction: "20" → 0.2
  currency: string
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: string
  warrantyPeriodDays: string
  discounts: Array<{
    id: string
    name: string
    type: 'percentage' | 'fixed'
    value: string
    appliesTo: 'subtotal' | 'total'
    customerIds: string  // comma-separated display; split to array on save
  }>
  loading: boolean
  saving: boolean
  errors: Array<{ field: string; message: string }>
}
```

**On mount:**
- `GET /api/settings/rate-card`
- If null → leave default empty state
- If populated → map API response to form state (convert `defaultMarginPct` decimal to percentage string for display)

**On save:**
- Parse form strings to numbers
- Convert `defaultMarginPct` "20" → `0.2`
- Convert `customerIds` comma-string → string array (filter empty)
- Submit `PATCH /api/settings/rate-card`
- On 422: parse `details` array → store in `errors` state
- On 200: show success state (inline "Saved ✓" message or toast)

**Client-side validation (before PATCH):**
- `by_role` mode: must have at least one role row
- `blendedRate`: must be a valid positive number when mode is blended
- `margin`: must be 0–100 (display %)
- `paymentTermsDays`, `warrantyPeriodDays`: must be non-negative integers

**shadcn/ui components to use:**
- `Input`, `Select`, `Button`, `Card`, `Label` (all already in project)
- `Badge` for mode indicator
- `Separator` between sections

**Admin gating:**
- When `!isAdmin`: all inputs have `disabled` attribute; Save button not rendered

**Acceptance Criteria:**
- [ ] Component renders without console errors
- [ ] Mode toggle switches visible sections
- [ ] Add/remove role rows works
- [ ] Add/remove discount rows works
- [ ] Reorder discounts with up/down buttons (arrow button per row)
- [ ] On mount: GET called and form populated
- [ ] On save: PATCH called with correctly transformed payload
- [ ] Margin displayed as 0-100 in UI but stored as 0-1 in API
- [ ] 422 errors shown per-field
- [ ] Non-admin sees read-only view
- [ ] All 15 tests from Task 4.1 PASS
- [ ] `tsc --noEmit` passes

---

### Task 4.3: Settings Page and Navigation Tab
**Status:** 🟡 Ready (independent of 4.1/4.2)
**Effort:** 0.5h
**Dependencies:** None (can run parallel to 4.1 and 4.2)
**Parallel with:** Tasks 4.1 and 4.2

**Description:**
Two small changes:

**1. Create `src/app/(auth)/settings/rate-card/page.tsx`:**
```typescript
import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { RateCardForm } from '@/components/settings/RateCardForm'

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

**2. Amend `src/app/(auth)/settings/page.tsx`:**
Add `{ label: 'Rate Card', href: '/settings/rate-card' }` to the `tabs` array.

**Acceptance Criteria:**
- [ ] Page file created at correct path
- [ ] Imports `RateCardForm` and passes `isAdmin` prop
- [ ] "Rate Card" tab appears in settings navigation
- [ ] Tab link goes to `/settings/rate-card`
- [ ] `tsc --noEmit` passes

---

## Phase 5: Quality Gates

---

### Task QG.1: TypeScript Check
**Status:** 🔴 Blocked by 4.2, 4.3
**Effort:** 0.25h
**Dependencies:** Tasks 4.2 and 4.3
**Parallel with:** Task QG.2

**Description:**
Run `npx tsc --noEmit` across the full project. Verify zero TypeScript errors in:
- `src/lib/utils/validation.ts` (blendedRateUnit amendment)
- `src/lib/db/schema/tenant-settings.ts` (RateCard interface)
- `src/lib/services/rate-card.ts`
- `src/app/api/settings/rate-card/route.ts`
- `src/components/settings/RateCardForm.tsx`
- `src/app/(auth)/settings/rate-card/page.tsx`

**Acceptance Criteria:**
- [ ] `npx tsc --noEmit` exits with code 0
- [ ] No new TypeScript errors introduced vs. baseline

---

### Task QG.2: Security Review
**Status:** 🔴 Blocked by 3.2
**Effort:** 0.25h
**Dependencies:** Task 3.2
**Parallel with:** Tasks 4.1, 4.2, QG.1

**Description:**
Run `/security-review` on the two security-sensitive files:
- `src/app/api/settings/rate-card/route.ts`
- `src/lib/services/rate-card.ts`

**Focus areas:**
- Auth guard on PATCH (isAdmin)
- `orgId` always from session (never from request body)
- No sensitive pricing values in error messages or logs
- No SQL injection (Drizzle parameterized queries)
- Input validation before DB write

**Acceptance Criteria:**
- [ ] No CRITICAL or HIGH security issues found
- [ ] `orgId` confirmed to come only from `requireAuth()` session
- [ ] PATCH protected by `isAdmin` check
- [ ] No pricing values appear in error response bodies

---

### Task QG.3: Code Review
**Status:** 🔴 Blocked by QG.1, QG.2
**Effort:** 0.5h
**Dependencies:** Tasks QG.1 and QG.2

**Description:**
Run `/code-review` on all 7 new/amended files. Address any CRITICAL or HIGH findings before marking this task complete.

**Files to review:**
1. `src/lib/utils/validation.ts` (amended section)
2. `src/lib/db/schema/tenant-settings.ts` (amended section)
3. `src/lib/services/rate-card.ts`
4. `src/app/api/settings/rate-card/route.ts`
5. `src/components/settings/RateCardForm.tsx`
6. `src/app/(auth)/settings/rate-card/page.tsx`
7. `src/app/(auth)/settings/page.tsx` (amended section)

**Acceptance Criteria:**
- [ ] All CRITICAL issues resolved
- [ ] All HIGH issues resolved (or documented exception with justification)
- [ ] MEDIUM issues reviewed and addressed where practical

---

## Coverage Summary

| Task | Tests Written | Implementation | Story Coverage |
|---|---|---|---|
| 1.1 + 1.2 | 9 validation tests | blendedRateUnit + patch schema | Supporting US-002, US-003, US-004, US-005 |
| 2.1 + 2.2 | 8 service tests | getRateCard + upsertRateCard | Supporting all US |
| 3.1 + 3.2 | 16 route tests | GET + PATCH route | FR-017 to FR-022 (API surface) |
| 4.1 + 4.2 | 15 component tests | RateCardForm | US-001 to US-005 (UI) |
| 4.3 | — | page + nav | US-001 (navigation to rate card) |
| QG.1–QG.3 | — | type check + reviews | NFR-001 to NFR-005 |

**Total test cases across feature: 48**

---

## User Story Coverage Map

| Story | Tasks |
|---|---|
| US-001: View rate card | 4.1, 4.2, 4.3 |
| US-002: Configure blended rate | 1.1, 1.2, 3.1, 3.2, 4.1, 4.2 |
| US-003: Configure by-role rate | 1.1, 1.2, 3.1, 3.2, 4.1, 4.2 |
| US-004: Set pricing defaults | 3.1, 3.2, 4.1, 4.2 |
| US-005: Manage discount rules | 1.1, 1.2, 3.1, 3.2, 4.1, 4.2 |

---

## Dependency Graph

```
1.1 (schema tests)
  └── 1.2 (schema impl)
        └── 2.1 (service tests)
              └── 2.2 (service impl)
                    └── 3.1 (route tests)
                          └── 3.2 (route impl)
                                ├── 4.1 (form tests)
                                │     └── 4.2 (form impl)
                                │           └── QG.1 (tsc) ─────────┐
                                ├── QG.2 (security review) ──────────┤
                                └── 4.3 (page + nav) [parallel] ─────┤
                                                                      └── QG.3 (code review)
```

**Parallelization:**
- Task 4.3 is independent of 4.1/4.2 (different files) — start 4.3 when 3.2 is done
- QG.2 can start when 3.2 is done (route handler is the security-sensitive code)
- QG.1 requires all implementation complete
- QG.3 requires both QG.1 and QG.2 to complete first
