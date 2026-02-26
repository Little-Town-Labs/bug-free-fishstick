# Implementation Plan — 004-proposal-template-library

**Branch:** `004-proposal-template-library`
**Specification:** `.specify/specs/004-proposal-template-library/spec.md`
**PRD Source:** §5 US2, §5 US7, §6.2
**Phase:** 2 — Commercial Engine (parallel with F5, F6)

---

## Executive Summary

Feature 4 delivers full CRUD management of the Proposal Template Library — the organization's store of verbatim contract clauses that are injected into every proposal. The data model already exists from Feature 1. This feature adds:

- **Service layer** (`src/lib/services/proposalTemplates.ts`) — 6 functions covering list, create, update, delete, reorder, and pipeline fetch
- **API routes** (5 endpoints) — list, create, update, delete, reorder — all tenant-scoped
- **Zod validation** (4 schemas) — create, update, reorder, with the `isRequired ↔ evaluateCoverage` constraint
- **Settings UI** — ProposalTemplateLibrary component tree (7 components) mounted in the existing settings page tab structure

No migration is required. All schema changes landed in F1 (`drizzle/0008_proposal_bid_engine.sql`).

---

## Architecture Overview

```
Settings Page (/settings/proposal-templates)
└── ProposalTemplateLibrary [Client Component, useReducer]
    ├── TemplateSectionGroup × 8 (one per section)
    │   └── TemplateListItem × N (per section, sorted by sortOrder)
    ├── TemplateFormDialog (single instance, shared for add/edit)
    ├── TemplateDeleteConfirm (AlertDialog)
    └── TriggerTagInput (shared by form — rfpTypes + industryTags)

API Layer (5 endpoints)
├── GET  /api/settings/proposal-templates           → listTemplates
├── POST /api/settings/proposal-templates           → createTemplate
├── POST /api/settings/proposal-templates/reorder   → reorderTemplates
├── PATCH /api/settings/proposal-templates/[id]     → updateTemplate
└── DELETE /api/settings/proposal-templates/[id]   → deleteTemplate

Service Layer
└── src/lib/services/proposalTemplates.ts
    ├── listProposalTemplates(orgId)
    ├── listProposalTemplatesBySection(orgId)
    ├── createProposalTemplate(orgId, createdBy, input)
    ├── updateProposalTemplate(orgId, templateId, input)
    ├── deleteProposalTemplate(orgId, templateId)
    ├── reorderProposalTemplates(orgId, items)
    └── fetchTemplatesForPipeline(orgId, input)     ← used by F8
```

---

## Technology Stack

All choices inherit from the existing codebase. No new dependencies are required.

| Layer | Technology | Rationale |
|---|---|---|
| ORM | Drizzle ORM 0.45+ | Already in use; schema already defined |
| Validation | Zod | Project standard; `.refine()` handles the `isRequired ↔ evaluateCoverage` constraint |
| Auth | Clerk (`requireAuth` / `requireAdmin`) | Existing auth helpers; GET uses `requireAuth`, all writes use `requireAdmin` |
| UI Components | shadcn/ui | Project standard; Dialog, AlertDialog, Switch, Select, Input, Badge, Textarea |
| State Management | `useReducer` | Matches RateCardForm pattern; needed for cross-field constraint, optimistic updates, dialog coordination |
| Reordering | Up/down arrow buttons | Zero bundle cost; appropriate for infrequently-used admin settings screen; no library needed |
| Trigger tag entry | `TriggerTagInput` component | Dual-mode: Select/Combobox for bounded rfpTypes; free-text Entry for industry tags |
| Data fetching | `useEffect + fetch` | Matches existing settings component pattern; no SWR/React Query needed |

**No new packages required.**

---

## Technical Decisions

### Decision 1: Reorder via Up/Down Buttons, Not Drag-and-Drop

**Chosen:** Up/down arrow buttons on `TemplateListItem`.

**Rationale:** Settings screens are low-frequency admin interactions. The codebase has no drag library. Adding one solely for reordering adds bundle cost without proportionate UX value. Arrow buttons are keyboard-accessible by default, fulfilling NFR accessibility requirements.

**Tradeoffs:** Lower polish than drag-and-drop. If product requirements change, `@dnd-kit/sortable` is the correct future choice and the reducer is pre-structured for it (`REORDER_OPTIMISTIC` / `REORDER_ROLLBACK` action slots).

---

### Decision 2: Section Field Is Immutable

**Chosen:** `section` cannot be changed via PATCH.

**Rationale:** Changing a template's section after creation affects pipeline output ordering and template grouping semantics. Delete-and-recreate is the correct migration path for section changes. This keeps the update path simple and avoids `sortOrder` confusion across section boundaries.

**Tradeoffs:** Admin must delete and recreate to move a template between sections. Acceptable for infrequent maintenance operations.

---

### Decision 3: `isRequired ↔ evaluateCoverage` Enforcement Strategy

**Create:** Enforced in Zod `createProposalTemplateSchema` via `.refine(v => !(v.isRequired && v.evaluateCoverage), ...)`. Failure returns HTTP 400.

**Update (PATCH):** The patch payload alone is insufficient — if only `isRequired` is sent, we must know the existing `evaluateCoverage` value to detect a conflict. The service layer reads the existing row, merges the patch, then validates the merged result. If the merged result violates the constraint, the update is rejected. This read-then-validate pattern ensures correctness without requiring both fields in every PATCH request.

---

### Decision 4: sortOrder Auto-Assignment on Create

**Chosen:** Service layer reads `MAX(sort_order)` within org+section inside a transaction (with `FOR UPDATE` advisory lock), then inserts with `max+1`.

**Rationale:** Avoids race conditions when two admins create templates in the same section simultaneously. The lock prevents duplicate sortOrder values. Drizzle 0.45 does not natively generate `SELECT ... FOR UPDATE`, so this uses a raw `sql` tagged template for the lock hint.

**Neon note:** The project must use the WebSocket driver (`@neondatabase/serverless` with `neonConfig.webSocketConstructor`) for `db.transaction()` to work. Confirm at the route handler level that the same `db` client used in Inngest functions is used here.

---

### Decision 5: GET Response — Flat Array

**Chosen:** `GET /api/settings/proposal-templates` returns a flat array ordered by section enum position then `sortOrder ASC`.

**Rationale:** REST collection endpoints conventionally return flat arrays. The client performs one `reduce` to group by section. The service also exposes `listProposalTemplatesBySection` for callers needing the grouped form. Feature 8 pipeline consumption uses the flat array directly.

---

## Implementation Phases

### Phase A: Service Layer (foundation for everything else)

**Files to create:**
- `src/lib/services/proposalTemplates.ts`

**Function signatures:**

```typescript
export async function listProposalTemplates(orgId: string): Promise<ProposalTemplate[]>

export async function listProposalTemplatesBySection(orgId: string): Promise<Record<ProposalTemplateSection, ProposalTemplate[]>>

export async function createProposalTemplate(
  orgId: string,
  createdBy: string,
  input: CreateProposalTemplateInput
): Promise<ProposalTemplate>

export async function updateProposalTemplate(
  orgId: string,
  templateId: string,
  input: UpdateProposalTemplateInput
): Promise<ProposalTemplate | null>   // null = not found

export async function deleteProposalTemplate(
  orgId: string,
  templateId: string
): Promise<boolean>   // false = not found

export async function reorderProposalTemplates(
  orgId: string,
  items: ReorderItem[]
): Promise<void>   // throws 'INVALID_IDS' if any id not owned by org

export async function fetchTemplatesForPipeline(
  orgId: string,
  input: { rfpType: string; industryTags: string[] }
): Promise<ProposalTemplate[]>
```

**Key implementation notes:**
- `updatedAt: new Date()` must be passed explicitly in every `.set()` call (schema has no `.$onUpdate()`)
- `listProposalTemplatesBySection` calls `listProposalTemplates` internally; groups in application code using manual `reduce` (Node 18 compatibility)
- `reorderProposalTemplates` runs all updates inside `db.transaction(async tx => {...})`; validates all IDs first in one SELECT; throws on any mismatch
- `fetchTemplatesForPipeline` uses raw `sql` tagged template for JSONB `@>` / `&&` operators (Drizzle 0.45 doesn't expose these natively)

---

### Phase B: Zod Validation Schemas

**File to update:**
- `src/lib/utils/validation.ts` (add 4 new exports)

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

Note: `updateProposalTemplateSchema` has no `.refine()` for the constraint — this is intentional. The partial patch alone cannot determine constraint violations; the merged state check happens in the service layer after reading the existing row.

---

### Phase C: API Routes

**Files to create:**

1. `src/app/api/settings/proposal-templates/route.ts` — `GET` + `POST`
2. `src/app/api/settings/proposal-templates/reorder/route.ts` — `POST` (literal segment, not `[id]`)
3. `src/app/api/settings/proposal-templates/[id]/route.ts` — `PATCH` + `DELETE`

**Pattern:** Follow `src/app/api/settings/rate-card/route.ts` — `try/catch AuthError`, return `{ error }` with status code from `error.statusCode`, log errors with route prefix.

**Auth split:**
- `GET /api/settings/proposal-templates` → `requireAuth()` (any org member)
- All write endpoints → `requireAdmin()` (org admin only)

**Specific notes:**
- POST: extract `auth.userId` for `createdBy` field; call `createProposalTemplate(auth.orgId, auth.userId, parsed.data)`
- PATCH: if service returns `null`, respond with `{ error: 'Template not found' }` → 404
- DELETE: if service returns `false`, respond with `{ error: 'Template not found' }` → 404; success → 204 no body
- Reorder: if service throws `'INVALID_IDS'`, respond with descriptive 400
- Wrap all `request.json()` calls in try/catch → 400 for invalid JSON

---

### Phase D: Settings UI Components

**Files to create** (under `src/components/settings/proposal-templates/`):

1. `ProposalTemplateLibrary.tsx` — root client component, `useReducer`, owns fetch + mutations
2. `TemplateSectionGroup.tsx` — renders one section's Card + template list + empty state
3. `TemplateListItem.tsx` — single row with title, badges, up/down arrows, edit/delete buttons
4. `TemplateFormDialog.tsx` — add/edit Dialog with all form fields; internal `useReducer`
5. `TemplateDeleteConfirm.tsx` — AlertDialog wrapper
6. `TriggerTagInput.tsx` — dual-mode tag input (Select/Combobox for rfpTypes; free-text for industryTags)
7. `templateLibrary.reducer.ts` — reducer, action union type, initial state factory

**Reducer state shape:**
```typescript
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

**isRequired ↔ evaluateCoverage in form:** Enforced in the form reducer's `SET_IS_REQUIRED` handler — setting `isRequired=true` immediately sets `evaluateCoverage=false` synchronously. No `useEffect` needed. The `evaluateCoverage` Switch renders as disabled with helper text when `isRequired=true`.

**Section constants map:** Define a `SECTION_LABELS` record mapping section keys to human-readable labels. All 8 sections are always rendered (even when empty) — iterate over the known section list, not over the data.

**Settings page integration:**
- Create `src/app/(auth)/settings/proposal-templates/page.tsx` — wraps `ProposalTemplateLibrary`
- Update `src/app/(auth)/settings/page.tsx` — add `{ label: 'Proposal Templates', href: '/settings/proposal-templates' }` to the `tabs` array

---

## Security Considerations

| Risk | Mitigation |
|---|---|
| Cross-tenant data access | All service functions filter by `organizationId` derived from Clerk session; never accepted from request body |
| Unauthorized writes | `requireAdmin()` on all POST/PATCH/DELETE routes; throws `AuthError(403)` for non-admins |
| Large content injection | Content max 50,000 chars enforced by Zod; content stored as text, not executed server-side |
| Reorder with foreign IDs | Service validates all IDs belong to org before updating; atomic rejection if any mismatch |
| Information leakage | 404 responses for items not found in org are identical regardless of whether the item exists in another org |

---

## Performance Strategy

- **List query:** Single `SELECT * ... ORDER BY section, sort_order` — O(1) with the existing `proposal_templates_org_idx` index
- **Grouped view:** Derived from the flat list in application code; no second DB round-trip
- **Create sortOrder:** One `SELECT MAX` + one `INSERT` in a transaction — acceptable for infrequent creates
- **Reorder:** N individual UPDATEs in a single transaction (atomic, correct for lists of 5–30 items)
- **Expected library size:** Tens to low hundreds of templates per org; 200ms response target is achievable with indexed queries

---

## Testing Strategy

### Unit Tests (TDD — tests first)

**`tests/unit/services/proposalTemplates.test.ts`**
- `listProposalTemplates`: returns flat sorted array; returns empty array for org with no templates
- `createProposalTemplate`: inserts correct values; sets `createdBy`; auto-assigns `sortOrder`
- `updateProposalTemplate`: updates only changed fields; sets `updatedAt`; returns null for unknown id; enforces merged-state constraint (isRequired+evaluateCoverage)
- `deleteProposalTemplate`: returns true on success; returns false for unknown id
- `reorderProposalTemplates`: applies all sort orders in transaction; throws on unknown ID; no partial updates
- `fetchTemplatesForPipeline`: returns required templates; returns matching situational templates; OR logic across rfpType and industryTags

**`tests/unit/api/proposal-templates-settings.test.ts`**
- `GET`: returns 200 with flat templates array; returns 401 when unauthenticated
- `POST`: returns 201 with created template; returns 400 when `isRequired=true && evaluateCoverage=true`; returns 403 for non-admin; returns 400 for missing required fields
- `PATCH`: returns 200 with updated template; returns 404 for unknown id; returns 403 for non-admin; returns 400 for merged-state constraint violation
- `DELETE`: returns 204 on success; returns 404 for unknown id; returns 403 for non-admin
- `POST /reorder`: returns 200; returns 400 for unknown ids; returns 403 for non-admin

**`tests/unit/components/settings/proposal-templates/ProposalTemplateLibrary.test.tsx`**
- Renders all 8 section groups even when library is empty
- Opens add dialog when "Add Template" clicked
- Enforces isRequired ↔ evaluateCoverage in form
- Up/down buttons are disabled at section boundaries
- Delete confirmation appears before deletion
- Non-admin: write controls not rendered

### Integration Tests

No new Inngest integration tests for this feature (no Inngest functions involved). The `fetchTemplatesForPipeline` function will be covered when Feature 8 is tested.

---

## Constitutional Compliance

| Principle | Status | Evidence |
|---|---|---|
| I. Tenant Isolation | ✅ | All service functions filter by `organizationId`; never accepted as request param |
| II. Type Safety | ✅ | `ProposalTemplate` and `NewProposalTemplate` from Drizzle `$inferSelect`/`$inferInsert`; strict Zod schemas; no `any` |
| III. Explicit Over Implicit | ✅ | `isRequired ↔ evaluateCoverage` constraint is explicit in Zod schema and service layer; `updatedAt` set explicitly on every write |
| IV. Secure by Default | ✅ | Write routes require admin; GET allows any org member; content stored as text, not executed |
| V. 80% Coverage Minimum | ✅ | Unit tests cover all 6 service functions, 5 API routes, and the UI component |
| VI. Test the Agents | N/A | No AI agents in this feature |
| VII. Integration Tests for Workflows | ✅ | `fetchTemplatesForPipeline` service contract designed for F8 integration testing |
| IX. Progressive Disclosure | ✅ | Section groups always shown; template details expand in modal |
| X. Human Always in Control | ✅ | All template changes require admin action; delete requires confirmation |
| XII. Accessible First | ✅ | Up/down arrows keyboard-accessible; shadcn Dialog/AlertDialog meet WCAG 2.1 AA |

---

## File Inventory

### New Files
```
src/lib/services/proposalTemplates.ts
src/app/api/settings/proposal-templates/route.ts
src/app/api/settings/proposal-templates/reorder/route.ts
src/app/api/settings/proposal-templates/[id]/route.ts
src/components/settings/proposal-templates/ProposalTemplateLibrary.tsx
src/components/settings/proposal-templates/TemplateSectionGroup.tsx
src/components/settings/proposal-templates/TemplateListItem.tsx
src/components/settings/proposal-templates/TemplateFormDialog.tsx
src/components/settings/proposal-templates/TemplateDeleteConfirm.tsx
src/components/settings/proposal-templates/TriggerTagInput.tsx
src/components/settings/proposal-templates/templateLibrary.reducer.ts
src/app/(auth)/settings/proposal-templates/page.tsx
tests/unit/services/proposalTemplates.test.ts
tests/unit/api/proposal-templates-settings.test.ts
tests/unit/components/settings/proposal-templates/ProposalTemplateLibrary.test.tsx
```

### Modified Files
```
src/lib/utils/validation.ts        — 4 new Zod schema exports
src/app/(auth)/settings/page.tsx   — add Proposal Templates tab entry
```

### No Migration Required
The `proposal_templates` table with all indexes was created by `drizzle/0008_proposal_bid_engine.sql` (Feature 1).

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Neon WebSocket driver not used for API routes | Medium | Verify `db` import in API routes is from same `@/lib/db` that supports transactions; test `reorderProposalTemplates` with integration test |
| `isRequired ↔ evaluateCoverage` not enforced on PATCH | High | Service layer reads current row before updating; unit test explicitly covers merge-state violation scenario |
| `FOR UPDATE` lock on sortOrder create causes deadlock | Low | Only two statements in the transaction; lock is narrow (org+section); very unlikely under realistic concurrency |
| TriggerTagInput free-text entry allows empty strings | Low | Zod schema validates each tag as `z.string().min(1).max(100)`; empty strings rejected at API boundary |
| Section rendered even when all templates deleted | Intended | All 8 sections always rendered from constants; empty state message guides admin |
