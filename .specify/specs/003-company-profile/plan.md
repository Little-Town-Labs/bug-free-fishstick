# Implementation Plan — 003-company-profile

**Feature:** Company Profile
**Branch:** 003-company-profile
**Spec:** `.specify/specs/003-company-profile/spec.md`
**Data Model:** `.specify/specs/003-company-profile/data-model.md`
**API Contract:** `.specify/specs/003-company-profile/contracts/company-profile-api.yaml`
**Research:** `.specify/specs/003-company-profile/research.md`

---

## Executive Summary

Build a settings UI and API for managing an organization's markdown company profile. The `company_profile` column already exists in `tenant_settings` (added in F1). This feature adds:
1. A dedicated API route (`GET`/`PATCH /api/settings/company-profile`)
2. A service module (`src/lib/services/company-profile.ts`)
3. A validation schema (`updateCompanyProfileSchema`)
4. A React form component with live markdown preview (`CompanyProfileForm`)
5. A settings page route and navigation tab

Total implementation scope: ~5 files, no database migration needed.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Settings Page (/settings/company-profile)              │
│  └── CompanyProfileForm (React 19)                      │
│       ├── GET /api/settings/company-profile  (mount)    │
│       ├── Textarea (admin only)                         │
│       ├── react-markdown preview (live)                 │
│       └── PATCH /api/settings/company-profile (save)   │
├─────────────────────────────────────────────────────────┤
│  API Route (Next.js App Router)                         │
│  src/app/api/settings/company-profile/route.ts          │
│  ├── GET  → requireAuth()  → getCompanyProfile(orgId)   │
│  └── PATCH → requireAdmin() → upsertCompanyProfile()    │
├─────────────────────────────────────────────────────────┤
│  Service Layer                                          │
│  src/lib/services/company-profile.ts                    │
│  ├── getCompanyProfile(orgId)                           │
│  └── upsertCompanyProfile(orgId, text)                  │
├─────────────────────────────────────────────────────────┤
│  Database (Neon PostgreSQL)                             │
│  tenant_settings.company_profile  (TEXT, nullable)      │
│  Keyed by organization_id (tenant isolation)            │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

All choices reuse existing project dependencies except one new package:

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 App Router | Existing — route handler pattern established |
| Auth | Clerk (`requireAuth`, `requireAdmin`) | Existing — consistent with all settings routes |
| ORM | Drizzle ORM | Existing — `onConflictDoUpdate` pattern from F2 |
| Validation | Zod | Existing — dedicated schema per endpoint |
| UI | shadcn/ui (Card, Textarea, Button, Label) | Existing components |
| Markdown preview | `react-markdown` (NEW) | Safe-by-default HTML rendering; no XSS risk |
| Tests | Vitest + MSW | Existing setup |

**New dependency:** `react-markdown`
```bash
npm install react-markdown
```

---

## Technical Decisions

### TD-1: GET Auth — `requireAuth()` not `requireAdmin()`

GET uses `requireAuth()` (any authenticated org member), not `requireAdmin()`. This is intentional and different from the rate-card endpoint, where the GET was admin-gated because pricing data is sensitive. Company profile is organizational identity content that all members benefit from seeing (US4: non-admin read transparency).

**Key:** This is the spec intent (FR-4). Do not replicate the rate-card admin-GET pattern here.

### TD-2: Upsert pattern from F2

`upsertCompanyProfile` uses `insert().onConflictDoUpdate()` with explicit `createdAt: new Date()` on the insert path, matching the `upsertRateCard` implementation. This prevents a `NOT NULL` constraint violation if no row exists yet for the organization.

### TD-3: `react-markdown` over `marked`

See `research.md` Decision 1. `react-markdown` is chosen for safe-by-default output (no `dangerouslySetInnerHTML`) and idiomatic React element output.

### TD-4: Single component — no sub-components

`CompanyProfileForm` is a single-file component (~250 LOC). Unlike `RateCardForm` which requires mode-switching sub-components, the profile form is a textarea + preview + save button. No sub-component extraction needed.

### TD-5: `useState` not `useReducer`

Six independent state variables. No complex interdependencies or mode transitions. See `research.md` Decision 2.

---

## Implementation Phases

### Phase 1: Validation & Service Layer (backend foundation)

**Files:**
- `src/lib/utils/validation.ts` — add `updateCompanyProfileSchema`
- `src/lib/services/company-profile.ts` — new file

**Tasks:**
1. Add `updateCompanyProfileSchema` to `validation.ts`:
   ```typescript
   export const updateCompanyProfileSchema = z.object({
     companyProfile: z.string().max(10000).nullable(),
   })
   export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>
   ```
2. Create `src/lib/services/company-profile.ts` with:
   - `getCompanyProfile(orgId: string): Promise<{ companyProfile: string | null }>`
   - `upsertCompanyProfile(orgId: string, companyProfile: string | null): Promise<void>`

**Tests (write first):**
- `tests/unit/services/company-profile.test.ts`
  - `getCompanyProfile` returns `{ companyProfile: null }` when no row exists
  - `getCompanyProfile` returns saved text when row exists
  - `upsertCompanyProfile` inserts a new row
  - `upsertCompanyProfile` updates an existing row (idempotent)

### Phase 2: API Route

**Files:**
- `src/app/api/settings/company-profile/route.ts` — new file

**Tasks:**
1. Implement `GET` handler:
   - `requireAuth()` → 401/500 on failure
   - `getCompanyProfile(auth.orgId)` → `NextResponse.json({ companyProfile })`
2. Implement `PATCH` handler:
   - `requireAdmin()` → 401/403/500 on failure
   - Inner try/catch around `request.json()` → 400 on malformed JSON
   - `updateCompanyProfileSchema.safeParse(body)` → 422 with details on failure
   - `upsertCompanyProfile(auth.orgId, parsed.data.companyProfile)` → 200 `{ success: true }`

**Tests (write first):**
- `tests/unit/api/company-profile-settings.test.ts` — mirrors `rate-card-settings.test.ts` structure:
  - GET: 401 unauthenticated, 200 with profile, 200 with null, tenant isolation check
  - PATCH: 401, 403 non-admin, 400 malformed JSON, 422 length exceeded, 200 success, tenant isolation check

### Phase 3: React Component

**Files:**
- `src/components/settings/CompanyProfileForm.tsx` — new file
- `src/components/settings/CompanyProfileForm.test.tsx` — new file

**Tasks:**
1. Install `react-markdown`: `npm install react-markdown`
2. Implement `CompanyProfileForm` with:
   - `isAdmin: boolean` prop
   - `useState` for: `profile`, `loading`, `saving`, `saveSuccess`, `error`, `fieldErrors`
   - `useEffect` mount: `GET /api/settings/company-profile` → set `profile` state
   - Side-by-side layout: editor (60%) + preview (40%), stacked on mobile
   - Textarea: `disabled={!isAdmin}`, `aria-describedby="profile-count"`
   - Character counter: `{profile.length} / 10000`, id="profile-count"
   - `<ReactMarkdown>` preview pane (live, updates on keystroke)
   - Preview placeholder when `profile` is empty: "Preview will appear here"
   - Save button: `disabled={saving || !isAdmin}`, label "Saving…" during request
   - Success message: `role="status"`, auto-clears after 3 seconds
   - Error message: `role="alert"`
   - Non-admin read-only message when `!isAdmin`
3. Implement `handleSave`:
   - Client-side pre-validation: `profile.length > 10000` → `setFieldErrors`
   - `PATCH /api/settings/company-profile` with `{ companyProfile: profile || null }`
   - On 422: `setFieldErrors(body.details)`
   - On other error: `setError(body.error)`
   - On network failure: `setError('Network error. Please try again.')`
   - Retain `profile` value in textarea on any failure

**Tests (write first, 30+ cases):**
- See `research.md` / component plan for full test case list
- Use MSW pattern from `RateCardForm.test.tsx`
- Cover: render, loading, populated fetch, character counter, admin gating, save success, 422/500/network errors, markdown preview, accessibility attributes

### Phase 4: Settings Page & Navigation

**Files:**
- `src/app/(auth)/settings/company-profile/page.tsx` — new file
- `src/app/(auth)/settings/page.tsx` — add navigation tab

**Tasks:**
1. Create `src/app/(auth)/settings/company-profile/page.tsx` — async server component:
   - Use `auth()` from Clerk to get `orgRole`
   - Pass `isAdmin={orgRole === 'org:admin'}` to `<CompanyProfileForm />`
2. Add "Company Profile" tab to settings navigation in `settings/page.tsx`

---

## File Inventory

| File | Status | Notes |
|------|--------|-------|
| `src/lib/utils/validation.ts` | Modify | Add `updateCompanyProfileSchema` |
| `src/lib/services/company-profile.ts` | Create | `getCompanyProfile`, `upsertCompanyProfile` |
| `src/app/api/settings/company-profile/route.ts` | Create | GET + PATCH handlers |
| `src/components/settings/CompanyProfileForm.tsx` | Create | UI form with preview |
| `src/components/settings/CompanyProfileForm.test.tsx` | Create | 30+ tests |
| `src/app/(auth)/settings/company-profile/page.tsx` | Create | Page wrapper |
| `src/app/(auth)/settings/page.tsx` | Modify | Add navigation tab |
| `tests/unit/api/company-profile-settings.test.ts` | Create | API route tests |
| `tests/unit/services/company-profile.test.ts` | Create | Service unit tests |

**No migration file required** — `company_profile` column exists in `drizzle/0008_proposal_bid_engine.sql`.

---

## Testing Strategy

**Target:** 80%+ coverage (constitution Principle V)

| Layer | Test Type | File |
|-------|-----------|------|
| Validation schema | Unit | Inline in service tests |
| Service functions | Unit (mocked DB) | `tests/unit/services/company-profile.test.ts` |
| API route | Unit (mocked service) | `tests/unit/api/company-profile-settings.test.ts` |
| React component | Component (MSW) | `src/components/settings/CompanyProfileForm.test.tsx` |

**Key test scenarios:**
- Tenant isolation: service and API tests verify `orgId` is always passed
- Auth boundary: GET 401, PATCH 401/403
- Validation boundary: 422 on >10000 chars
- Edge cases: null profile, empty string profile, save failure retains content
- Accessibility: `aria-describedby`, `role="alert"`, `role="status"`

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Unauthorized read | `requireAuth()` on GET |
| Unauthorized write | `requireAdmin()` on PATCH |
| Payload injection | Zod validation gates all writes |
| XSS in preview | `react-markdown` renders safe React elements (no `dangerouslySetInnerHTML`) |
| Profile content stored verbatim | Spec FR-3: no server-side sanitization; rendering is the client's concern |
| Oversized payloads | Zod `max(10000)` rejects before DB write |
| Tenant cross-contamination | All queries scoped by `organizationId` from Clerk session |

---

## Constitutional Compliance

- **[I] Tenant Isolation:** All service functions require `orgId`; no cross-tenant access
- **[II] Type Safety:** TypeScript strict mode; `UpdateCompanyProfileInput` type exported from schema
- **[IV] Secure by Default:** `requireAdmin()` enforced on PATCH; `requireAuth()` on GET
- **[V] 80% Coverage:** 30+ component tests + API route tests + service tests
- **[XVI] Graceful Degradation:** Empty/null profile renders empty textarea (not error state); proposal pipeline omits section cleanly

---

## Implementation Order (Dependencies)

```
Phase 1 (service + validation)
    ↓
Phase 2 (API route — depends on service)
    ↓
Phase 3 (component — depends on API route)
    ↓
Phase 4 (page + nav — depends on component)
```

No parallelization opportunities — each phase depends on the previous.
