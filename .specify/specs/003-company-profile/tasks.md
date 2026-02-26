# Task Breakdown — 003-company-profile

**Feature:** Company Profile
**Branch:** 003-company-profile
**Plan:** `.specify/specs/003-company-profile/plan.md`
**Created:** 2026-02-25

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 13 |
| Phases | 4 + 1 quality gate phase |
| Estimated Effort | ~14 hours |
| Critical Path | 1.1 → 1.3 → 2.2 → QG.1 → 3.2 → QG.2 → 4.2 → QG.3 |
| Parallelization | Tasks 1.1 and 1.2 can run in parallel (both are 🟡 Ready with no dependencies) |

---

## Critical Path

```
Phase 1 (parallel start):
  1.1 (schema) ─────────────────────────────────────────────────────────┐
  1.2 (service tests) → 1.3 (service impl)                              │
                              │                                          │
                              ▼                                          ▼
Phase 2:               2.1 (route tests) ← requires 1.1 ─→ 2.2 (route impl)
                                                                    │
                                                                    ▼
                                                             QG.1 (security review)
                                                                    │
                                                                    ▼
Phase 3:                                        3.0 (install react-markdown)
                                                        │
                                                        ▼
                                               3.1 (component tests) → 3.2 (component impl)
                                                                               │
                                                                               ▼
                                                                        QG.2 (code review)
                                                                               │
                                                                               ▼
Phase 4:                                                            4.1 (page route) → 4.2 (nav tab)
                                                                                               │
                                                                                               ▼
                                                                                        QG.3 (full suite)
```

---

## Phase 1: Validation Schema & Service Layer

> Foundation for all subsequent phases. No new migration needed.

---

### Task 1.1: Add `updateCompanyProfileSchema` to validation.ts
**Status:** 🟡 Ready
**Effort:** 0.5h
**Dependencies:** None
**Parallel with:** Task 1.2 (service tests have no dependency on the schema)

**Description:**
Add a dedicated Zod schema for the company-profile PATCH endpoint. `companyProfile` already exists in `updateTenantSettingsSchema` as `.nullable().optional()`. This task adds a purpose-built schema with `.nullable()` only (no `.optional()` — null explicitly clears the profile) used exclusively by the company-profile route.

**Files:**
- `src/lib/utils/validation.ts`

**Implementation:**
```typescript
export const updateCompanyProfileSchema = z.object({
  companyProfile: z.string().max(10000).nullable(),
})
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>
```

**Acceptance Criteria:**
- [ ] `updateCompanyProfileSchema` exported from `validation.ts`
- [ ] `UpdateCompanyProfileInput` type exported
- [ ] Schema accepts `string` values up to 10,000 characters
- [ ] Schema accepts `null` (clears profile)
- [ ] Schema accepts `""` (empty string — valid)
- [ ] Schema rejects strings > 10,000 characters
- [ ] Schema does NOT accept `undefined` (unlike `updateTenantSettingsSchema` which uses `.optional()`)
- [ ] TypeScript compilation clean after change

---

### Task 1.2: Company Profile Service — Tests (TDD: write first)
**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None (can be written before implementation exists — tests will FAIL)
**Parallel with:** Task 1.1

**Description:**
Write unit tests for `getCompanyProfile` and `upsertCompanyProfile` service functions. Follow the `tests/unit/services/rate-card.test.ts` pattern: mock Drizzle DB with `vi.mock`, test all return paths.

**Files:**
- `tests/unit/services/company-profile.test.ts` (new)

**Test Cases to Write:**
```
getCompanyProfile:
  - returns { companyProfile: null } when no row exists for the org
  - returns { companyProfile: 'some text' } when row exists with value
  - returns { companyProfile: null } when row exists but column is null
  - calls DB with correct organizationId (tenant isolation check)

upsertCompanyProfile:
  - calls insert with organizationId, companyProfile, createdAt, updatedAt
  - calls onConflictDoUpdate targeting organizationId
  - sets updatedAt on conflict update path
  - accepts null (clear profile)
  - accepts empty string
```

**Acceptance Criteria:**
- [ ] All test cases written
- [ ] Tests confirmed to **FAIL** (service file does not exist yet)
- [ ] No TypeScript compilation errors in test file itself
- [ ] Drizzle DB mocked via `vi.mock('@/lib/db')`

---

### Task 1.3: Company Profile Service — Implementation
**Status:** 🔴 Blocked by Task 1.2
**Effort:** 1h
**Dependencies:** Task 1.2 (tests written and confirmed failing)

**Description:**
Create `src/lib/services/company-profile.ts`. Follow `src/lib/services/rate-card.ts` as the reference pattern for Drizzle upsert with explicit `createdAt`.

**Files:**
- `src/lib/services/company-profile.ts` (new)

**Implementation shape:**
```typescript
export async function getCompanyProfile(orgId: string): Promise<{ companyProfile: string | null }> {
  const [row] = await db
    .select({ companyProfile: tenantSettings.companyProfile })
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, orgId))
  return { companyProfile: row?.companyProfile ?? null }
}

export async function upsertCompanyProfile(
  orgId: string,
  companyProfile: string | null
): Promise<void> {
  await db
    .insert(tenantSettings)
    .values({
      organizationId: orgId,
      companyProfile,
      createdAt: new Date(),   // explicit — prevents NOT NULL violation
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenantSettings.organizationId,
      set: { companyProfile, updatedAt: new Date() },
    })
}
```

**Acceptance Criteria:**
- [ ] All tests from Task 1.2 pass
- [ ] `getCompanyProfile` returns `{ companyProfile: null }` when no row found
- [ ] `upsertCompanyProfile` uses explicit `createdAt: new Date()` on insert path
- [ ] Both functions scope queries by `organizationId` (tenant isolation)
- [ ] TypeScript compilation clean

---

## Phase 2: API Route

> Depends on Phase 1 service + schema being complete.

---

### Task 2.1: Company Profile API Route — Tests (TDD: write first)
**Status:** 🔴 Blocked by Task 1.1 (schema must exist for test imports)
**Effort:** 1.5h
**Dependencies:** Task 1.1

**Description:**
Write unit tests for `GET` and `PATCH /api/settings/company-profile`. Mirror the structure of `tests/unit/api/rate-card-settings.test.ts` exactly: mock auth utilities and service layer, test all HTTP status codes.

**Files:**
- `tests/unit/api/company-profile-settings.test.ts` (new)

**Test Cases to Write:**
```
GET /api/settings/company-profile:
  - returns 401 when unauthenticated (requireAuth rejects)
  - returns 500 on unexpected server error
  - returns { companyProfile: null } when no profile saved
  - returns { companyProfile: 'text' } when profile exists
  - calls getCompanyProfile with orgId from session (tenant isolation)

PATCH /api/settings/company-profile:
  - returns 401 when unauthenticated
  - returns 403 when authenticated non-admin
  - returns 400 for malformed JSON body
  - returns 422 with details array when companyProfile exceeds 10000 chars
  - returns 422 with details array when body has extra unknown keys
  - returns 200 { success: true } for valid profile text
  - returns 200 { success: true } when companyProfile is null (clear)
  - returns 200 { success: true } when companyProfile is "" (empty string)
  - calls upsertCompanyProfile with orgId from session (tenant isolation)
  - does NOT call upsertCompanyProfile when validation fails
```

**Mock setup:**
```typescript
vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  AuthError: class AuthError extends Error { ... },
}))
vi.mock('@/lib/services/company-profile', () => ({
  getCompanyProfile: vi.fn(),
  upsertCompanyProfile: vi.fn(),
}))
```

**Acceptance Criteria:**
- [ ] All 10 test cases written
- [ ] Tests confirmed to **FAIL** (route file does not exist yet)
- [ ] `requireAuth` mock used for GET tests, `requireAdmin` mock for PATCH tests
- [ ] No TypeScript compilation errors in test file

---

### Task 2.2: Company Profile API Route — Implementation
**Status:** 🔴 Blocked by Task 2.1, Task 1.3
**Effort:** 1h
**Dependencies:** Task 2.1 (tests failing), Task 1.3 (service implemented)

**Description:**
Create `src/app/api/settings/company-profile/route.ts`. Follow `src/app/api/settings/rate-card/route.ts` exactly — same error handling shape, same auth pattern, same JSON parse error handling.

**Key difference from rate-card:** GET uses `requireAuth()` (not `requireAdmin()`) — company profile is readable by all authenticated org members per FR-4.

**Files:**
- `src/app/api/settings/company-profile/route.ts` (new)

**Implementation shape:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin, AuthError } from '@/lib/utils/auth'
import { getCompanyProfile, upsertCompanyProfile } from '@/lib/services/company-profile'
import { updateCompanyProfileSchema } from '@/lib/utils/validation'

export async function GET() {
  try {
    const auth = await requireAuth()
    const result = await getCompanyProfile(auth.orgId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[GET /api/settings/company-profile]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = updateCompanyProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
      }, { status: 422 })
    }
    await upsertCompanyProfile(auth.orgId, parsed.data.companyProfile)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[PATCH /api/settings/company-profile]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Acceptance Criteria:**
- [ ] All tests from Task 2.1 pass
- [ ] GET uses `requireAuth()` (not `requireAdmin()`)
- [ ] PATCH uses `requireAdmin()`
- [ ] `request.json()` wrapped in inner try/catch returning HTTP 400
- [ ] 422 response includes `details` array with `{ field, message }` objects
- [ ] Both handlers have `console.error` logging on unexpected errors
- [ ] TypeScript compilation clean

---

### Task QG.1: Security Review (Phase 2 gate)
**Status:** 🔴 Blocked by Task 2.2
**Effort:** 0.5h
**Dependencies:** Task 2.2

**Description:**
Run `/security-review` on the new API route and service. Focus on auth boundary correctness, tenant isolation, and validation completeness.

**Files to review:**
- `src/app/api/settings/company-profile/route.ts`
- `src/lib/services/company-profile.ts`
- `src/lib/utils/validation.ts` (new schema section)

**Acceptance Criteria:**
- [ ] Auth boundary verified: GET = auth, PATCH = admin
- [ ] No hardcoded secrets
- [ ] Tenant isolation confirmed (orgId always from session, never from request body)
- [ ] All CRITICAL and HIGH issues resolved
- [ ] Validation prevents oversized payloads reaching the DB

---

## Phase 3: React Component

> Depends on the API route being implemented. Requires `react-markdown` package.

---

### Task 3.0: Install `react-markdown`
**Status:** 🔴 Blocked by Task 2.2
**Effort:** 0.25h
**Dependencies:** Task 2.2 (install after route is verified, before component work begins)

**Description:**
Add `react-markdown` to project dependencies. This is the only new npm package for this feature.

**Command:**
```bash
npm install react-markdown
```

**Acceptance Criteria:**
- [ ] `react-markdown` appears in `package.json` dependencies
- [ ] `package-lock.json` updated
- [ ] TypeScript can import `import ReactMarkdown from 'react-markdown'` without error

---

### Task 3.1: `CompanyProfileForm` Component — Tests (TDD: write first)
**Status:** 🔴 Blocked by Task 3.0
**Effort:** 2h
**Dependencies:** Task 3.0

**Description:**
Write comprehensive tests for `CompanyProfileForm`. Follow `src/components/settings/RateCardForm.test.tsx` for MSW mock setup pattern. Tests must cover all 7 categories from the component plan.

**Files:**
- `src/components/settings/CompanyProfileForm.test.tsx` (new)

**Test categories and cases:**

*7.1 Render Tests (7 cases):*
- Shows loading state on mount before fetch resolves
- Renders textarea populated with content from GET response
- Shows empty textarea when GET returns null
- Shows placeholder "Preview will appear here" when profile is empty
- Textarea is disabled when `isAdmin={false}`
- Save button is not visible/disabled when `isAdmin={false}`
- Non-admin sees read-only message when profile is null

*7.2 Character Counter Tests (3 cases):*
- Shows "0 / 10000" when profile is empty
- Counter increments as user types
- Shows correct count after populated fetch

*7.3 Admin Gating Tests (4 cases):*
- Non-admin cannot interact with textarea
- Non-admin cannot submit Save
- Admin sees enabled textarea and Save button
- Admin can type and change profile text

*7.4 Save Tests (8 cases):*
- Clicking Save calls PATCH with `{ companyProfile: string }`
- Save button shows "Saving…" and is disabled during in-flight request
- Shows success message on 200 OK
- Success message disappears after ~3 seconds (vi.useFakeTimers)
- Shows field error on 422 with details
- Shows general error message on 500
- Shows "Network error" message when fetch throws
- Unsaved content retained in textarea after failed save

*7.5 Markdown Preview Tests (4 cases):*
- Preview updates live as user types
- Preview shows placeholder when profile is empty
- Preview renders `**bold**` as `<strong>`
- Preview renders `# Heading` as heading element

*7.6 Edge Case Tests (4 cases):*
- Can save a profile of exactly 10,000 characters
- Cannot save a profile of 10,001 characters (client-side validation error before fetch)
- Can save empty profile (clears existing)
- PATCH returns 401 (session expiry, EC-7): error message shown, textarea content is retained (not cleared)

*7.7 Accessibility Tests (5 cases):*
- Textarea has accessible label
- Character count element has `id="profile-count"`
- Textarea has `aria-describedby="profile-count"`
- Error message has `role="alert"`
- Success message has `role="status"`

**MSW setup (follow RateCardForm.test.tsx pattern):**
```typescript
server.use(
  http.get('/api/settings/company-profile', () =>
    HttpResponse.json({ companyProfile: 'My company...' })
  ),
  http.patch('/api/settings/company-profile', () =>
    HttpResponse.json({ success: true })
  )
)
```

**Acceptance Criteria:**
- [ ] All 35 test cases written across 7 categories (34 original + EC-7 session expiry test)
- [ ] Tests confirmed to **FAIL** (component does not exist yet)
- [ ] MSW server handlers set up correctly
- [ ] `vi.useFakeTimers()` used for success message auto-clear test
- [ ] No TypeScript compilation errors in test file

---

### Task 3.2: `CompanyProfileForm` Component — Implementation
**Status:** 🔴 Blocked by Task 3.1
**Effort:** 2.5h
**Dependencies:** Task 3.1 (tests written and confirmed failing)

**Description:**
Implement `src/components/settings/CompanyProfileForm.tsx` as a single-file component (~250 LOC). No sub-components needed. Use `useState` (not `useReducer`). Use `react-markdown` for live preview.

**Files:**
- `src/components/settings/CompanyProfileForm.tsx` (new)

**State interface:**
```typescript
const [profile, setProfile] = useState<string>('')
const [loading, setLoading] = useState<boolean>(true)
const [saving, setSaving] = useState<boolean>(false)
const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
const [error, setError] = useState<string | null>(null)
const [fieldErrors, setFieldErrors] = useState<Array<{ field: string; message: string }>>([])
```

**Layout (side-by-side on desktop, stacked on mobile):**
```tsx
<div className="grid gap-4 md:grid-cols-[3fr_2fr]">
  <div>
    <Label htmlFor="profile-input">Company Profile</Label>
    <Textarea
      id="profile-input"
      aria-describedby="profile-count"
      disabled={!isAdmin}
      value={profile}
      onChange={(e) => setProfile(e.target.value)}
      rows={12}
      placeholder="Write your organization's profile in markdown..."
    />
    <div id="profile-count" className="text-xs text-muted-foreground mt-1">
      {profile.length} / 10000
    </div>
  </div>
  <div>
    <div className="text-sm font-medium mb-2">Preview</div>
    {profile ? (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{profile}</ReactMarkdown>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground italic">Preview will appear here</p>
    )}
  </div>
</div>
```

**Save handler rules:**
- Client-side: if `profile.length > 10000`, set `fieldErrors` and return early (no fetch)
- Send `{ companyProfile: profile.trim() === '' ? null : profile }` — per spec EC-8, whitespace-only treated as empty by pipeline, but we preserve it as stored (no auto-trim)
- Actually per spec: "The implementation may trim but is not required to" — send as-is: `{ companyProfile: profile || null }`
- On 422: `setFieldErrors(body.details ?? [])`
- On non-422 error: `setError(body.error ?? 'Save failed')`
- On fetch throw: `setError('Network error. Please try again.')`
- Never clear `profile` on failure (user can retry)

**Accessibility requirements:**
- `<Label htmlFor="profile-input">` → links label to textarea
- `aria-describedby="profile-count"` on textarea
- Error container: `role="alert"` (announced immediately by screen readers)
- Success container: `role="status"` (announced politely)
- Save button keyboard-accessible (default `<Button>` behavior)

**Acceptance Criteria:**
- [ ] All 35 tests from Task 3.1 pass
- [ ] `react-markdown` used for preview (not `dangerouslySetInnerHTML`)
- [ ] Loading state shown during initial fetch
- [ ] `aria-describedby="profile-count"` on textarea
- [ ] `role="alert"` on error container
- [ ] `role="status"` on success container
- [ ] Save button disabled during in-flight PATCH
- [ ] Profile text retained in textarea on save failure
- [ ] TypeScript strict mode — no `any` types
- [ ] Component < 300 LOC

---

### Task QG.2: Code Review (Phase 3 gate)
**Status:** 🔴 Blocked by Task 3.2
**Effort:** 0.5h
**Dependencies:** Task 3.2

**Description:**
Run `/code-review` on the component and review for React patterns, accessibility, and type safety.

**Files to review:**
- `src/components/settings/CompanyProfileForm.tsx`
- `src/components/settings/CompanyProfileForm.test.tsx`

**Acceptance Criteria:**
- [ ] All CRITICAL and HIGH issues resolved
- [ ] No `any` types introduced
- [ ] No mutation of state objects
- [ ] No `console.log` statements left in component

---

## Phase 4: Settings Page & Navigation

> Depends on the component being complete. Thin wiring layer.

---

### Task 4.1: Create Settings Page Route
**Status:** 🔴 Blocked by Task 3.2
**Effort:** 0.5h
**Dependencies:** Task 3.2

**Description:**
Create the Next.js page that hosts `CompanyProfileForm`. Follows the same pattern as `src/app/(auth)/settings/rate-card/page.tsx` — async server component, reads Clerk auth to determine admin status.

**Files:**
- `src/app/(auth)/settings/company-profile/page.tsx` (new)

**Implementation shape:**
```typescript
import { auth } from '@clerk/nextjs/server'
import { CompanyProfileForm } from '@/components/settings/CompanyProfileForm'

export default async function CompanyProfilePage() {
  const { orgRole } = await auth()
  const isAdmin = orgRole === 'org:admin'
  return <CompanyProfileForm isAdmin={isAdmin} />
}
```

**Acceptance Criteria:**
- [ ] Page renders `CompanyProfileForm` with `isAdmin` derived from Clerk session
- [ ] Page accessible at route `/settings/company-profile`
- [ ] TypeScript compilation clean
- [ ] No client-side auth logic in the page component (Clerk handled server-side)

---

### Task 4.2: Add Company Profile Navigation Tab
**Status:** 🔴 Blocked by Task 4.1
**Effort:** 0.5h
**Dependencies:** Task 4.1

**Description:**
Add "Company Profile" to the settings navigation so users can reach the new page. Read `src/app/(auth)/settings/page.tsx` first to understand the existing tab/nav structure, then add the new entry following the same pattern used for Rate Card.

**Files:**
- `src/app/(auth)/settings/page.tsx` (modify)

**Acceptance Criteria:**
- [ ] "Company Profile" link/tab appears in settings navigation
- [ ] Link routes to `/settings/company-profile`
- [ ] Visually consistent with existing navigation tabs (Rate Card, etc.)
- [ ] TypeScript compilation clean

---

### Task QG.3: Full Test Suite Verification
**Status:** 🔴 Blocked by Task 4.2
**Effort:** 0.5h
**Dependencies:** All preceding tasks

**Description:**
Run the full test suite to confirm no regressions and that all new tests pass.

> **Note on E2E / pipeline integration (Constitution VII):** The spec success metric "Empty profile does not cause proposal generation errors (verified by pipeline tests)" is explicitly deferred to Feature 8 (Revised Proposal Pipeline), which reads the saved profile and injects it as supplier context. F3's responsibility ends at the API boundary. No E2E pipeline test is required here.

**Command:**
```bash
npx vitest run
```

**Acceptance Criteria:**
- [ ] All pre-existing tests continue to pass (no regressions)
- [ ] All new tests pass:
  - `tests/unit/services/company-profile.test.ts`
  - `tests/unit/api/company-profile-settings.test.ts`
  - `src/components/settings/CompanyProfileForm.test.tsx`
- [ ] TypeScript compilation clean (`tsc --noEmit`)
- [ ] New test coverage ≥ 80% for all new files

---

## Task Status Legend

| Symbol | Meaning |
|--------|---------|
| 🟡 Ready | No blocking dependencies — can start immediately |
| 🔴 Blocked | Waiting on dependency completion |
| 🟢 In Progress | Currently being worked |
| ✅ Complete | Done and verified |

---

## Spec → Task Traceability

| Spec Requirement | Tasks |
|-----------------|-------|
| FR-1 Tenant isolation | 1.2, 1.3, 2.1, 2.2 |
| FR-2 10,000 char limit | 1.1, 2.1, 2.2, 3.1, 3.2 |
| FR-3 Markdown input | 3.1, 3.2 |
| FR-4 Admin-write / auth-read | 2.1, 2.2, QG.1 |
| FR-5 Graceful empty state | 1.3, 3.1, 3.2 |
| FR-6 Settings navigation | 4.2 |
| FR-7 Immediate effect | 1.3 (upsert replaces value instantly) |
| FR-8 API availability | 2.1, 2.2 |
| US1 Write/maintain profile | 3.1, 3.2, 4.1, 4.2 |
| US2 Live markdown preview | 3.0, 3.1, 3.2 |
| US3 Clear profile | 1.1, 2.2, 3.1 |
| US4 Non-admin read-only view | 2.2, 3.1, 3.2 |
| EC-2 Save in-flight guard | 3.1, 3.2 |
| EC-3 Network failure | 3.1, 3.2 |
| EC-7 Session expiry on save | 2.2 (401 returned), 3.1 |
| Accessibility NFR | 3.1, 3.2 |
