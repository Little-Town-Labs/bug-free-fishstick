# Tasks: RFP Automation Core Platform

**Input**: Design documents from `/specs/001-rfp-automation-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Methodology**: Test-Driven Development (TDD)
- Write tests FIRST - they must FAIL before implementation
- Implement minimal code to make tests pass
- Refactor while keeping tests green
- Target: 80%+ code coverage

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md: Next.js monorepo with `src/` at repository root
- Source: `src/`
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, testing infrastructure, and basic structure

- [x] T001 Initialize Next.js 15 project with TypeScript strict mode in package.json
- [x] T002 [P] Configure Tailwind CSS in tailwind.config.ts
- [x] T003 [P] Configure ESLint and Prettier in .eslintrc.js and .prettierrc
- [x] T004 [P] Create tsconfig.json with strict mode and path aliases
- [x] T005 Install core dependencies: React 18, shadcn/ui, React Hook Form, Zod, Zustand in package.json
- [x] T006 [P] Create src/app/layout.tsx with providers structure
- [x] T007 [P] Create src/app/globals.css with Tailwind imports
- [x] T008 [P] Install shadcn/ui and initialize components in src/components/ui/

### Testing Infrastructure

- [x] T009 [P] Install Vitest and configure vitest.config.ts with coverage thresholds (80%)
- [x] T010 [P] Install Playwright and configure playwright.config.ts for E2E tests
- [x] T011 [P] Install MSW (Mock Service Worker) for API mocking in tests/mocks/
- [x] T012 [P] Create test utilities and helpers in tests/utils/test-helpers.ts
- [x] T013 [P] Create mock factories for test data in tests/factories/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Database & ORM - Tests First

- [ ] T014 [P] Write unit tests for Drizzle schema validations in tests/unit/db/schema.test.ts
- [ ] T015 Install Drizzle ORM and configure drizzle.config.ts for Neon PostgreSQL
- [ ] T016 Create database client in src/lib/db/index.ts with Neon connection
- [ ] T017 [P] Create tenant_settings schema in src/lib/db/schema/tenant-settings.ts
- [ ] T018 [P] Create customers schema in src/lib/db/schema/customers.ts
- [ ] T019 [P] Create knowledge_entries schema with pgvector in src/lib/db/schema/knowledge-entries.ts
- [ ] T020 [P] Create rfps schema in src/lib/db/schema/rfps.ts
- [ ] T021 [P] Create rfp_responses schema in src/lib/db/schema/rfp-responses.ts
- [ ] T022 [P] Create rfp_versions schema in src/lib/db/schema/rfp-versions.ts
- [ ] T023 [P] Create learnings schema in src/lib/db/schema/learnings.ts
- [ ] T024 Create schema index file exporting all tables in src/lib/db/schema/index.ts
- [ ] T025 Generate initial database migration with Drizzle in src/lib/db/migrations/

### Authentication & Multi-tenancy - Tests First

- [ ] T026 [P] Write unit tests for auth utilities in tests/unit/utils/auth.test.ts
- [ ] T027 Install and configure Clerk in src/middleware.ts
- [ ] T028 [P] Create Clerk provider wrapper in src/app/layout.tsx
- [ ] T029 [P] Create auth utilities with tenant context extraction in src/lib/utils/auth.ts
- [ ] T030 [P] Write integration test for Clerk webhook in tests/integration/webhooks/clerk.test.ts
- [ ] T031 Create Clerk webhook handler for organization sync in src/app/api/webhooks/clerk/route.ts
- [ ] T032 [P] Create sign-in page in src/app/(public)/sign-in/[[...sign-in]]/page.tsx

### Validation & Types - Tests First

- [ ] T033 [P] Write unit tests for Zod validation schemas in tests/unit/utils/validation.test.ts
- [ ] T034 [P] Create Zod validation schemas in src/lib/utils/validation.ts
- [ ] T035 [P] Create RFP TypeScript types in src/types/rfp.ts
- [ ] T036 [P] Create Knowledge TypeScript types in src/types/knowledge.ts
- [ ] T037 [P] Create API response types in src/types/api.ts

### Storage & Background Jobs - Tests First

- [ ] T038 [P] Write unit tests for Vercel Blob wrapper in tests/unit/storage/blob.test.ts
- [ ] T039 [P] Write unit tests for Vercel KV client in tests/unit/storage/kv.test.ts
- [ ] T040 [P] Configure Vercel Blob wrapper in src/lib/storage/blob.ts
- [ ] T041 [P] Configure Vercel KV client in src/lib/storage/kv.ts
- [ ] T042 Install and configure Inngest client in src/lib/inngest/client.ts
- [ ] T043 Create Inngest webhook handler in src/app/api/inngest/route.ts

### AI Infrastructure - Tests First

- [ ] T044 [P] Write unit tests for LLM provider abstraction in tests/unit/ai/providers.test.ts
- [ ] T045 [P] Write unit tests for embedding generation in tests/unit/ai/embeddings.test.ts
- [ ] T046 [P] Create LLM provider abstraction with Vercel AI SDK in src/lib/ai/providers.ts
- [ ] T047 [P] Create embedding generation utility in src/lib/ai/embeddings.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Upload and Auto-Complete RFP (Priority: P1)

**Goal**: Users can upload RFP documents, trigger AI auto-completion, and export completed documents with preserved formatting

**Independent Test**: Upload a sample PDF RFP, trigger AI processing, verify fields are populated with responses and confidence scores, export completed document

### Tests for US1 - Write FIRST, Must FAIL

- [ ] T048 [P] [US1] Write unit tests for PDF parser in tests/unit/documents/pdf-parser.test.ts
- [ ] T049 [P] [US1] Write unit tests for Word parser in tests/unit/documents/word-parser.test.ts
- [ ] T050 [P] [US1] Write unit tests for PDF output generator in tests/unit/documents/pdf-output.test.ts
- [ ] T051 [P] [US1] Write unit tests for Word output generator in tests/unit/documents/word-output.test.ts
- [ ] T052 [P] [US1] Write unit tests for document analyzer agent in tests/unit/ai/agents/document-analyzer.test.ts
- [ ] T053 [P] [US1] Write unit tests for response generator agent in tests/unit/ai/agents/response-generator.test.ts
- [ ] T054 [P] [US1] Write unit tests for quality checker agent in tests/unit/ai/agents/quality-checker.test.ts
- [ ] T055 [P] [US1] Write contract tests for RFP API routes in tests/integration/api/rfps.test.ts
- [ ] T056 [P] [US1] Write integration test for process-rfp workflow in tests/integration/inngest/process-rfp.test.ts
- [ ] T057 [US1] Write E2E test for RFP upload and processing flow in tests/e2e/rfp-workflow.spec.ts

### Document Processing Implementation (US1)

- [ ] T058 [P] [US1] Create PDF parser using pdf-parse in src/lib/documents/pdf-parser.ts
- [ ] T059 [P] [US1] Create Word parser using mammoth in src/lib/documents/word-parser.ts
- [ ] T060 [P] [US1] Create PDF output generator with overlay using pdf-lib in src/lib/documents/pdf-output.ts
- [ ] T061 [P] [US1] Create Word output generator using docx in src/lib/documents/word-output.ts

### AI Agents Implementation (US1)

- [ ] T062 [P] [US1] Create document analyzer agent in src/lib/ai/agents/document-analyzer.ts
- [ ] T063 [P] [US1] Create response generator agent in src/lib/ai/agents/response-generator.ts
- [ ] T064 [P] [US1] Create quality checker agent in src/lib/ai/agents/quality-checker.ts

### Inngest Functions Implementation (US1)

- [ ] T065 [US1] Create process-rfp Inngest function with multi-step workflow in src/lib/inngest/functions/process-rfp.ts
- [ ] T066 [P] [US1] Create export-document Inngest function in src/lib/inngest/functions/export-document.ts

### API Routes Implementation (US1)

- [ ] T067 [P] [US1] Create RFP list/create API route in src/app/api/rfps/route.ts
- [ ] T068 [P] [US1] Create RFP get/update/delete API route in src/app/api/rfps/[rfpId]/route.ts
- [ ] T069 [P] [US1] Create RFP document upload API route in src/app/api/rfps/[rfpId]/upload/route.ts
- [ ] T070 [P] [US1] Create RFP process trigger API route in src/app/api/rfps/[rfpId]/process/route.ts
- [ ] T071 [P] [US1] Create RFP processing status API route in src/app/api/rfps/[rfpId]/status/route.ts
- [ ] T072 [P] [US1] Create RFP responses list API route in src/app/api/rfps/[rfpId]/responses/route.ts
- [ ] T073 [P] [US1] Create RFP response update API route in src/app/api/rfps/[rfpId]/responses/[fieldId]/route.ts
- [ ] T074 [P] [US1] Create RFP download API route in src/app/api/rfps/[rfpId]/download/route.ts

### UI Components Implementation (US1)

- [ ] T075 [P] [US1] Write component tests for DocumentPreview in tests/unit/components/rfp/DocumentPreview.test.tsx
- [ ] T076 [P] [US1] Write component tests for ResponseCard in tests/unit/components/rfp/ResponseCard.test.tsx
- [ ] T077 [P] [US1] Create DocumentPreview component in src/components/rfp/DocumentPreview.tsx
- [ ] T078 [P] [US1] Create ResponseCard component with confidence indicator in src/components/rfp/ResponseCard.tsx
- [ ] T079 [P] [US1] Create ProgressTracker component in src/components/rfp/ProgressTracker.tsx
- [ ] T080 [US1] Create RfpEditor side-by-side editing interface in src/components/rfp/RfpEditor.tsx

### Pages Implementation (US1)

- [ ] T081 [P] [US1] Create dashboard page in src/app/(auth)/dashboard/page.tsx
- [ ] T082 [P] [US1] Create new RFP wizard page in src/app/(auth)/rfps/new/page.tsx
- [ ] T083 [US1] Create RFP detail/edit page in src/app/(auth)/rfps/[id]/page.tsx

### Hooks Implementation (US1)

- [ ] T084 [P] [US1] Write unit tests for useRfp hook in tests/unit/hooks/use-rfp.test.ts
- [ ] T085 [P] [US1] Create useRfp hook for RFP data fetching in src/hooks/use-rfp.ts
- [ ] T086 [P] [US1] Create useProcessingStatus hook for polling in src/hooks/use-processing-status.ts

**Checkpoint**: User Story 1 complete - verify all tests pass, run E2E test

---

## Phase 4: User Story 2 - Build and Manage Knowledge Base (Priority: P1)

**Goal**: Admin users can upload documents to build a customer-specific knowledge base that powers AI auto-completion

**Independent Test**: Upload documents to knowledge base, verify content is extracted and indexed, perform semantic search and verify relevant results

### Tests for US2 - Write FIRST, Must FAIL

- [ ] T087 [P] [US2] Write unit tests for vector search service in tests/unit/services/vector-search.test.ts
- [ ] T088 [P] [US2] Write contract tests for customer API routes in tests/integration/api/customers.test.ts
- [ ] T089 [P] [US2] Write contract tests for knowledge API routes in tests/integration/api/knowledge.test.ts
- [ ] T090 [P] [US2] Write integration test for generate-embeddings workflow in tests/integration/inngest/generate-embeddings.test.ts
- [ ] T091 [US2] Write E2E test for knowledge base management in tests/e2e/knowledge-base.spec.ts

### Inngest Functions Implementation (US2)

- [ ] T092 [US2] Create generate-embeddings Inngest function in src/lib/inngest/functions/generate-embeddings.ts

### Services Implementation (US2)

- [ ] T093 [US2] Create vector search service in src/lib/services/vector-search.ts

### API Routes Implementation (US2)

- [ ] T094 [P] [US2] Create customer list/create API route in src/app/api/customers/route.ts
- [ ] T095 [P] [US2] Create customer get/update/delete API route in src/app/api/customers/[customerId]/route.ts
- [ ] T096 [P] [US2] Create knowledge entries list/create API route in src/app/api/customers/[customerId]/knowledge/route.ts
- [ ] T097 [P] [US2] Create knowledge document upload API route in src/app/api/customers/[customerId]/knowledge/upload/route.ts
- [ ] T098 [P] [US2] Create knowledge semantic search API route in src/app/api/customers/[customerId]/knowledge/search/route.ts
- [ ] T099 [P] [US2] Create knowledge entry get/delete API route in src/app/api/customers/[customerId]/knowledge/[entryId]/route.ts

### UI Components Implementation (US2)

- [ ] T100 [P] [US2] Write component tests for KnowledgeUploader in tests/unit/components/knowledge/KnowledgeUploader.test.tsx
- [ ] T101 [P] [US2] Create KnowledgeEntryCard component in src/components/knowledge/KnowledgeEntryCard.tsx
- [ ] T102 [P] [US2] Create KnowledgeUploader component in src/components/knowledge/KnowledgeUploader.tsx
- [ ] T103 [P] [US2] Create KnowledgeSearch component in src/components/knowledge/KnowledgeSearch.tsx
- [ ] T104 [P] [US2] Create CustomerSelector component in src/components/shared/CustomerSelector.tsx

### Pages Implementation (US2)

- [ ] T105 [P] [US2] Create customers list page in src/app/(auth)/customers/page.tsx
- [ ] T106 [P] [US2] Create customer detail page in src/app/(auth)/customers/[id]/page.tsx
- [ ] T107 [US2] Create knowledge base management page in src/app/(auth)/knowledge/page.tsx

### Hooks Implementation (US2)

- [ ] T108 [US2] Write unit tests for useKnowledgeSearch in tests/unit/hooks/use-knowledge-search.test.ts
- [ ] T109 [US2] Create useKnowledgeSearch hook for semantic search in src/hooks/use-knowledge-search.ts

**Checkpoint**: User Story 2 complete - verify all tests pass, run E2E test

---

## Phase 5: User Story 3 - Review and Edit AI Responses (Priority: P1)

**Goal**: Users can review AI-generated responses in a side-by-side interface, accept/edit/reject suggestions, with real-time completion tracking

**Independent Test**: Load a partially completed RFP, make edits to responses, verify changes auto-save and completion percentage updates

### Tests for US3 - Write FIRST, Must FAIL

- [ ] T110 [P] [US3] Write component tests for ConfidenceIndicator in tests/unit/components/rfp/ConfidenceIndicator.test.tsx
- [ ] T111 [P] [US3] Write component tests for ResponseActions in tests/unit/components/rfp/ResponseActions.test.tsx
- [ ] T112 [P] [US3] Write integration tests for auto-save behavior in tests/integration/api/response-autosave.test.ts
- [ ] T113 [US3] Write E2E test for response editing workflow in tests/e2e/response-editing.spec.ts

### UI Components Implementation (US3)

- [ ] T114 [P] [US3] Create ConfidenceIndicator component in src/components/rfp/ConfidenceIndicator.tsx
- [ ] T115 [P] [US3] Create ResponseActions component (accept/edit/reject) in src/components/rfp/ResponseActions.tsx
- [ ] T116 [P] [US3] Create CompletionProgress component in src/components/rfp/CompletionProgress.tsx
- [ ] T117 [US3] Enhance RfpEditor with auto-save and optimistic updates in src/components/rfp/RfpEditor.tsx

### API Enhancements Implementation (US3)

- [ ] T118 [US3] Add auto-save debouncing to response update API in src/app/api/rfps/[rfpId]/responses/[fieldId]/route.ts
- [ ] T119 [US3] Add completion percentage calculation to RFP status endpoint in src/app/api/rfps/[rfpId]/status/route.ts

**Checkpoint**: User Story 3 complete - verify all tests pass, run E2E test

---

## Phase 6: User Story 4 - Submit for Approval and Finalize (Priority: P2)

**Goal**: Users can submit completed RFPs for admin review, admins can approve/return/finalize, finalized RFPs are locked

**Independent Test**: Submit a completed RFP, have admin approve it, verify document is locked when finalized

### Tests for US4 - Write FIRST, Must FAIL

- [ ] T120 [P] [US4] Write unit tests for workflow state transitions in tests/unit/services/rfp-workflow.test.ts
- [ ] T121 [P] [US4] Write unit tests for version snapshot creation in tests/unit/services/rfp-versions.test.ts
- [ ] T122 [P] [US4] Write contract tests for workflow API routes in tests/integration/api/rfp-workflow.test.ts
- [ ] T123 [US4] Write E2E test for approval workflow in tests/e2e/approval-workflow.spec.ts

### Service Logic Implementation (US4)

- [ ] T124 [US4] Implement RFP state transition validation in src/lib/services/rfp-workflow.ts
- [ ] T125 [US4] Implement version snapshot creation on finalize in src/lib/services/rfp-versions.ts

### API Routes Implementation (US4)

- [ ] T126 [P] [US4] Create RFP submit for review API route in src/app/api/rfps/[rfpId]/submit/route.ts
- [ ] T127 [P] [US4] Create RFP approve API route (admin only) in src/app/api/rfps/[rfpId]/approve/route.ts
- [ ] T128 [P] [US4] Create RFP return API route (admin only) in src/app/api/rfps/[rfpId]/return/route.ts
- [ ] T129 [P] [US4] Create RFP finalize API route (admin only) in src/app/api/rfps/[rfpId]/finalize/route.ts
- [ ] T130 [P] [US4] Create RFP versions list API route in src/app/api/rfps/[rfpId]/versions/route.ts

### UI Components Implementation (US4)

- [ ] T131 [P] [US4] Write component tests for WorkflowStatusBadge in tests/unit/components/rfp/WorkflowStatusBadge.test.tsx
- [ ] T132 [P] [US4] Create WorkflowStatusBadge component in src/components/rfp/WorkflowStatusBadge.tsx
- [ ] T133 [P] [US4] Create ApprovalActions component in src/components/rfp/ApprovalActions.tsx
- [ ] T134 [P] [US4] Create VersionHistory component in src/components/rfp/VersionHistory.tsx
- [ ] T135 [US4] Create ReturnComments dialog component in src/components/rfp/ReturnComments.tsx

**Checkpoint**: User Story 4 complete - verify all tests pass, run E2E test

---

## Phase 7: User Story 5 - Manage Users and Permissions (Priority: P2)

**Goal**: Admins can invite users, assign roles, users see only assigned RFPs

**Independent Test**: Invite a user, assign them an RFP, verify they only see their assigned work

### Tests for US5 - Write FIRST, Must FAIL

- [ ] T136 [P] [US5] Write integration tests for role-based RFP filtering in tests/integration/api/rfp-permissions.test.ts
- [ ] T137 [US5] Write E2E test for user management workflow in tests/e2e/user-management.spec.ts

### UI Components Implementation (US5)

- [ ] T138 [P] [US5] Create UserInviteForm component in src/components/settings/UserInviteForm.tsx
- [ ] T139 [P] [US5] Create UserList component in src/components/settings/UserList.tsx
- [ ] T140 [P] [US5] Create RoleSelector component in src/components/settings/RoleSelector.tsx
- [ ] T141 [P] [US5] Create RfpAssignment component in src/components/rfp/RfpAssignment.tsx

### Pages Implementation (US5)

- [ ] T142 [US5] Create settings page with user management in src/app/(auth)/settings/page.tsx
- [ ] T143 [US5] Create users management tab in src/app/(auth)/settings/users/page.tsx

### API Enhancements Implementation (US5)

- [ ] T144 [US5] Add role-based filtering to RFP list API (users see only assigned) in src/app/api/rfps/route.ts
- [ ] T145 [US5] Add RFP assignment update endpoint in src/app/api/rfps/[rfpId]/route.ts

**Checkpoint**: User Story 5 complete - verify all tests pass, run E2E test

---

## Phase 8: User Story 6 - Configure LLM Provider (Priority: P3)

**Goal**: Tenant admins can configure their preferred LLM provider (Claude, GPT, Azure) with encrypted API keys

**Independent Test**: Configure API credentials, trigger an AI operation, verify correct provider is used

### Tests for US6 - Write FIRST, Must FAIL

- [ ] T146 [P] [US6] Write unit tests for API key encryption in tests/unit/services/encryption.test.ts
- [ ] T147 [P] [US6] Write contract tests for settings API in tests/integration/api/settings.test.ts
- [ ] T148 [US6] Write E2E test for LLM configuration in tests/e2e/llm-configuration.spec.ts

### Service Logic Implementation (US6)

- [ ] T149 [US6] Implement API key encryption/decryption in src/lib/services/encryption.ts
- [ ] T150 [US6] Update LLM provider abstraction to read tenant settings in src/lib/ai/providers.ts

### API Routes Implementation (US6)

- [ ] T151 [P] [US6] Create tenant settings get API route in src/app/api/settings/route.ts
- [ ] T152 [US6] Create tenant settings update API route with key encryption in src/app/api/settings/route.ts

### UI Components Implementation (US6)

- [ ] T153 [P] [US6] Create LlmProviderSelector component in src/components/settings/LlmProviderSelector.tsx
- [ ] T154 [P] [US6] Create ApiKeyInput component with masking in src/components/settings/ApiKeyInput.tsx
- [ ] T155 [US6] Create SettingsForm component in src/components/settings/SettingsForm.tsx

**Checkpoint**: User Story 6 complete - verify all tests pass, run E2E test

---

## Phase 9: User Story 7 - Learn from Completed RFPs (Priority: P3)

**Goal**: System learns from approved RFPs and user corrections to improve future auto-completion accuracy

**Independent Test**: Approve an RFP, process a similar new RFP, verify improved response accuracy

### Tests for US7 - Write FIRST, Must FAIL

- [ ] T156 [P] [US7] Write unit tests for learning capture service in tests/unit/services/learning-capture.test.ts
- [ ] T157 [P] [US7] Write integration test for extract-learnings workflow in tests/integration/inngest/extract-learnings.test.ts
- [ ] T158 [P] [US7] Write contract tests for learnings API in tests/integration/api/learnings.test.ts
- [ ] T159 [US7] Write E2E test for learning system in tests/e2e/learning-system.spec.ts

### Service Logic Implementation (US7)

- [ ] T160 [US7] Implement correction capture on response edit in src/lib/services/learning-capture.ts
- [ ] T161 [US7] Enhance response generator to incorporate learnings in src/lib/ai/agents/response-generator.ts

### Inngest Functions Implementation (US7)

- [ ] T162 [US7] Create extract-learnings Inngest function triggered on RFP approval in src/lib/inngest/functions/extract-learnings.ts

### API Routes Implementation (US7)

- [ ] T163 [P] [US7] Create learnings list/create API route in src/app/api/learnings/route.ts

### UI Components Implementation (US7)

- [ ] T164 [P] [US7] Create LearningEntry component in src/components/knowledge/LearningEntry.tsx
- [ ] T165 [P] [US7] Create ManualLearningForm component in src/components/knowledge/ManualLearningForm.tsx
- [ ] T166 [US7] Create LearningsPanel component in src/components/knowledge/LearningsPanel.tsx

**Checkpoint**: User Story 7 complete - verify all tests pass, run E2E test

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final tests, coverage verification, and improvements that affect multiple user stories

### Coverage Verification

- [ ] T167 Run full test suite and verify 80%+ coverage across all modules
- [ ] T168 [P] Add missing unit tests for any modules below 80% coverage
- [ ] T169 [P] Add missing integration tests for any API routes below 80% coverage

### Error Handling & Loading States

- [ ] T170 [P] Create error boundary component in src/components/shared/ErrorBoundary.tsx
- [ ] T171 [P] Create loading skeleton components in src/components/shared/Skeletons.tsx
- [ ] T172 [P] Create toast notification system in src/components/shared/Toaster.tsx

### Performance & Optimization

- [ ] T173 [P] Add React Suspense boundaries to pages
- [ ] T174 [P] Implement response caching with Vercel KV for repeated queries
- [ ] T175 Add database query optimization (ensure all tenant filters use indexes)

### Accessibility

- [ ] T176 [P] Add ARIA labels to all interactive components
- [ ] T177 [P] Add keyboard navigation support to RfpEditor
- [ ] T178 Verify WCAG 2.1 AA compliance across all pages

### Final Validation

- [ ] T179 [P] Create next.config.ts with security headers
- [ ] T180 Run all E2E tests in CI mode and verify pass
- [ ] T181 Validate setup using quickstart.md instructions

---

## Dependencies & Execution Order

### TDD Workflow Per User Story

```
1. Write tests (unit, integration, E2E) → Tests FAIL (Red)
2. Implement minimal code → Tests PASS (Green)
3. Refactor while keeping tests green
4. Move to next user story
```

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-9)**: All depend on Foundational phase completion
  - US1, US2, US3 are all P1 priority
  - US4, US5 are P2 priority
  - US6, US7 are P3 priority
- **Polish (Phase 10)**: Depends on core user stories being complete

### User Story Dependencies

| Story | Priority | Dependencies | Can Start After |
|-------|----------|--------------|-----------------|
| US1: Upload & Auto-Complete | P1 | Foundation | Phase 2 |
| US2: Knowledge Base | P1 | Foundation | Phase 2 |
| US3: Review & Edit | P1 | US1 (builds on editor) | Phase 3 partial |
| US4: Approval Workflow | P2 | US1, US3 (needs RFP editing) | Phase 5 |
| US5: User Management | P2 | Foundation | Phase 2 |
| US6: LLM Config | P3 | US1 (needs AI working) | Phase 3 |
| US7: Learning | P3 | US1, US2, US4 (needs approved RFPs) | Phase 6 |

### Parallel Opportunities

**Within Each User Story**:
- All unit tests can run in parallel (different files)
- After tests written, all implementations for different modules can run in parallel

**Across User Stories**:
- US1 and US2 can proceed in parallel (different features)
- US5 can proceed in parallel with US1-US4 (independent feature)

---

## Parallel Example: Phase 3 (US1) Tests First

```bash
# Launch all unit tests in parallel (they will FAIL initially):
Task: "Write unit tests for PDF parser in tests/unit/documents/pdf-parser.test.ts"
Task: "Write unit tests for Word parser in tests/unit/documents/word-parser.test.ts"
Task: "Write unit tests for document analyzer agent in tests/unit/ai/agents/document-analyzer.test.ts"
Task: "Write unit tests for response generator agent in tests/unit/ai/agents/response-generator.test.ts"

# Then launch all implementations in parallel:
Task: "Create PDF parser using pdf-parse in src/lib/documents/pdf-parser.ts"
Task: "Create Word parser using mammoth in src/lib/documents/word-parser.ts"
Task: "Create document analyzer agent in src/lib/ai/agents/document-analyzer.ts"
Task: "Create response generator agent in src/lib/ai/agents/response-generator.ts"
```

---

## Implementation Strategy

### MVP First with TDD (User Stories 1-3)

1. Complete Phase 1: Setup + Testing Infrastructure
2. Complete Phase 2: Foundational (tests first for each module)
3. Complete Phase 3: User Story 1 (tests → implementation)
4. Complete Phase 4: User Story 2 (tests → implementation)
5. Complete Phase 5: User Story 3 (tests → implementation)
6. **VERIFY**: All tests pass, coverage ≥ 80%
7. Deploy MVP

### Test Categories

| Type | Location | Purpose | When to Run |
|------|----------|---------|-------------|
| Unit | tests/unit/ | Test individual functions/components | Every commit |
| Integration | tests/integration/ | Test API routes with mocked services | Every PR |
| E2E | tests/e2e/ | Test full user workflows | Before deploy |

---

## Summary

| Phase | Task Count | Test Tasks | Implementation Tasks | Parallelizable |
|-------|------------|------------|---------------------|----------------|
| Phase 1: Setup | 13 | 5 | 8 | 10 |
| Phase 2: Foundation | 34 | 8 | 26 | 24 |
| Phase 3: US1 | 39 | 12 | 27 | 31 |
| Phase 4: US2 | 23 | 5 | 18 | 18 |
| Phase 5: US3 | 10 | 4 | 6 | 6 |
| Phase 6: US4 | 16 | 4 | 12 | 12 |
| Phase 7: US5 | 10 | 2 | 8 | 6 |
| Phase 8: US6 | 10 | 3 | 7 | 6 |
| Phase 9: US7 | 11 | 4 | 7 | 6 |
| Phase 10: Polish | 15 | 3 | 12 | 10 |
| **Total** | **181** | **50** | **131** | **129** |

**MVP Task Count**: 119 tasks (Phases 1-5)
**Total Test Tasks**: 50 (28% of all tasks)
**Coverage Target**: 80%+
