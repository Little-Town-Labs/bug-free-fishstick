# Task Breakdown — 004-proposal-template-library

**Branch:** `004-proposal-template-library`
**Plan:** `.specify/specs/004-proposal-template-library/plan.md`
**Created:** 2026-02-26
**Status:** Ready for implementation

---

## Summary

| Metric | Value |
|---|---|
| Total Tasks | 13 |
| Phases | 4 |
| Estimated Effort | ~23 hours |
| Critical Path Duration | ~16 hours (with parallelization) |
| TDD pairs | 5 test → implementation pairs |
| Quality gates | 2 (security review, code review) |

---

## Critical Path

```
1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.3 → 3.4 → 3.5 → 4.1
```

**Total on critical path:** ~16 hours

---

## Parallelization Opportunities

- **Tasks 1.1 and 1.3** can start simultaneously (service tests and Zod schema tests are independent)
- **Tasks 1.3/1.4** can complete before 1.2 finishes (Zod schemas don't depend on service layer)
- **Task 3.1** (reducer tests) can start as soon as `ProposalTemplate` type is available (after 1.2)
- **Tasks 3.1/3.2** run in parallel with task 2.3 (security review)

---

## Phase 1: Service Layer & Validation Schemas

> Both sub-tracks (1.1/1.2 and 1.3/1.4) can run in parallel. Service layer (1.1/1.2) is on the critical path.

---

### Task 1.1: Service Layer — Tests
**Status:** 🟡 Ready
**Effort:** 2 hours
**Dependencies:** None (schema types from F1 already available)
**Parallel with:** Task 1.3

**Description:**
Write the full unit test suite for `src/lib/services/proposalTemplates.ts` using TDD red-phase. Tests must fail before the implementation exists.

Mock `@/lib/db` following the pattern in `tests/unit/services/proposal-draft.test.ts` and `tests/unit/services/rate-card.test.ts`.

**File:** `tests/unit/services/proposalTemplates.test.ts`

**Acceptance Criteria:**
- [ ] `listProposalTemplates`: returns flat sorted array; returns empty array for org with no templates; only returns own org's templates (tenant isolation)
- [ ] `createProposalTemplate`: inserts correct field values; injects `createdBy` from parameter (not from request); auto-assigns `sortOrder` as max+1 within section; returns created template
- [ ] `updateProposalTemplate`: updates only supplied fields; always sets `updatedAt: new Date()`; returns `null` for unknown id/org combination; enforces merged-state `isRequired && evaluateCoverage` constraint (returns error when merged result violates it)
- [ ] `deleteProposalTemplate`: returns `true` on successful delete; returns `false` when no row matches org+id
- [ ] `reorderProposalTemplates`: calls transaction; applies all sort orders; throws `'INVALID_IDS'` if any id does not belong to org; no partial updates on failure
- [ ] `fetchTemplatesForPipeline`: returns required templates (isRequired=true); returns situational templates matching rfpType; returns situational templates matching any industryTag; OR logic (rfpType OR industryTag match is sufficient); does not return templates that match neither condition
- [ ] `listProposalTemplatesBySection`: returns grouped object with all 8 sections as keys; sections with no templates have empty arrays; same data as flat list
- [ ] All tests confirmed to FAIL (no implementation file exists yet)

---

### Task 1.2: Service Layer — Implementation
**Status:** 🔴 Blocked by Task 1.1
**Effort:** 2 hours
**Dependencies:** Task 1.1

**Description:**
Implement `src/lib/services/proposalTemplates.ts` to pass all tests from Task 1.1.

**Key implementation notes from plan.md:**
- Import `db` from `@/lib/db`; import schema types from `@/lib/db/schema`
- `updatedAt: new Date()` must be passed explicitly in every `.set()` call (schema has no `.$onUpdate()`)
- `listProposalTemplatesBySection`: calls `listProposalTemplates` internally; groups with manual reduce (Node 18 compatibility — no `Object.groupBy`)
- `reorderProposalTemplates`: full `db.transaction(async tx => {...})` pattern; validate all IDs in one SELECT before updating; throw on any mismatch
- `fetchTemplatesForPipeline`: use raw `sql` tagged template for JSONB `@>` / `&&` operators
- `createProposalTemplate`: `SELECT MAX(sort_order) ... FOR UPDATE` then `INSERT` inside a transaction for race-condition safety
- `updateProposalTemplate`: read-merge-validate — fetch existing row, merge patch, check `isRequired && evaluateCoverage` on merged result, then update

**Acceptance Criteria:**
- [ ] All tests from Task 1.1 pass
- [ ] No `any` types used
- [ ] `organizationId` never accepted from function caller except as explicit parameter
- [ ] Transaction used for both `createProposalTemplate` (sortOrder) and `reorderProposalTemplates`
- [ ] `fetchTemplatesForPipeline` JSONB operators work correctly against Neon PostgreSQL

---

### Task 1.3: Zod Validation Schemas — Tests
**Status:** 🟡 Ready
**Effort:** 1 hour
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Write unit tests for the 4 new Zod schemas to be added to `src/lib/utils/validation.ts`. Tests validate schema acceptance and rejection behavior.

**File:** `tests/unit/services/proposalTemplateSchemas.test.ts` (or appended to existing validation test file if one exists)

**Acceptance Criteria:**
- [ ] `createProposalTemplateSchema`:
  - Accepts valid payload with required fields only (section, title, content)
  - Accepts valid payload with all optional fields
  - Rejects missing `section` → validation error
  - Rejects missing `title` or empty string → validation error
  - Rejects missing `content` or empty string → validation error
  - Rejects `content` > 50,000 chars → validation error
  - Rejects `isRequired: true` with `evaluateCoverage: true` → validation error on `isRequired`
  - Accepts `isRequired: true` with `evaluateCoverage: false`
  - Defaults: `isRequired=false`, `evaluateCoverage=false`, `triggerRfpTypes=null`, `triggerIndustryTags=null`, `sortOrder=0`
- [ ] `updateProposalTemplateSchema`:
  - Accepts partial payloads (any subset of optional fields)
  - Rejects empty string for `title` or `content` when supplied
  - Does NOT enforce `isRequired ↔ evaluateCoverage` (this is a merged-state check done in the service layer)
- [ ] `reorderProposalTemplatesSchema`:
  - Accepts valid array of `{ id: uuid, sortOrder: number }` pairs
  - Rejects empty `items` array
  - Rejects items with non-UUID `id` values
- [ ] `proposalTemplateSectionSchema`:
  - Accepts all 8 valid section type strings
  - Rejects unknown section type string
- [ ] All tests confirmed to FAIL

---

### Task 1.4: Zod Validation Schemas — Implementation
**Status:** 🔴 Blocked by Task 1.3
**Effort:** 1 hour
**Dependencies:** Task 1.3
**Parallel with:** Task 1.2

**Description:**
Add 4 new Zod schema exports to `src/lib/utils/validation.ts`.

```typescript
export const proposalTemplateSectionSchema = z.enum([...proposalTemplateSections])

export const createProposalTemplateSchema = z.object({
  section: proposalTemplateSectionSchema,
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50000),
  isRequired: z.boolean().default(false),
  triggerRfpTypes: z.array(z.string().min(1).max(100)).nullable().default(null),
  triggerIndustryTags: z.array(z.string().min(1).max(100)).nullable().default(null),
  evaluateCoverage: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
}).refine(
  v => !(v.isRequired && v.evaluateCoverage),
  { message: 'isRequired and evaluateCoverage cannot both be true', path: ['isRequired'] }
)

export const updateProposalTemplateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(50000).optional(),
  isRequired: z.boolean().optional(),
  triggerRfpTypes: z.array(z.string().min(1).max(100)).nullable().optional(),
  triggerIndustryTags: z.array(z.string().min(1).max(100)).nullable().optional(),
  evaluateCoverage: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export const reorderProposalTemplatesSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int(),
  })).min(1),
})
```

**Acceptance Criteria:**
- [ ] All tests from Task 1.3 pass
- [ ] Exports are named correctly (`createProposalTemplateSchema`, `updateProposalTemplateSchema`, `reorderProposalTemplatesSchema`, `proposalTemplateSectionSchema`)
- [ ] `proposalTemplateSections` imported from `@/lib/db/schema/proposal-templates` (not redefined)
- [ ] No existing exports in `validation.ts` are modified or broken

---

## Phase 2: API Routes

> Blocked until both service layer (1.2) and schemas (1.4) are complete. Route implementation is on the critical path.

---

### Task 2.1: API Routes — Tests
**Status:** 🔴 Blocked by Tasks 1.2 and 1.4
**Effort:** 3 hours
**Dependencies:** Tasks 1.2, 1.4

**Description:**
Write the integration-style unit test suite for all 5 API route handlers, following the pattern in `tests/unit/api/company-profile-settings.test.ts` and `tests/integration/api/rfps.test.ts`.

Mock `@/lib/utils/auth`, `@/lib/db`, and `@/lib/services/proposalTemplates`.

**File:** `tests/unit/api/proposal-templates-settings.test.ts`

**Acceptance Criteria:**
- [ ] `GET /api/settings/proposal-templates`:
  - 200 with `{ templates: [...] }` when authenticated
  - 401 when `requireAuth` throws AuthError
- [ ] `POST /api/settings/proposal-templates`:
  - 201 with `{ template: {...} }` when admin posts valid body
  - 400 when `isRequired=true && evaluateCoverage=true` (Zod refine violation)
  - 400 when required fields missing
  - 400 for malformed JSON body
  - 403 when `requireAdmin` throws AuthError(403)
  - Confirms `createdBy` set from `auth.userId`
- [ ] `POST /api/settings/proposal-templates/reorder`:
  - 200 `{ success: true }` on valid reorder
  - 400 when service throws `'INVALID_IDS'`
  - 400 for empty `items` array
  - 403 for non-admin
- [ ] `PATCH /api/settings/proposal-templates/[id]`:
  - 200 with updated template on valid patch
  - 404 when service returns `null` (template not found)
  - 403 for non-admin
  - 400 for malformed JSON body
- [ ] `DELETE /api/settings/proposal-templates/[id]`:
  - 204 with no body on success
  - 404 when service returns `false`
  - 403 for non-admin
- [ ] All tests confirmed to FAIL

---

### Task 2.2: API Routes — Implementation
**Status:** 🔴 Blocked by Task 2.1
**Effort:** 2 hours
**Dependencies:** Task 2.1

**Description:**
Create 3 new route files implementing 5 handlers. Follow the `src/app/api/settings/rate-card/route.ts` pattern exactly.

**Files to create:**
1. `src/app/api/settings/proposal-templates/route.ts` — GET (requireAuth) + POST (requireAdmin)
2. `src/app/api/settings/proposal-templates/reorder/route.ts` — POST (requireAdmin)
3. `src/app/api/settings/proposal-templates/[id]/route.ts` — PATCH (requireAdmin) + DELETE (requireAdmin)

**Key implementation rules:**
- Wrap all `request.json()` in try/catch → 400 for invalid JSON
- POST: pass `auth.userId` as `createdBy` to service
- PATCH: if service returns `null` → 404
- DELETE: if service returns `false` → 404; success → `new NextResponse(null, { status: 204 })`
- Reorder: if service throws `'INVALID_IDS'` → 400 with descriptive message
- All route error handlers log with route prefix: `console.error('[POST /api/settings/proposal-templates]', error)`

**Acceptance Criteria:**
- [ ] All tests from Task 2.1 pass
- [ ] GET uses `requireAuth`, all writes use `requireAdmin`
- [ ] 204 DELETE returns no body
- [ ] Route file at `reorder/` is a literal segment (not `[id]`)
- [ ] Zod `safeParse` used for all request body validation (not `parse`)
- [ ] Validation errors return `{ error: 'Validation failed', details: [...] }` matching existing pattern

---

### Task 2.3: Security Review
**Status:** 🔴 Blocked by Task 2.2
**Effort:** 1 hour
**Dependencies:** Task 2.2
**Parallel with:** Tasks 3.1 and 3.2

**Description:**
Run `/security-review` on the API route handlers and service layer. Address any CRITICAL or HIGH findings before proceeding to UI implementation.

**Files to review:**
- `src/app/api/settings/proposal-templates/route.ts`
- `src/app/api/settings/proposal-templates/reorder/route.ts`
- `src/app/api/settings/proposal-templates/[id]/route.ts`
- `src/lib/services/proposalTemplates.ts`

**Acceptance Criteria:**
- [ ] No CRITICAL security issues
- [ ] No HIGH security issues
- [ ] Tenant isolation verified: every DB query scoped by `organizationId` from auth session
- [ ] No `organizationId` accepted from request body or URL parameters
- [ ] Template `content` field not executed or rendered server-side
- [ ] Error messages do not leak template content or org data
- [ ] Auth checks present on all write endpoints (`requireAdmin`)

---

## Phase 3: UI Components

> UI component tests (3.3) and implementation (3.4) are on the critical path. Reducer (3.1/3.2) can begin in parallel with security review.

---

### Task 3.1: Reducer — Tests
**Status:** 🔴 Blocked by Task 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2 (needs `ProposalTemplate` type)
**Parallel with:** Task 2.3

**Description:**
Write unit tests for `templateLibrary.reducer.ts`. Test the reducer logic in isolation (pure function tests — no rendering required).

**File:** `tests/unit/components/settings/proposal-templates/templateLibrary.reducer.test.ts`

**Acceptance Criteria:**
- [ ] `FETCH_START`: sets `status: 'loading'`
- [ ] `FETCH_SUCCESS`: sets `templates`, clears error, sets `status: 'idle'`
- [ ] `FETCH_ERROR`: sets error, sets `status: 'error'`
- [ ] `OPEN_CREATE`: opens dialog in create mode with given section
- [ ] `OPEN_EDIT`: opens dialog in edit mode with template's current values
- [ ] `CLOSE_DIALOG`: closes dialog, resets `isSaving`
- [ ] `SAVE_SUCCESS`: adds new template to list (create mode); replaces existing template (edit mode); closes dialog
- [ ] `SAVE_ERROR`: keeps dialog open; sets error
- [ ] `OPEN_DELETE`: opens confirm dialog with target template
- [ ] `CLOSE_DELETE` / `DELETE_SUCCESS` / `DELETE_ERROR`: correct state transitions
- [ ] `MOVE_UP`: swaps sortOrder of target with previous sibling in same section; no change at first position
- [ ] `MOVE_DOWN`: swaps sortOrder of target with next sibling in same section; no change at last position
- [ ] All tests confirmed to FAIL

---

### Task 3.2: Reducer — Implementation
**Status:** 🔴 Blocked by Task 3.1
**Effort:** 1 hour
**Dependencies:** Task 3.1

**Description:**
Implement `src/components/settings/proposal-templates/templateLibrary.reducer.ts`.

```typescript
// State shape
interface LibraryState {
  templates: ProposalTemplate[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
  dialog: {
    open: boolean
    mode: 'create' | 'edit'
    section: ProposalTemplateSection | null
    initialValues: Partial<ProposalTemplate> | null
    isSaving: boolean
  }
  deleteConfirm: {
    open: boolean
    target: ProposalTemplate | null
    isDeleting: boolean
  }
}
```

**Key logic:**
- `MOVE_UP`/`MOVE_DOWN`: find the template and its adjacent sibling within the same section, swap their `sortOrder` values in the `templates` array (immutable — return new array)
- `SAVE_SUCCESS`: if the template id exists in the current list → replace; if not → append

**Acceptance Criteria:**
- [ ] All tests from Task 3.1 pass
- [ ] All state transitions are immutable (return new state objects/arrays, never mutate)
- [ ] `MOVE_UP` at first position is a no-op
- [ ] `MOVE_DOWN` at last position is a no-op
- [ ] Exported: `libraryReducer`, `initialLibraryState`, `LibraryState`, `LibraryAction`

---

### Task 3.3: UI Components — Tests
**Status:** 🔴 Blocked by Tasks 2.2 and 3.2
**Effort:** 3 hours
**Dependencies:** Tasks 2.2, 3.2

**Description:**
Write UI component tests for the `ProposalTemplateLibrary` component tree using React Testing Library. Mock `fetch` for API calls.

**Files:**
- `tests/unit/components/settings/proposal-templates/ProposalTemplateLibrary.test.tsx`
- `tests/unit/components/settings/proposal-templates/TemplateFormDialog.test.tsx`

**Acceptance Criteria (ProposalTemplateLibrary.test.tsx):**
- [ ] Renders loading skeleton while `status === 'loading'`
- [ ] Renders all 8 section headings regardless of data (constants-driven)
- [ ] Renders empty state message for sections with no templates
- [ ] Renders template titles and Required/Situational badges in correct sections
- [ ] Admin: "Add Template" button renders in each section
- [ ] Admin: Edit and Delete buttons render on each template row
- [ ] Non-admin: Write controls (Add, Edit, Delete, Up/Down) are NOT rendered
- [ ] Up arrow disabled for first template in section; Down arrow disabled for last
- [ ] Clicking "Add Template" opens dialog in create mode
- [ ] Clicking "Edit" opens dialog pre-populated with template values

**Acceptance Criteria (TemplateFormDialog.test.tsx):**
- [ ] When `isRequired` toggled on: `evaluateCoverage` switch becomes disabled
- [ ] When `isRequired` toggled on then off: `evaluateCoverage` remains disabled (no auto-restore)
- [ ] Saving with `isRequired=true` and `evaluateCoverage=false` → submit called with correct values
- [ ] Content textarea allows multi-line input
- [ ] Empty title prevents form submission
- [ ] Empty content prevents form submission

**Acceptance Criteria (TemplateDeleteConfirm):**
- [ ] Renders template title in confirmation message
- [ ] Clicking "Confirm" calls `onConfirm`
- [ ] Clicking "Cancel" calls `onCancel`
- [ ] All tests confirmed to FAIL

---

### Task 3.4: UI Components — Implementation
**Status:** 🔴 Blocked by Task 3.3
**Effort:** 4 hours
**Dependencies:** Task 3.3

**Description:**
Implement all 6 UI component files in `src/components/settings/proposal-templates/`. Use shadcn/ui components throughout.

**Files to create:**
1. `ProposalTemplateLibrary.tsx` — root client component with `useReducer`; owns fetch + mutations; dispatches all actions
2. `TemplateSectionGroup.tsx` — renders one section's Card; empty state when no templates; "Add Template" button (admin-gated)
3. `TemplateListItem.tsx` — title, Required/Situational badge, trigger tag summary, Up/Down arrows (admin-gated), Edit/Delete buttons (admin-gated)
4. `TemplateFormDialog.tsx` — Dialog with local `useReducer` for form fields; enforces `isRequired → evaluateCoverage` in `SET_IS_REQUIRED` action handler
5. `TemplateDeleteConfirm.tsx` — AlertDialog wrapper; `isDeleting` disables both buttons
6. `TriggerTagInput.tsx` — dual-mode: `options` prop → Select/Combobox; no `options` → free-text Entry with badge display

**Key rules:**
- `SECTION_LABELS` constants map: all 8 sections to human-readable headings; render all 8 always
- `isRequired → evaluateCoverage` enforced in form reducer action, NOT in `useEffect`
- Optimistic updates: dispatch `SAVE_SUCCESS`/`DELETE_SUCCESS` immediately; rollback on API error
- `fetch` calls use the routes created in Task 2.2

**Acceptance Criteria:**
- [ ] All tests from Task 3.3 pass
- [ ] All 8 sections always rendered (not derived from data)
- [ ] No `any` types
- [ ] `'use client'` directive present
- [ ] Admin gate: write controls rendered based on `isAdmin` prop (not disabled — not rendered)
- [ ] Error states shown inline (not just console.error)
- [ ] Loading and saving states visible to user

---

### Task 3.5: Settings Page Integration
**Status:** 🔴 Blocked by Task 3.4
**Effort:** 1 hour
**Dependencies:** Task 3.4

**Description:**
Mount `ProposalTemplateLibrary` in the settings section and add the navigation tab.

**Files to create/modify:**
1. **Create** `src/app/(auth)/settings/proposal-templates/page.tsx`
   - Server component that reads `isAdmin` from Clerk auth
   - Renders `<ProposalTemplateLibrary isAdmin={isAdmin} />`

2. **Modify** `src/app/(auth)/settings/page.tsx`
   - Add `{ label: 'Proposal Templates', href: '/settings/proposal-templates' }` to `tabs` array

**Acceptance Criteria:**
- [ ] Navigating to `/settings/proposal-templates` renders the template library
- [ ] Tab appears in settings navigation between "Company Profile" and the next tab
- [ ] `isAdmin` prop correctly reflects Clerk org role (admin vs member)
- [ ] Non-admin users see the list but not write controls

---

## Phase 4: Quality Gate

---

### Task 4.1: Code Review
**Status:** 🔴 Blocked by Task 3.5
**Effort:** 1 hour
**Dependencies:** Task 3.5

**Description:**
Run `/code-review` on all new and modified files. Address CRITICAL and HIGH findings before marking the feature complete.

**Files to review:**
- `src/lib/services/proposalTemplates.ts`
- `src/lib/utils/validation.ts` (changed sections)
- `src/app/api/settings/proposal-templates/route.ts`
- `src/app/api/settings/proposal-templates/reorder/route.ts`
- `src/app/api/settings/proposal-templates/[id]/route.ts`
- `src/components/settings/proposal-templates/` (all files)
- `src/app/(auth)/settings/proposal-templates/page.tsx`
- `src/app/(auth)/settings/page.tsx` (changed sections)

**Acceptance Criteria:**
- [ ] No CRITICAL code quality issues
- [ ] No HIGH code quality issues
- [ ] All MEDIUM issues reviewed and accepted/resolved
- [ ] No `console.log` statements in production code
- [ ] No `any` types used
- [ ] File sizes within project conventions (< 800 lines per file)
- [ ] Component props interfaces exported for testability
- [ ] Test coverage ≥ 80% across all new files

---

## User Story → Task Mapping

| User Story | Tasks |
|---|---|
| US1: Create a Template | 1.1, 1.2 (service), 1.3, 1.4 (validation), 2.1, 2.2 (POST route), 3.3, 3.4 (form dialog) |
| US2: View and Browse Library | 2.1, 2.2 (GET route), 3.3, 3.4 (section groups, list items) |
| US3: Edit a Template | 1.1, 1.2 (updateProposalTemplate), 2.1, 2.2 (PATCH route), 3.3, 3.4 (edit dialog) |
| US4: Delete a Template | 1.1, 1.2 (deleteProposalTemplate), 2.1, 2.2 (DELETE route), 3.3, 3.4 (confirm dialog) |
| US5: Reorder Templates | 1.1, 1.2 (reorderProposalTemplates), 2.1, 2.2 (reorder route), 3.1, 3.2 (MOVE_UP/DOWN reducer), 3.3, 3.4 (arrow buttons) |
| US6: Configure Situational | 1.3, 1.4 (validation), 2.1, 2.2 (trigger fields), 3.3, 3.4 (TriggerTagInput) |

---

## Quality Gate Summary

| Gate | Task | Timing |
|---|---|---|
| Security Review | Task 2.3 | After API routes complete |
| Code Review | Task 4.1 | After all implementation complete |
| TDD verification | All pairs | Tests fail before impl, pass after |
| Coverage ≥ 80% | Task 4.1 | Checked during code review |

---

## Next Steps

1. Review this task breakdown
2. Begin Task 1.1 (service tests) and Task 1.3 (schema tests) in parallel
3. Run `/speckit-implement` to execute with TDD enforcement
4. Commit artifacts:
   ```
   git add .specify/specs/004-proposal-template-library/
   git commit -m "feat: add implementation plan and task breakdown for proposal template library"
   ```
