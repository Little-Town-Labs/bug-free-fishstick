# Tasks: Proposal Draft Generator

**Input**: Design documents from `specs/001-proposal-draft-generator/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included per project constitution (80% coverage requirement, Principle V).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Web application — existing Next.js monorepo under `src/` at repository root.

---

## Phase 1: Setup & Foundational (Blocking Prerequisites)

**Purpose**: Database schema, migration, and background job wiring that MUST be complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Create Drizzle schema for Proposal Content Library in `src/lib/db/schema/proposal-content-library.ts`
- [ ] T002 Create Drizzle schema for Proposal Drafts in `src/lib/db/schema/proposal-drafts.ts`
- [ ] T003 Export both new schemas from `src/lib/db/schema/index.ts`
- [ ] T004 Generate and apply DB migration: run `npx drizzle-kit generate` then `npx drizzle-kit migrate` to create `proposal_content_library` and `proposal_drafts` tables
- [ ] T005 Register `generate-proposal` Inngest function in `src/app/api/inngest/route.ts` (stub function file at `src/lib/inngest/functions/generate-proposal.ts` is created here; full implementation is T013)

**Checkpoint**: Schema exists in DB, Inngest function is registered (even as a stub). User story work can now begin.

---

## Phase 2: User Story 1 — Generate Proposal Draft from RFP (Priority: P1) 🎯 MVP

**Goal**: User opens an RFP, clicks "Generate Proposal", answers AI-generated clarifying questions, and receives a complete first-pass proposal as markdown. The draft is stored and viewable in the app.

**Independent Test**: Load a processed RFP, call `POST /api/rfps/{rfpId}/proposals`, receive clarifying questions back, `POST /api/rfps/{rfpId}/proposals/{draftId}/answers` with answers, poll `GET /api/rfps/{rfpId}/proposals/{draftId}` until status is `draft`, verify `markdownContent` is non-null and contains sections derived from the RFP.

### Tests for User Story 1

> **Write these tests FIRST — they must FAIL before implementation begins**

- [ ] T006 [P] [US1] Write unit tests for `proposal-question-generator` agent with mocked LLM responses in `tests/unit/agents/proposal-question-generator.test.ts` — verify: returns 3–10 questions, each has `id`, `question`, `rfpSection` fields, handles empty RFP fields gracefully
- [ ] T007 [P] [US1] Write unit tests for `proposal-writer` agent with mocked LLM responses in `tests/unit/agents/proposal-writer.test.ts` — verify: returns non-empty markdown, incorporates provided knowledge context and user answers, handles empty content library gracefully, **sections sourced from knowledge base include a `> *Source: knowledge base*` annotation**, **sections sourced from content library include a `> *Source: content library — [entry name]*` annotation**, handles LLM timeout and malformed JSON response gracefully
- [ ] T008 [P] [US1] Write unit tests for `proposal-draft` service in `tests/unit/services/proposal-draft.test.ts` — verify: `createDraft` creates record with `awaiting_answers` status, `submitAnswers` transitions status to `generating`, `updateDraftContent` stores markdown and transitions to `draft`
- [ ] T009 [P] [US1] Write integration tests for proposals API routes in `tests/integration/api/proposals.test.ts` — verify: `POST /api/rfps/{rfpId}/proposals` returns 201 with questions, `POST .../answers` returns 202, `GET .../draft` returns draft details, tenant isolation enforced (403 when rfpId belongs to different org)
- [ ] T040 [P] [US1] Write integration tests for `generate-proposal` Inngest function in `tests/integration/inngest/generate-proposal.test.ts` — mock `proposal-writer` agent and `searchSimilar`; verify: success path calls `updateDraftContent` and sets status to `draft`; verify: LLM failure path sets `status = 'error'` with a non-null `generationError` message; verify: org-scoped content library entries are fetched (not another org's entries)

### Implementation for User Story 1

- [ ] T010 [P] [US1] Implement `proposal-question-generator` agent in `src/lib/ai/agents/proposal-question-generator.ts` — uses `generateObject` with Zod schema; inputs: RFP parsed fields + summary, knowledge context topics, content library categories; outputs: array of `ClarifyingQuestion` objects (3–10 questions)
- [ ] T011 [P] [US1] Implement `proposal-writer` agent in `src/lib/ai/agents/proposal-writer.ts` — uses `generateText`; inputs: RFP sections/fields, knowledge context (vector search results), content library entries, user's clarifying answers; output: complete markdown proposal with section headers mirroring the RFP structure; **each section MUST include a blockquote source annotation** (e.g., `> *Source: knowledge base*`, `> *Source: content library — Standard SLA Terms*`, or `> *Source: user answer*`) immediately after the section heading, per FR-013
- [ ] T012 [US1] Implement `proposal-draft` service in `src/lib/services/proposal-draft.ts` — functions: `createDraft(rfpId, orgId, userId)` calls `proposal-question-generator` then persists draft; `submitAnswers(draftId, orgId, answers[])` stores answers, sets status to `generating`, fires Inngest event; `getDraft(draftId, orgId)` with org scope check; `listDrafts(rfpId, orgId)`; `updateDraftContent(draftId, orgId, markdownContent)` sets status to `draft`
- [ ] T013 [US1] Implement Inngest background function in `src/lib/inngest/functions/generate-proposal.ts` — triggered by `proposal/generate` event; calls `searchSimilar` for knowledge context, fetches content library entries for org, calls `proposal-writer` agent, calls `updateDraftContent` on success, sets status to `error` with message on failure
- [ ] T014 [P] [US1] Implement `GET + POST /api/rfps/[rfpId]/proposals` in `src/app/api/rfps/[rfpId]/proposals/route.ts` — `POST`: validates RFP belongs to org and has `parsedStructure`, calls `createDraft`, returns 201 with draft + questions; `GET`: calls `listDrafts`, returns 200 with summary list
- [ ] T015 [P] [US1] Implement `GET /api/rfps/[rfpId]/proposals/[draftId]` in `src/app/api/rfps/[rfpId]/proposals/[draftId]/route.ts` — validates org scope on both rfpId and draftId, returns full draft including `clarifyingQuestions` and `markdownContent`
- [ ] T016 [US1] Implement `POST /api/rfps/[rfpId]/proposals/[draftId]/answers` in `src/app/api/rfps/[rfpId]/proposals/[draftId]/answers/route.ts` — validates draft is in `awaiting_answers` state, validates answer array against question IDs, calls `submitAnswers`, dispatches Inngest event, returns 202 with `{draftId, status: "generating"}`
- [ ] T017 [P] [US1] Create `ClarifyingQuestionsForm` component in `src/components/rfp/ClarifyingQuestionsForm.tsx` — renders each clarifying question as a labeled textarea, supports skip (empty answer), submit button triggers `POST .../answers`, shows loading state during submission, ARIA labels on all inputs
- [ ] T018 [P] [US1] Create `ProposalDraftPanel` component in `src/components/rfp/ProposalDraftPanel.tsx` — shows list of past drafts with status badges and timestamps, polls `GET .../proposals/{draftId}` every 3s when status is `generating`, navigates to wizard page on draft click, shows generation error message when status is `error`
- [ ] T019 [US1] Create proposal wizard page in `src/app/(auth)/rfps/[rfpId]/proposal/page.tsx` — three-step flow: (1) `POST` to create draft and show questions via `ClarifyingQuestionsForm`, (2) submit answers and show generating progress indicator, (3) when draft status is `draft`, show `markdownContent` in read-only preview; wire all API calls
- [ ] T020 [US1] Add "Generate Proposal" button and `ProposalDraftPanel` to RFP detail page in `src/app/(auth)/rfps/[rfpId]/page.tsx` — button navigates to `/rfps/{rfpId}/proposal`; panel shows existing drafts list below RFP details
- [ ] T041 [P] [US1] Add cancel support to `proposal-draft` service: add `cancelDraft(draftId, orgId)` function that sets `status = 'error'` and `generationError = 'Cancelled by user'` only when draft is in `generating` state; add `DELETE /api/rfps/[rfpId]/proposals/[draftId]` route in `src/app/api/rfps/[rfpId]/proposals/[draftId]/route.ts` that calls `cancelDraft` and returns 200 (per Constitution Principle XIV — "Cancel is always available")
- [ ] T042 [P] [US1] Add "Cancel" button to `ProposalDraftPanel` component in `src/components/rfp/ProposalDraftPanel.tsx` — visible and enabled only when draft status is `generating`; calls `DELETE /api/rfps/[rfpId]/proposals/[draftId]`; on success transitions UI to show draft in `error` state with "Cancelled" label

**Checkpoint**: User Story 1 is fully functional. A user can generate a proposal draft from an RFP end-to-end and see the result in the UI.

---

## Phase 3: User Story 2 — Manage Proposal Content Library (Priority: P2)

**Goal**: All org members can create, view, edit, and delete reusable content library entries (pricing, services, standards, boilerplate). Library entries are available as context during proposal generation.

**Independent Test**: Create a content library entry via `POST /api/content-library`, verify it is returned by `GET /api/content-library`, verify it appears in a newly generated proposal when its category matches an RFP requirement, then delete it via `DELETE /api/content-library/{id}` and verify it no longer appears.

### Tests for User Story 2

> **Write these tests FIRST — they must FAIL before implementation begins**

- [X] T021 [P] [US2] Write unit tests for `proposal-content-library` service in `tests/unit/services/proposal-content-library.test.ts` — verify: `createEntry` persists correct fields and scopes to orgId; `listEntries` returns only current org's entries; `updateEntry` validates ownership; `deleteEntry` validates ownership; category filter works
- [X] T022 [P] [US2] Write integration tests for content library API in `tests/integration/api/content-library.test.ts` — verify: all CRUD endpoints return correct status codes, org scope enforced (403 on cross-org access), validation rejects empty category/name/content, list endpoint supports category filter query param

### Implementation for User Story 2

- [X] T023 [P] [US2] Implement `proposal-content-library` service in `src/lib/services/proposal-content-library.ts` — functions: `createEntry(orgId, userId, {category, name, content})`, `listEntries(orgId, categoryFilter?)`, `getEntry(id, orgId)`, `updateEntry(id, orgId, patch)`, `deleteEntry(id, orgId)`; all queries filter by `organizationId`
- [X] T024 [P] [US2] Implement `GET + POST /api/content-library` in `src/app/api/content-library/route.ts` — `GET`: calls `listEntries` with optional `?category=` query param, returns 200; `POST`: validates body with Zod (category/name/content required, maxLength enforced), calls `createEntry`, returns 201
- [X] T025 [P] [US2] Implement `GET + PATCH + DELETE /api/content-library/[entryId]` in `src/app/api/content-library/[entryId]/route.ts` — all endpoints validate org scope; `PATCH`: partial update with Zod validation; `DELETE`: returns 204
- [X] T026 [P] [US2] Create `ContentLibraryForm` component in `src/components/content-library/ContentLibraryForm.tsx` — handles both create (blank) and edit (pre-filled) modes; fields: category (text input with suggestions), name, content (textarea); client-side validation; save/cancel buttons; ARIA labels
- [X] T027 [P] [US2] Create `ContentLibraryList` component in `src/components/content-library/ContentLibraryList.tsx` — renders entries grouped by category; each row shows name, content preview, edit/delete actions; delete prompts for confirmation; calls `ContentLibraryForm` in a modal or inline for create/edit
- [X] T028 [US2] Create content library page in `src/app/(auth)/content-library/page.tsx` — fetches entries via `GET /api/content-library`, renders `ContentLibraryList`, includes "Add Entry" button that opens `ContentLibraryForm`, shows empty state when no entries exist
- [X] T029 [US2] Add "Content Library" navigation link to app sidebar/nav component (find the nav component in `src/components/` or `src/app/(auth)/layout.tsx`)

**Checkpoint**: User Story 2 is fully functional. Users can manage the content library independently of proposal generation. The library's entries feed into proposal generation (US1 integration occurs via the `proposal-writer` agent receiving library entries as context).

---

## Phase 4: User Story 3 — Refine and Export Proposal Draft (Priority: P3)

**Goal**: After a proposal is generated, the user can edit it inline and export a clean markdown file.

**Independent Test**: Generate a draft (US1), navigate to the draft editor, make a text change, save it, verify `GET .../proposals/{draftId}` returns the updated `markdownContent`, then `GET .../proposals/{draftId}/export` returns a downloadable `.md` file with the correct content and filename.

### Tests for User Story 3

> **Write these tests FIRST — they must FAIL before implementation begins**

- [X] T030 [P] [US3] Write unit tests for the export route in `tests/unit/api/proposals-export.test.ts` — verify: returns `text/markdown` content type, `Content-Disposition: attachment` header, filename includes RFP name, returns 422 when draft has no `markdownContent`, validates org scope

### Implementation for User Story 3

- [X] T031 [P] [US3] Create `ProposalEditor` component in `src/components/rfp/ProposalEditor.tsx` — textarea showing full `markdownContent`; "Save" button calls `PATCH .../proposals/{draftId}` with updated content; auto-save on blur (debounced 1s); shows saved/unsaved indicator; "Finalize" button sets status to `finalized`; warns on navigation with unsaved changes; ARIA labels and keyboard accessible
- [X] T032 [P] [US3] Add `PATCH` handler to `src/app/api/rfps/[rfpId]/proposals/[draftId]/route.ts` — validates draft is in `draft` or `finalized` state (rejects edits during `generating`), validates org scope, accepts `{ markdownContent?, status? }`, returns updated draft
- [X] T033 [P] [US3] Implement `GET /api/rfps/[rfpId]/proposals/[draftId]/export` in `src/app/api/rfps/[rfpId]/proposals/[draftId]/export/route.ts` — validates org scope, validates `markdownContent` is non-null, returns response with headers `Content-Type: text/markdown; charset=utf-8` and `Content-Disposition: attachment; filename="proposal-{rfp-name}.md"`
- [X] T034 [US3] Integrate `ProposalEditor` into proposal wizard page `src/app/(auth)/rfps/[rfpId]/proposal/page.tsx` — replace read-only markdown preview (from T019 Phase 3) with `ProposalEditor` once draft status is `draft`; thread draft ID and markdown content through to the component
- [X] T035 [US3] Add export button to proposal page `src/app/(auth)/rfps/[rfpId]/proposal/page.tsx` — button triggers `GET .../export` and initiates browser file download; disable button when status is not `draft` or `finalized`

**Checkpoint**: All three user stories are independently functional. Users can generate, edit, and export proposals. The content library feeds into generation.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: WCAG compliance, error resilience, and end-to-end integration verification.

- [ ] T036 [P] Audit and add ARIA labels, keyboard navigation, and focus management to `ClarifyingQuestionsForm`, `ProposalEditor`, and `ContentLibraryForm` per WCAG 2.1 AA — follow patterns in existing `ResponseCard` and `RfpEditor` components
- [ ] T037 [P] Add error boundary and generation-failed state to `ProposalDraftPanel` in `src/components/rfp/ProposalDraftPanel.tsx` — display `generationError` message when status is `error`; add "Retry" button that creates a new draft for the same RFP
- [ ] T038 Add integration smoke test verifying content library entries appear in generated proposal content — extend `tests/integration/api/proposals.test.ts` to seed content library entries before generation and assert they appear in the returned `markdownContent`
- [ ] T039 Run quickstart.md validation: apply migration, start Inngest dev server, add 3 content library entries, generate a proposal end-to-end, edit the draft, and export the file — document any issues found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 completion — BLOCKS if schema doesn't exist
- **Phase 3 (US2)**: Depends on Phase 1 only — can run in parallel with US1 after Phase 1
- **Phase 4 (US3)**: Depends on Phase 2 (US1) — needs the draft data model and editor hooks
- **Phase 5 (Polish)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 only. No dependency on US2 or US3.
- **US2 (P2)**: Depends on Phase 1 only. No dependency on US1 or US3. Can run concurrently with US1.
- **US3 (P3)**: Depends on US1 (needs proposal draft to exist and the `[draftId]/route.ts` file). Cannot start until US1 is complete.

### Within Each User Story

1. Write tests first (T006–T009, T021–T022, T030) — let them fail
2. Implement agents/services (T010–T012, T023) before endpoints
3. Implement endpoints (T014–T016, T024–T025, T032–T033) before UI
4. Implement UI components (T017–T018, T026–T027, T031) in parallel with endpoints
5. Wire pages (T019–T020, T028–T029, T034–T035) last, composing components

---

## Parallel Opportunities

### Phase 1 can start immediately
```
T001, T002 — run in parallel (different files)
T003 — after T001 and T002
T004 — after T003
T005 — after T004
```

### After Phase 1, US1 and US2 can run in parallel

**US1 parallel batch 1** (all independent):
```
T006, T007, T008, T009 — write tests in parallel
T010, T011 — implement agents in parallel
```

**US2 parallel batch 1** (can run concurrently with US1 batch 1):
```
T021, T022 — write tests in parallel
T023 — implement service
T024, T025, T026, T027 — endpoints and components in parallel
```

### US3 parallel batch (after US1 complete):
```
T030, T031, T032, T033 — tests, component, and endpoints in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: US1 (T006–T020)
3. **STOP and VALIDATE**: Generate a proposal end-to-end in the UI
4. Demo to stakeholders — this is the core value of the feature

### Incremental Delivery

1. Phase 1 → Foundation ready
2. US1 complete → Generate proposals (MVP demo)
3. US2 complete → Content library management; re-test generation with library entries present
4. US3 complete → Edit and export; full feature workflow verified
5. Polish → Production-ready

### Parallel Team Strategy

With two developers after Phase 1:
- **Developer A**: US1 (T006–T020) — proposal generation core flow
- **Developer B**: US2 (T021–T029) — content library CRUD
- After both complete: Developer A or B picks up US3 (T030–T035)

---

## Notes

- `[P]` marks tasks that touch different files with no shared in-progress dependencies
- `[Story]` label maps each task to its user story for traceability
- Constitution check: all 16 principles pass (see `plan.md`)
- Org scope enforcement is **non-negotiable** on every query (Principle I): always filter by `organizationId`
- All AI agent tests must mock LLM responses (Principle VI) — do not make live API calls in tests
- Migration (T004) must be committed before any service code is merged

---

## Summary

| Phase | Tasks | Stories |
|-------|-------|---------|
| Phase 1: Setup | T001–T005 | — |
| Phase 2: US1 (P1) | T006–T020, T040–T042 | US1 |
| Phase 3: US2 (P2) | T021–T029 | US2 |
| Phase 4: US3 (P3) | T030–T035 | US3 |
| Phase 5: Polish | T036–T039 | — |
| **Total** | **42 tasks** | **3 stories** |

**Parallel opportunities**: 23 tasks marked [P]
**Suggested MVP scope**: Phase 1 + Phase 2 (US1) — 23 tasks
