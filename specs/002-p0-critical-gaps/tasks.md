# Tasks: P0 Critical Gaps

**Input**: Design documents from `/specs/002-p0-critical-gaps/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the project constitution requires 80% coverage (Principle V) and integration tests for workflows (Principle VII).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install new dependencies and run schema migration

- [x] T001 Install `react-pdf` and `pdfjs-dist` dependencies via `npm install react-pdf pdfjs-dist --legacy-peer-deps`
- [x] T002 Add `completedFileError` column (nullable text) to rfps schema in `src/lib/db/schema/rfps.ts` and generate Drizzle migration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that multiple user stories depend on

**⚠️ CRITICAL**: US1 and US2 both need the document proxy route; US1 needs the Inngest function registered.

- [x] T003 Create document proxy route GET `/api/rfps/[rfpId]/document` in `src/app/api/rfps/[rfpId]/document/route.ts` — fetch original file from Vercel Blob, validate auth + org scope, return with correct Content-Type
- [x] T004 [P] Create stub file for `generate-completed-document` Inngest function at `src/lib/inngest/functions/generate-completed-document.ts` with empty exported function and register it in `src/app/api/inngest/route.ts` (full implementation in T009)
- [x] T005 [P] Unit test for document proxy route in `tests/unit/api/rfp-document.test.ts` — test auth, 404 when no file, correct content-type for PDF and DOCX

**Checkpoint**: Document proxy route working, Inngest registration ready

---

## Phase 3: User Story 1 — Format-Preserving Export (Priority: P1) 🎯 MVP

**Goal**: On RFP finalization, generate a filled PDF/Word document and make it downloadable

**Independent Test**: Finalize an RFP → verify `completedFileUrl` is populated → download returns the filled document

### Tests for User Story 1

- [x] T006 [P] [US1] Unit test for download route in `tests/unit/api/rfp-download.test.ts` — test auth, 302 redirect when completedFileUrl exists, 404 when null, include completedFileError in 404 body
- [x] T007 [P] [US1] Integration test for generate-completed-document Inngest function in `tests/integration/inngest/generate-completed-document.test.ts` — mock `generatePdfOutput`, `downloadFile`, `uploadRfpDocument`; verify RFP record updated with completedFileUrl on success, completedFileError on failure; include fidelity assertion: verify `generatePdfOutput` is called with correct field positions from responses and original file buffer
- [x] T008 [P] [US1] Integration test for finalize-to-download flow in `tests/integration/api/rfp-finalize-export.test.ts` — verify finalize route sends `rfp/generate-completed-document` Inngest event

### Implementation for User Story 1

- [x] T009 [US1] Create `generate-completed-document` Inngest function in `src/lib/inngest/functions/generate-completed-document.ts` — steps: fetch RFP, download original from Blob, fetch responses, call `generatePdfOutput()` or `generateWordOutput()`, upload result to Blob at `rfps/{orgId}/{rfpId}/completed.{ext}`, update RFP `completedFileUrl` (or `completedFileError` on failure)
- [x] T010 [US1] Create download route GET `/api/rfps/[rfpId]/download` in `src/app/api/rfps/[rfpId]/download/route.ts` — validate auth + org scope, return 302 redirect to `completedFileUrl` if set, 404 with `completedFileError` if not
- [x] T011 [US1] Modify finalize route in `src/app/api/rfps/[rfpId]/finalize/route.ts` to send `rfp/generate-completed-document` Inngest event after status update
- [x] T012 [US1] Add "Download Completed RFP" button to RFP detail page `src/app/(auth)/rfps/[id]/page.tsx` — show only when `status === 'finalized'`, disabled with "Generating..." text while `completedFileUrl` is null, enabled when URL available; poll for URL if null
- [x] T013 [US1] Add markdown fallback export button alongside the completed document button — always available for finalized RFPs regardless of document generation status

**Checkpoint**: Finalize an RFP → background job generates filled PDF/Word → download button works

---

## Phase 4: User Story 2 — Side-by-Side Document Review (Priority: P1)

**Goal**: Replace placeholder RFP detail page with split view: original document on left, response editor on right

**Independent Test**: Open any processed RFP → see original PDF/Word rendered on the left, response cards on the right

### Tests for User Story 2

- [x] T014 [P] [US2] Unit test for DocumentViewer component in `tests/unit/components/document-viewer.test.ts` — test PDF mode renders react-pdf Document/Page, Word mode renders mammoth HTML, loading state, error fallback to metadata list
- [x] T015 [P] [US2] Unit test for side-by-side layout in `tests/unit/components/rfp-editor-layout.test.ts` — test split view renders both panels, responsive stacking below `md:` breakpoint (768px)

### Implementation for User Story 2

- [x] T016 [US2] Create `DocumentViewer` component in `src/components/rfp/DocumentViewer.tsx` — use `next/dynamic` with `{ ssr: false }` for react-pdf; props: `documentUrl`, `documentType`, `activePage?`; PDF mode: `<Document>` + `<Page>` from react-pdf with page navigation; Word mode: fetch DOCX, convert to HTML via mammoth `convertToHtml()`, render in scrollable container; loading skeleton; error fallback shows current metadata-based `DocumentPreview`
- [x] T017 [US2] Configure pdf.js worker — copy worker file to `public/pdf.worker.min.mjs` or configure CDN URL in DocumentViewer; add `pdfjs.GlobalWorkerOptions.workerSrc` setup
- [x] T018 [US2] Refactor `RfpEditor` in `src/components/rfp/RfpEditor.tsx` to accept a `documentViewer` React node as the left panel instead of the current `DocumentPreview` component
- [x] T019 [US2] Update RFP detail page `src/app/(auth)/rfps/[id]/page.tsx` to pass `DocumentViewer` to `RfpEditor` with the RFP's `originalFileUrl` and `originalFileType`; fetch actual RFP data from API (replace placeholder `rfp` object)
- [x] T020 [US2] Add scroll-to-page interaction — when user clicks a response card, `DocumentViewer` scrolls to the page indicated by the response's `position.page` field; use `onItemClick` callback from RfpEditor to DocumentViewer
- [x] T021 [US2] Add ARIA labels and keyboard navigation to DocumentViewer — page navigation buttons need `aria-label`, PDF container needs `role="document"`, page count announced to screen readers

**Checkpoint**: Open processed RFP → original doc visible on left, responses on right, click response scrolls doc

---

## Phase 5: User Story 3 — End-Customer Profiles (Priority: P1)

**Goal**: Surface customer profiles with stats, settings, and RFP history in the UI

**Independent Test**: Navigate to /customers → see list → click customer → see detail with RFPs and KB entries

### Tests for User Story 3

- [x] T022 [P] [US3] Unit test for customer list page in `tests/unit/pages/customers-list.test.ts` — test renders customer rows with name, RFP count, KB count; handles empty state
- [x] T023 [P] [US3] Unit test for customer detail page in `tests/unit/pages/customer-detail.test.ts` — test renders profile, settings form, RFP history list, KB entries list

### Implementation for User Story 3

- [x] T024 [US3] Create customer list page `src/app/(auth)/customers/page.tsx` — fetch from GET `/api/customers`, display table with name, description, RFP count, KB entries count, created date; "New Customer" button (admin only); link each row to `/customers/[id]`
- [x] T025 [US3] Create customer detail page `src/app/(auth)/customers/[id]/page.tsx` — fetch from GET `/api/customers/[id]` (includes stats); sections: profile info (name, description), settings editor (preferredTone select, industryContext textarea, customInstructions textarea), RFP history (list of RFPs linked to this customer), KB entries (list with type badge)
- [x] T026 [US3] Create `CustomerSettingsForm` component in `src/components/customers/CustomerSettingsForm.tsx` — edit preferredTone (select: formal/casual/technical), industryContext (textarea, max 500), customInstructions (textarea, max 2000); save via PATCH `/api/customers/[id]`; admin-only editing
- [x] T027 [US3] Add "Customers" nav link to `src/app/(auth)/layout.tsx` — between existing nav items
- [x] T028 [US3] Add customer name column to dashboard RFP list — modify `src/app/(auth)/dashboard/page.tsx` to show customer name from RFP data
- [x] T029 [US3] Add customer filter dropdown to dashboard — filter RFP list by `customerId` query parameter
- [x] T030 [US3] Wire existing `CustomerSelector` component (`src/components/shared/CustomerSelector.tsx`) into RFP creation flow — add customer selection step when creating a new RFP, pass selected `customerId` to POST `/api/rfps`

**Checkpoint**: Navigate /customers → list with stats → detail page with settings + history → dashboard shows customer names

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories

- [x] T031 Add Suspense boundaries and loading skeletons for customer list and detail pages in `src/app/(auth)/customers/`
- [x] T032 [P] Add `beforeunload` warning on DocumentViewer if user has unsaved response edits
- [x] T033 [P] Ensure all new pages have proper `<title>` via Next.js metadata
- [x] T034 Run full test suite (`npm test`) and verify 80%+ coverage on new code
- [x] T035 Run TypeScript check (`npx tsc --noEmit`) and fix any type errors
- [x] T036 Run quickstart.md manual verification steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema migration must exist)
- **US1 (Phase 3)**: Depends on Phase 2 (needs Inngest registration + schema)
- **US2 (Phase 4)**: Depends on Phase 1 (needs react-pdf installed) + Phase 2 (needs document proxy)
- **US3 (Phase 5)**: Depends on Phase 1 only (schema migration for completeness) — can run in parallel with US1/US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Format Export)**: Independent — can start after Phase 2
- **US2 (Side-by-Side)**: Independent — can start after Phase 2; benefits from US1 download button but not required
- **US3 (Customer Profiles)**: Independent — can start after Phase 1; no dependency on US1 or US2

### Within Each User Story

- Tests written first, verify they fail
- Schema/model changes before services
- Services before routes
- Routes before UI
- UI before integration wiring

### Parallel Opportunities

**Phase 2**: T003, T004, T005 can all run in parallel

**US1**: T006, T007, T008 (tests) can run in parallel; T009, T010 can run in parallel after tests

**US2**: T014, T015 (tests) can run in parallel; T016, T017 can run in parallel

**US3**: T022, T023 (tests) can run in parallel; T024, T025, T026 can partially parallelize (different files)

**Cross-story**: US1, US2, and US3 can run in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Unit test for download route in tests/unit/api/rfp-download.test.ts"
Task: "Integration test for Inngest function in tests/integration/inngest/generate-completed-document.test.ts"
Task: "Integration test for finalize flow in tests/integration/api/rfp-finalize-export.test.ts"

# Then launch independent implementation tasks:
Task: "Create generate-completed-document Inngest function"
Task: "Create download route"
# (These touch different files and can run in parallel)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps, schema migration)
2. Complete Phase 2: Foundational (document proxy, Inngest registration)
3. Complete Phase 3: US1 — Format-Preserving Export
4. **STOP and VALIDATE**: Finalize an RFP → download filled PDF
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Format Export) → Test → Deploy (MVP!)
3. Add US2 (Side-by-Side) → Test → Deploy
4. Add US3 (Customer Profiles) → Test → Deploy
5. Polish phase → Final deploy

### Parallel Team Strategy

With multiple developers after Phase 2:
- Developer A: US1 (Format Export)
- Developer B: US2 (Side-by-Side Review)
- Developer C: US3 (Customer Profiles)
- Stories integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Existing code: `pdf-output.ts`, `word-output.ts`, customer API routes — these are already implemented, tasks wire them into the workflow
- `react-pdf` must use `next/dynamic({ ssr: false })` — it requires browser APIs
- `mammoth` is already a dependency — no install needed for Word preview
- All routes must enforce `organizationId` scoping (Constitution I)
