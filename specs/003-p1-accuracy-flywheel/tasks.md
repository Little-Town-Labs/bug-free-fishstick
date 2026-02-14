# Tasks: P1 — Accuracy Flywheel

**Input**: Design documents from `/specs/003-p1-accuracy-flywheel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the project constitution requires 80% coverage (Principle V) and integration tests for workflows (Principle VII).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Schema migrations and shared infrastructure for all user stories

- [x] T001 Add `rfpType`, `complexity`, `industryTags`, `suggestedAssigneeId` columns to `src/lib/db/schema/rfps.ts` and generate Drizzle migration
- [x] T002 [P] Add `embedding` vector(1536) column to `src/lib/db/schema/proposal-content-library.ts` and include in migration
- [x] T003 [P] Add `chunkIndex`, `totalChunks`, `sectionHeading`, `tags`, `sourceEntryId`, `processingStatus` columns to `src/lib/db/schema/knowledge-entries.ts` and include in migration
- [x] T004 [P] Add `fieldId`, `questionType`, `confidence` columns to `src/lib/db/schema/learnings.ts` and include in migration
- [x] T005 Register new Inngest event types (`rfp/capture-learning`, `content-library/generate-embedding`, `content-library/batch-embed`, `knowledge/chunk-document`) in `src/lib/inngest/client.ts`
- [x] T006 Update `tests/factories/index.ts` with new schema field defaults

**Checkpoint**: Schema migrations ready, event types registered, factories updated

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared services that multiple user stories depend on

- [x] T007 Create document chunking service in `src/lib/services/document-chunker.ts` — heading-based splitting with paragraph fallback, max 1500 tokens per chunk, 200-token overlap, returns array of `{ content, sectionHeading?, chunkIndex, totalChunks }`
- [x] T008 [P] Unit test for document chunker in `tests/unit/services/document-chunker.test.ts` — test heading split, paragraph fallback, token limits, overlap, short doc bypass
- [x] T009 [P] Create content library semantic search service in `src/lib/services/content-library-search.ts` — reuse `generateEmbedding()` pattern from vector-search, query `proposalContentLibrary` by cosine similarity, fallback to category filter if no embeddings

**Checkpoint**: Chunking and content search services ready for use by user stories

---

## Phase 3: User Story 1 — Customer-Specific AI Agents (Priority: P1) 🎯 MVP

**Goal**: AI responses reflect each customer's preferred tone, industry terminology, and past corrections

**Independent Test**: Process two RFPs for different customers with different settings → responses should reflect different tones

### Tests for User Story 1

- [x] T010 [P] [US1] Integration test for customer-aware response generation in `tests/integration/inngest/customer-context.test.ts` — mock LLM, verify customer settings (preferredTone, industryContext, customInstructions) appear in system prompt, verify per-customer learnings prioritized
- [x] T011 [P] [US1] Unit test for customer context injection in `tests/unit/ai/response-generator-context.test.ts` — verify `customerContext` param shapes the system prompt correctly

### Implementation for User Story 1

- [x] T012 [US1] Modify `src/lib/ai/agents/response-generator.ts` to accept `customerContext?: { preferredTone?, industryContext?, customInstructions? }` parameter and inject into system prompt
- [x] T013 [US1] Modify `src/lib/inngest/functions/process-rfp.ts` step 5 to fetch customer settings from DB and pass as `customerContext` to `generateResponses()`, prioritize customer-specific learnings over org-level
- [x] T014 [US1] Add read-only customer system prompt preview to customer settings page `src/app/(auth)/customers/[id]/page.tsx` — show the interpolated prompt template the AI would receive

**Checkpoint**: Process RFP for customer with settings → responses reflect tone/context

---

## Phase 4: User Story 2 — Real-Time Learning (Priority: P1)

**Goal**: Every accept, edit, and reject action contributes to the system's learning

**Independent Test**: Accept/edit/reject responses → verify learning entries created in DB → process next RFP → learnings in context

### Tests for User Story 2

- [x] T015 [P] [US2] Unit test for feedback API route in `tests/unit/api/feedback.test.ts` — test accept/edit/reject payloads, auth, 202 response, Inngest event sent
- [x] T016 [P] [US2] Integration test for capture-learning Inngest function in `tests/integration/inngest/capture-learning.test.ts` — test accept creates signal learning, edit creates correction learning with diff, reject creates rejection signal

### Implementation for User Story 2

- [x] T017 [US2] Create capture-learning Inngest function in `src/lib/inngest/functions/capture-learning.ts` — handle accept (insert `accept_signal`), edit (insert `edit_correction` with original→corrected diff), reject (insert `reject_signal`); include fieldId, questionType, confidence
- [x] T018 [US2] Register capture-learning function in `src/app/api/inngest/route.ts`
- [x] T019 [US2] Create feedback API route POST `/api/rfps/[rfpId]/responses/[fieldId]/feedback/route.ts` — validate auth + org scope, validate payload (type, originalText?, correctedText?), send `rfp/capture-learning` Inngest event, return 202
- [x] T020 [US2] Modify `src/components/rfp/ResponseCard.tsx` to fire feedback API call after accept/edit/reject actions — fire-and-forget fetch to feedback endpoint, no UI blocking
- [x] T021 [US2] Add learning count to customer profile stats in `src/app/(auth)/customers/[id]/page.tsx` — fetch learning count from existing `/api/learnings?customerId=` endpoint, display in stats card

**Checkpoint**: Accept/edit/reject on ResponseCard → learning events captured → visible in customer stats

---

## Phase 5: User Story 3 — Auto-Classification & Routing (Priority: P1)

**Goal**: Incoming RFPs automatically classified by type and complexity, with suggested assignee

**Independent Test**: Process an RFP → classification badge visible on detail page → suggested assignee shown → filterable on dashboard

### Tests for User Story 3

- [x] T022 [P] [US3] Unit test for classification agent in `tests/unit/ai/rfp-classifier.test.ts` — mock LLM, verify structured output with rfpType, complexity, industryTags; test Zod validation of output
- [x] T023 [P] [US3] Unit test for assignee suggestion in `tests/unit/services/rfp-classifier.test.ts` — test scoring algorithm (past assignments, workload), test empty org returns null
- [x] T024 [P] [US3] Unit test for assign route in `tests/unit/api/assign.test.ts` — test auth, admin-only, successful assignment update

### Implementation for User Story 3

- [x] T025 [US3] Create classification AI agent in `src/lib/ai/agents/rfp-classifier.ts` — takes parsed document structure + field summaries, returns Zod-validated `{ rfpType, complexity, industryTags }` using AI SDK structured output
- [x] T026 [US3] Create assignee suggestion service in `src/lib/services/rfp-classifier.ts` — query past RFP assignments by type, count in-progress RFPs per user, score and return top suggestion
- [x] T027 [US3] Modify `src/lib/inngest/functions/process-rfp.ts` to add classify step between step 4 (analyze) and step 5 (generate) — call classification agent, run assignee suggestion, update RFP record with rfpType, complexity, industryTags, suggestedAssigneeId
- [x] T028 [US3] Create assign API route POST `/api/rfps/[rfpId]/assign/route.ts` — admin-only, validate auth + org scope, update `assignedUserId` on RFP
- [x] T029 [US3] Create `ClassificationBadge` component in `src/components/rfp/ClassificationBadge.tsx` — displays rfpType + complexity as colored badges
- [x] T030 [US3] Create `AssignmentSuggestion` component in `src/components/rfp/AssignmentSuggestion.tsx` — shows suggested assignee with accept/override buttons, calls assign API
- [x] T031 [US3] Add classification badges and assignment to RFP detail page `src/app/(auth)/rfps/[id]/page.tsx`
- [x] T032 [US3] Add type and complexity filter dropdowns to dashboard `src/app/(auth)/dashboard/page.tsx` — filter RFP list by `rfpType` and `complexity` client-side filters

**Checkpoint**: Process RFP → classification + suggested assignee → visible on detail page → dashboard filters work

---

## Phase 6: User Story 4 — Smart Content Library Matching (Priority: P1)

**Goal**: Content library automatically surfaces most relevant entries for each RFP section

**Independent Test**: Create content library entries → trigger batch embed → start proposal → see ranked entries with relevance scores

### Tests for User Story 4

- [ ] T033 [P] [US4] Unit test for content library search in `tests/unit/services/content-library-search.test.ts` — test vector search with mock embeddings, test category fallback when no embeddings
- [ ] T034 [P] [US4] Integration test for content library embedding Inngest function in `tests/integration/inngest/content-library-embedding.test.ts` — test single entry embedding, test batch fan-out

### Implementation for User Story 4

- [ ] T035 [US4] Create content library embedding Inngest functions in `src/lib/inngest/functions/content-library-embedding.ts` — `generate-embedding` (single entry) and `batch-embed` (fan-out for all unembedded entries in org)
- [ ] T036 [US4] Register content library embedding functions in `src/app/api/inngest/route.ts`
- [ ] T037 [US4] Create batch embed API route POST `/api/content-library/embed/route.ts` — admin-only, count unembedded entries, send `content-library/batch-embed` event, return 202 with count
- [ ] T038 [US4] Create semantic search API route GET `/api/content-library/search/route.ts` — validate auth, call `contentLibrarySearch()`, return entries with similarity scores
- [ ] T039 [US4] Modify `src/lib/services/proposal-content-library.ts` to send `content-library/generate-embedding` event on create/update
- [ ] T040 [US4] Modify `src/lib/ai/agents/proposal-writer.ts` to accept ranked entries with relevance scores, use top-N (default 5) in prompt context instead of all entries
- [ ] T041 [US4] Modify proposal generation flow in `src/lib/inngest/functions/generate-proposal.ts` to use semantic search for content library entries (query = RFP name + section context), fallback to `listEntries()` if no embeddings

**Checkpoint**: Content library entries embedded → proposal generation uses ranked entries → relevance scores visible

---

## Phase 7: User Story 5 — Auto-Index KB Uploads (Priority: P1)

**Goal**: Uploaded documents automatically chunked, tagged, and indexed as separate knowledge entries

**Independent Test**: Upload multi-page PDF → see multiple chunked entries with tags → semantic search finds relevant chunk

### Tests for User Story 5

- [ ] T042 [P] [US5] Integration test for chunk-document Inngest function in `tests/integration/inngest/chunk-document.test.ts` — test long doc creates multiple entries with chunkIndex/totalChunks, test short doc bypasses chunking, test auto-tagging
- [ ] T043 [P] [US5] Unit test for processing status component in `tests/unit/components/processing-status.test.ts` — test pending/chunking/embedding/complete/error states

### Implementation for User Story 5

- [ ] T044 [US5] Create chunk-document Inngest function in `src/lib/inngest/functions/chunk-document.ts` — fetch parent entry, chunk via `documentChunker`, insert child entries with sourceEntryId/chunkIndex/totalChunks/sectionHeading, auto-tag each chunk (LLM call), fan out `rfp/generate-embeddings` for each chunk, update parent processingStatus
- [ ] T045 [US5] Register chunk-document function in `src/app/api/inngest/route.ts`
- [ ] T046 [US5] Modify KB upload route `src/app/api/customers/[customerId]/knowledge/upload/route.ts` — after creating entry, if content > 2000 tokens, send `knowledge/chunk-document` event and set `processingStatus: 'pending'`; otherwise keep existing flow
- [ ] T047 [US5] Create `ProcessingStatus` component in `src/components/knowledge/ProcessingStatus.tsx` — display status badge (pending → chunking → embedding → complete → error) with appropriate colors and ARIA labels
- [ ] T048 [US5] Update `KnowledgeEntryCard` component to show `ProcessingStatus` when `processingStatus !== 'complete'`, and show chunk count + tags when available
- [ ] T049 [US5] Add polling for processing status on customer knowledge page `src/app/(auth)/customers/[id]/page.tsx` — poll entries with non-complete status every 5s until all complete

**Checkpoint**: Upload multi-page PDF → processing status visible → multiple entries created → searchable by content

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories

- [ ] T050 Run full test suite (`npm test`) and verify 80%+ coverage on new code
- [ ] T051 [P] Run TypeScript check (`npx tsc --noEmit`) and fix any type errors
- [ ] T052 [P] Verify all new UI components have ARIA labels and keyboard navigation
- [ ] T053 Run quickstart.md manual verification steps for all 5 user stories
- [ ] T054 Verify Inngest event registration — all new functions appear in Inngest dev dashboard

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema must exist for chunker tests)
- **US1 (Phase 3)**: Depends on Phase 1 (schema) — no dependency on Phase 2
- **US2 (Phase 4)**: Depends on Phase 1 (learnings schema changes)
- **US3 (Phase 5)**: Depends on Phase 1 (rfps schema changes)
- **US4 (Phase 6)**: Depends on Phase 1 (content library schema) + Phase 2 (content-library-search service)
- **US5 (Phase 7)**: Depends on Phase 1 (knowledge-entries schema) + Phase 2 (document-chunker service)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Customer AI)**: Independent — can start after Phase 1
- **US2 (Real-Time Learning)**: Independent — can start after Phase 1
- **US3 (Auto-Classification)**: Independent — can start after Phase 1
- **US4 (Smart Content Library)**: Depends on Phase 2 (`content-library-search.ts`)
- **US5 (Auto-Index KB)**: Depends on Phase 2 (`document-chunker.ts`)

### Within Each User Story

- Tests written first, verify they fail
- Schema/model changes before services
- Services before routes
- Routes before UI
- UI before integration wiring

### Parallel Opportunities

**Phase 1**: T002, T003, T004 can all run in parallel (different schema files)

**Phase 2**: T008, T009 can run in parallel (different service files)

**US1-US3**: Can all run in parallel after Phase 1 (different files, no cross-dependencies)

**US4-US5**: Can run in parallel after Phase 2 (different files)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + events)
2. Complete Phase 3: US1 — Customer-Specific AI Agents
3. **STOP and VALIDATE**: Process RFP with customer settings → verify personalized responses
4. Deploy/demo if ready

### Incremental Delivery

1. Setup → Schema and events ready
2. Foundational → Chunker + content search services ready
3. US1 (Customer AI) → Test → Deploy (MVP!)
4. US2 (Real-Time Learning) → Test → Deploy
5. US3 (Auto-Classification) → Test → Deploy
6. US4 (Smart Content Library) → Test → Deploy
7. US5 (Auto-Index KB) → Test → Deploy
8. Polish → Final deploy

### Parallel Team Strategy

After Phase 1+2:
- Developer A: US1 (Customer AI) + US2 (Real-Time Learning)
- Developer B: US3 (Auto-Classification)
- Developer C: US4 (Smart Content Library) + US5 (Auto-Index KB)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new npm packages — all features use existing Inngest, pgvector, AI SDK
- Reuse existing `generateEmbedding()` from `src/lib/ai/embeddings.ts` for content library
- Reuse existing `searchSimilar()` pattern from `src/lib/services/vector-search.ts`
- All routes must enforce `organizationId` scoping (Constitution I)
- Learning capture is always async via Inngest — never block UI actions
- Content library embedding fallback: category filter if no embeddings exist
- Document chunking: heading-based → paragraph → sentence, max 1500 tokens, 200-token overlap
