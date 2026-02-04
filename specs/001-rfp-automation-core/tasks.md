# Tasks: RFP Automation Core Platform

**Input**: Design documents from `/specs/001-rfp-automation-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md: Next.js monorepo with `src/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize Next.js 15 project with TypeScript strict mode in package.json
- [ ] T002 [P] Configure Tailwind CSS in tailwind.config.ts
- [ ] T003 [P] Configure ESLint and Prettier in .eslintrc.js and .prettierrc
- [ ] T004 [P] Create tsconfig.json with strict mode and path aliases
- [ ] T005 Install core dependencies: React 18, shadcn/ui, React Hook Form, Zod, Zustand in package.json
- [ ] T006 [P] Create src/app/layout.tsx with providers structure
- [ ] T007 [P] Create src/app/globals.css with Tailwind imports
- [ ] T008 [P] Install shadcn/ui and initialize components in src/components/ui/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Database & ORM

- [ ] T009 Install Drizzle ORM and configure drizzle.config.ts for Neon PostgreSQL
- [ ] T010 Create database client in src/lib/db/index.ts with Neon connection
- [ ] T011 [P] Create tenant_settings schema in src/lib/db/schema/tenant-settings.ts
- [ ] T012 [P] Create customers schema in src/lib/db/schema/customers.ts
- [ ] T013 [P] Create knowledge_entries schema with pgvector in src/lib/db/schema/knowledge-entries.ts
- [ ] T014 [P] Create rfps schema in src/lib/db/schema/rfps.ts
- [ ] T015 [P] Create rfp_responses schema in src/lib/db/schema/rfp-responses.ts
- [ ] T016 [P] Create rfp_versions schema in src/lib/db/schema/rfp-versions.ts
- [ ] T017 [P] Create learnings schema in src/lib/db/schema/learnings.ts
- [ ] T018 Create schema index file exporting all tables in src/lib/db/schema/index.ts
- [ ] T019 Generate initial database migration with Drizzle in src/lib/db/migrations/

### Authentication & Multi-tenancy

- [ ] T020 Install and configure Clerk in src/middleware.ts
- [ ] T021 [P] Create Clerk provider wrapper in src/app/layout.tsx
- [ ] T022 [P] Create auth utilities with tenant context extraction in src/lib/utils/auth.ts
- [ ] T023 Create Clerk webhook handler for organization sync in src/app/api/webhooks/clerk/route.ts
- [ ] T024 [P] Create sign-in page in src/app/(public)/sign-in/[[...sign-in]]/page.tsx

### Validation & Types

- [ ] T025 [P] Create Zod validation schemas in src/lib/utils/validation.ts
- [ ] T026 [P] Create RFP TypeScript types in src/types/rfp.ts
- [ ] T027 [P] Create Knowledge TypeScript types in src/types/knowledge.ts
- [ ] T028 [P] Create API response types in src/types/api.ts

### Storage & Background Jobs

- [ ] T029 [P] Configure Vercel Blob wrapper in src/lib/storage/blob.ts
- [ ] T030 [P] Configure Vercel KV client in src/lib/storage/kv.ts
- [ ] T031 Install and configure Inngest client in src/lib/inngest/client.ts
- [ ] T032 Create Inngest webhook handler in src/app/api/inngest/route.ts

### AI Infrastructure

- [ ] T033 [P] Create LLM provider abstraction with Vercel AI SDK in src/lib/ai/providers.ts
- [ ] T034 [P] Create embedding generation utility in src/lib/ai/embeddings.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Upload and Auto-Complete RFP (Priority: P1)

**Goal**: Users can upload RFP documents, trigger AI auto-completion, and export completed documents with preserved formatting

**Independent Test**: Upload a sample PDF RFP, trigger AI processing, verify fields are populated with responses and confidence scores, export completed document

### Document Processing (US1)

- [ ] T035 [P] [US1] Create PDF parser using pdf-parse in src/lib/documents/pdf-parser.ts
- [ ] T036 [P] [US1] Create Word parser using mammoth in src/lib/documents/word-parser.ts
- [ ] T037 [P] [US1] Create PDF output generator with overlay using pdf-lib in src/lib/documents/pdf-output.ts
- [ ] T038 [P] [US1] Create Word output generator using docx in src/lib/documents/word-output.ts

### AI Agents (US1)

- [ ] T039 [P] [US1] Create document analyzer agent in src/lib/ai/agents/document-analyzer.ts
- [ ] T040 [P] [US1] Create response generator agent in src/lib/ai/agents/response-generator.ts
- [ ] T041 [P] [US1] Create quality checker agent in src/lib/ai/agents/quality-checker.ts

### Inngest Functions (US1)

- [ ] T042 [US1] Create process-rfp Inngest function with multi-step workflow in src/lib/inngest/functions/process-rfp.ts
- [ ] T043 [P] [US1] Create export-document Inngest function in src/lib/inngest/functions/export-document.ts

### API Routes (US1)

- [ ] T044 [P] [US1] Create RFP list/create API route in src/app/api/rfps/route.ts
- [ ] T045 [P] [US1] Create RFP get/update/delete API route in src/app/api/rfps/[rfpId]/route.ts
- [ ] T046 [P] [US1] Create RFP document upload API route in src/app/api/rfps/[rfpId]/upload/route.ts
- [ ] T047 [P] [US1] Create RFP process trigger API route in src/app/api/rfps/[rfpId]/process/route.ts
- [ ] T048 [P] [US1] Create RFP processing status API route in src/app/api/rfps/[rfpId]/status/route.ts
- [ ] T049 [P] [US1] Create RFP responses list API route in src/app/api/rfps/[rfpId]/responses/route.ts
- [ ] T050 [P] [US1] Create RFP response update API route in src/app/api/rfps/[rfpId]/responses/[fieldId]/route.ts
- [ ] T051 [P] [US1] Create RFP download API route in src/app/api/rfps/[rfpId]/download/route.ts

### UI Components (US1)

- [ ] T052 [P] [US1] Create DocumentPreview component in src/components/rfp/DocumentPreview.tsx
- [ ] T053 [P] [US1] Create ResponseCard component with confidence indicator in src/components/rfp/ResponseCard.tsx
- [ ] T054 [P] [US1] Create ProgressTracker component in src/components/rfp/ProgressTracker.tsx
- [ ] T055 [US1] Create RfpEditor side-by-side editing interface in src/components/rfp/RfpEditor.tsx

### Pages (US1)

- [ ] T056 [P] [US1] Create dashboard page in src/app/(auth)/dashboard/page.tsx
- [ ] T057 [P] [US1] Create new RFP wizard page in src/app/(auth)/rfps/new/page.tsx
- [ ] T058 [US1] Create RFP detail/edit page in src/app/(auth)/rfps/[id]/page.tsx

### Hooks (US1)

- [ ] T059 [P] [US1] Create useRfp hook for RFP data fetching in src/hooks/use-rfp.ts
- [ ] T060 [P] [US1] Create useProcessingStatus hook for polling in src/hooks/use-processing-status.ts

**Checkpoint**: User Story 1 complete - users can upload RFPs, trigger AI completion, review responses, and export documents

---

## Phase 4: User Story 2 - Build and Manage Knowledge Base (Priority: P1)

**Goal**: Admin users can upload documents to build a customer-specific knowledge base that powers AI auto-completion

**Independent Test**: Upload documents to knowledge base, verify content is extracted and indexed, perform semantic search and verify relevant results

### Inngest Functions (US2)

- [ ] T061 [US2] Create generate-embeddings Inngest function in src/lib/inngest/functions/generate-embeddings.ts

### API Routes (US2)

- [ ] T062 [P] [US2] Create customer list/create API route in src/app/api/customers/route.ts
- [ ] T063 [P] [US2] Create customer get/update/delete API route in src/app/api/customers/[customerId]/route.ts
- [ ] T064 [P] [US2] Create knowledge entries list/create API route in src/app/api/customers/[customerId]/knowledge/route.ts
- [ ] T065 [P] [US2] Create knowledge document upload API route in src/app/api/customers/[customerId]/knowledge/upload/route.ts
- [ ] T066 [P] [US2] Create knowledge semantic search API route in src/app/api/customers/[customerId]/knowledge/search/route.ts
- [ ] T067 [P] [US2] Create knowledge entry get/delete API route in src/app/api/customers/[customerId]/knowledge/[entryId]/route.ts

### UI Components (US2)

- [ ] T068 [P] [US2] Create KnowledgeEntryCard component in src/components/knowledge/KnowledgeEntryCard.tsx
- [ ] T069 [P] [US2] Create KnowledgeUploader component in src/components/knowledge/KnowledgeUploader.tsx
- [ ] T070 [P] [US2] Create KnowledgeSearch component in src/components/knowledge/KnowledgeSearch.tsx
- [ ] T071 [P] [US2] Create CustomerSelector component in src/components/shared/CustomerSelector.tsx

### Pages (US2)

- [ ] T072 [P] [US2] Create customers list page in src/app/(auth)/customers/page.tsx
- [ ] T073 [P] [US2] Create customer detail page in src/app/(auth)/customers/[id]/page.tsx
- [ ] T074 [US2] Create knowledge base management page in src/app/(auth)/knowledge/page.tsx

### Hooks (US2)

- [ ] T075 [US2] Create useKnowledgeSearch hook for semantic search in src/hooks/use-knowledge-search.ts

**Checkpoint**: User Story 2 complete - admins can build and search knowledge bases per customer

---

## Phase 5: User Story 3 - Review and Edit AI Responses (Priority: P1)

**Goal**: Users can review AI-generated responses in a side-by-side interface, accept/edit/reject suggestions, with real-time completion tracking

**Independent Test**: Load a partially completed RFP, make edits to responses, verify changes auto-save and completion percentage updates

### UI Enhancements (US3)

- [ ] T076 [P] [US3] Create ConfidenceIndicator component in src/components/rfp/ConfidenceIndicator.tsx
- [ ] T077 [P] [US3] Create ResponseActions component (accept/edit/reject) in src/components/rfp/ResponseActions.tsx
- [ ] T078 [P] [US3] Create CompletionProgress component in src/components/rfp/CompletionProgress.tsx
- [ ] T079 [US3] Enhance RfpEditor with auto-save and optimistic updates in src/components/rfp/RfpEditor.tsx

### API Enhancements (US3)

- [ ] T080 [US3] Add auto-save debouncing to response update API in src/app/api/rfps/[rfpId]/responses/[fieldId]/route.ts
- [ ] T081 [US3] Add completion percentage calculation to RFP status endpoint in src/app/api/rfps/[rfpId]/status/route.ts

**Checkpoint**: User Story 3 complete - users have full editing control with real-time feedback

---

## Phase 6: User Story 4 - Submit for Approval and Finalize (Priority: P2)

**Goal**: Users can submit completed RFPs for admin review, admins can approve/return/finalize, finalized RFPs are locked

**Independent Test**: Submit a completed RFP, have admin approve it, verify document is locked when finalized

### API Routes (US4)

- [ ] T082 [P] [US4] Create RFP submit for review API route in src/app/api/rfps/[rfpId]/submit/route.ts
- [ ] T083 [P] [US4] Create RFP approve API route (admin only) in src/app/api/rfps/[rfpId]/approve/route.ts
- [ ] T084 [P] [US4] Create RFP return API route (admin only) in src/app/api/rfps/[rfpId]/return/route.ts
- [ ] T085 [P] [US4] Create RFP finalize API route (admin only) in src/app/api/rfps/[rfpId]/finalize/route.ts
- [ ] T086 [P] [US4] Create RFP versions list API route in src/app/api/rfps/[rfpId]/versions/route.ts

### UI Components (US4)

- [ ] T087 [P] [US4] Create WorkflowStatusBadge component in src/components/rfp/WorkflowStatusBadge.tsx
- [ ] T088 [P] [US4] Create ApprovalActions component in src/components/rfp/ApprovalActions.tsx
- [ ] T089 [P] [US4] Create VersionHistory component in src/components/rfp/VersionHistory.tsx
- [ ] T090 [US4] Create ReturnComments dialog component in src/components/rfp/ReturnComments.tsx

### Service Logic (US4)

- [ ] T091 [US4] Implement RFP state transition validation in src/lib/services/rfp-workflow.ts
- [ ] T092 [US4] Implement version snapshot creation on finalize in src/lib/services/rfp-versions.ts

**Checkpoint**: User Story 4 complete - full approval workflow functional

---

## Phase 7: User Story 5 - Manage Users and Permissions (Priority: P2)

**Goal**: Admins can invite users, assign roles, users see only assigned RFPs

**Independent Test**: Invite a user, assign them an RFP, verify they only see their assigned work

### UI Components (US5)

- [ ] T093 [P] [US5] Create UserInviteForm component in src/components/settings/UserInviteForm.tsx
- [ ] T094 [P] [US5] Create UserList component in src/components/settings/UserList.tsx
- [ ] T095 [P] [US5] Create RoleSelector component in src/components/settings/RoleSelector.tsx
- [ ] T096 [P] [US5] Create RfpAssignment component in src/components/rfp/RfpAssignment.tsx

### Pages (US5)

- [ ] T097 [US5] Create settings page with user management in src/app/(auth)/settings/page.tsx
- [ ] T098 [US5] Create users management tab in src/app/(auth)/settings/users/page.tsx

### API Enhancements (US5)

- [ ] T099 [US5] Add role-based filtering to RFP list API (users see only assigned) in src/app/api/rfps/route.ts
- [ ] T100 [US5] Add RFP assignment update endpoint in src/app/api/rfps/[rfpId]/route.ts

**Checkpoint**: User Story 5 complete - multi-user collaboration with role-based access

---

## Phase 8: User Story 6 - Configure LLM Provider (Priority: P3)

**Goal**: Tenant admins can configure their preferred LLM provider (Claude, GPT, Azure) with encrypted API keys

**Independent Test**: Configure API credentials, trigger an AI operation, verify correct provider is used

### API Routes (US6)

- [ ] T101 [P] [US6] Create tenant settings get API route in src/app/api/settings/route.ts
- [ ] T102 [US6] Create tenant settings update API route with key encryption in src/app/api/settings/route.ts

### UI Components (US6)

- [ ] T103 [P] [US6] Create LlmProviderSelector component in src/components/settings/LlmProviderSelector.tsx
- [ ] T104 [P] [US6] Create ApiKeyInput component with masking in src/components/settings/ApiKeyInput.tsx
- [ ] T105 [US6] Create SettingsForm component in src/components/settings/SettingsForm.tsx

### Service Logic (US6)

- [ ] T106 [US6] Implement API key encryption/decryption in src/lib/services/encryption.ts
- [ ] T107 [US6] Update LLM provider abstraction to read tenant settings in src/lib/ai/providers.ts

**Checkpoint**: User Story 6 complete - tenants can choose their LLM provider

---

## Phase 9: User Story 7 - Learn from Completed RFPs (Priority: P3)

**Goal**: System learns from approved RFPs and user corrections to improve future auto-completion accuracy

**Independent Test**: Approve an RFP, process a similar new RFP, verify improved response accuracy

### API Routes (US7)

- [ ] T108 [P] [US7] Create learnings list/create API route in src/app/api/learnings/route.ts

### Inngest Functions (US7)

- [ ] T109 [US7] Create extract-learnings Inngest function triggered on RFP approval in src/lib/inngest/functions/extract-learnings.ts

### UI Components (US7)

- [ ] T110 [P] [US7] Create LearningEntry component in src/components/knowledge/LearningEntry.tsx
- [ ] T111 [P] [US7] Create ManualLearningForm component in src/components/knowledge/ManualLearningForm.tsx
- [ ] T112 [US7] Create LearningsPanel component in src/components/knowledge/LearningsPanel.tsx

### Service Logic (US7)

- [ ] T113 [US7] Implement correction capture on response edit in src/lib/services/learning-capture.ts
- [ ] T114 [US7] Enhance response generator to incorporate learnings in src/lib/ai/agents/response-generator.ts

**Checkpoint**: User Story 7 complete - continuous learning system active

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Error Handling & Loading States

- [ ] T115 [P] Create error boundary component in src/components/shared/ErrorBoundary.tsx
- [ ] T116 [P] Create loading skeleton components in src/components/shared/Skeletons.tsx
- [ ] T117 [P] Create toast notification system in src/components/shared/Toaster.tsx

### Performance & Optimization

- [ ] T118 [P] Add React Suspense boundaries to pages
- [ ] T119 [P] Implement response caching with Vercel KV for repeated queries
- [ ] T120 Add database query optimization (ensure all tenant filters use indexes)

### Accessibility

- [ ] T121 [P] Add ARIA labels to all interactive components
- [ ] T122 [P] Add keyboard navigation support to RfpEditor
- [ ] T123 Verify WCAG 2.1 AA compliance across all pages

### Configuration

- [ ] T124 [P] Create next.config.ts with security headers
- [ ] T125 [P] Create vitest.config.ts for unit testing
- [ ] T126 [P] Create playwright.config.ts for E2E testing
- [ ] T127 Validate setup using quickstart.md instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-9)**: All depend on Foundational phase completion
  - US1, US2, US3 are all P1 priority and can proceed in parallel
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

**Within Phase 2 (Foundation)**:
- T011-T017 (all schema files) can run in parallel
- T025-T028 (all type files) can run in parallel
- T029-T030 (storage clients) can run in parallel
- T033-T034 (AI utilities) can run in parallel

**Within Phase 3 (US1)**:
- T035-T038 (document processing) can run in parallel
- T039-T041 (AI agents) can run in parallel
- T044-T051 (API routes) can run in parallel
- T052-T054 (UI components) can run in parallel

**Across User Stories**:
- US1 and US2 can proceed in parallel (different features)
- US5 can proceed in parallel with US1-US4 (independent feature)

---

## Parallel Example: Phase 3 (US1) Document Processing

```bash
# Launch all document parsers together:
Task: "Create PDF parser using pdf-parse in src/lib/documents/pdf-parser.ts"
Task: "Create Word parser using mammoth in src/lib/documents/word-parser.ts"
Task: "Create PDF output generator with overlay using pdf-lib in src/lib/documents/pdf-output.ts"
Task: "Create Word output generator using docx in src/lib/documents/word-output.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Upload & Auto-Complete)
4. Complete Phase 4: User Story 2 (Knowledge Base)
5. Complete Phase 5: User Story 3 (Review & Edit)
6. **STOP and VALIDATE**: Test full RFP workflow end-to-end
7. Deploy MVP

### Incremental Delivery

| Increment | Stories | Value Delivered |
|-----------|---------|-----------------|
| MVP | US1, US2, US3 | Core RFP automation (60-80% time savings) |
| +Workflow | +US4 | Enterprise approval process |
| +Collaboration | +US5 | Multi-user team support |
| +Enterprise | +US6 | LLM provider flexibility |
| +Learning | +US7 | Continuous accuracy improvement |

### Suggested MVP Scope

**Phase 1 + Phase 2 + Phases 3-5** (User Stories 1-3)

This delivers:
- RFP upload and AI auto-completion
- Knowledge base building
- Human-in-the-loop editing
- Document export with formatting preserved

---

## Summary

| Phase | Task Count | Parallelizable |
|-------|------------|----------------|
| Phase 1: Setup | 8 | 6 |
| Phase 2: Foundation | 26 | 18 |
| Phase 3: US1 | 26 | 21 |
| Phase 4: US2 | 15 | 12 |
| Phase 5: US3 | 6 | 4 |
| Phase 6: US4 | 11 | 8 |
| Phase 7: US5 | 8 | 5 |
| Phase 8: US6 | 7 | 4 |
| Phase 9: US7 | 7 | 4 |
| Phase 10: Polish | 13 | 10 |
| **Total** | **127** | **92** |

**MVP Task Count**: 81 tasks (Phases 1-5)
