# Task Breakdown: KB-Driven Draft Intelligence

**Feature:** 011-kb-driven-draft-intelligence
**Plan:** `.specify/specs/011-kb-driven-draft-intelligence/plan.md`
**Total Tasks:** 26
**Phases:** 5 (A–E)

---

## Phase A: Data Model & Retrieval Enhancement

**Goal:** Per-field KB search with customer prioritization works in both pipelines.
**User Stories:** US1 (Per-Field Retrieval), US2 (Customer KB Prioritization)

---

### Task A1: Migration & Schema — Implementation
**Status:** 🟡 Ready
**Dependencies:** None
**Parallel with:** —
**Delegate to:** drizzle-orm-expert

**Description:**
Create migration `drizzle/0009_kb_driven_draft_intelligence.sql` adding `extracted_metadata` JSONB column to `rfps` table. Update Drizzle schema in `src/lib/db/schema/rfps.ts` with `extractedMetadata` column and `ExtractedRfpMetadata` TypeScript interface.

**Acceptance Criteria:**
- [ ] Migration file adds single `ALTER TABLE rfps ADD COLUMN extracted_metadata jsonb`
- [ ] Drizzle schema exports `ExtractedRfpMetadata` interface with all 8 nullable fields
- [ ] `extractedMetadata` column typed with `.$type<ExtractedRfpMetadata>()`
- [ ] Drizzle journal updated
- [ ] Existing tests still pass (no breaking changes)

---

### Task A2: Enhanced `searchByRequirements` — Tests
**Status:** 🟡 Ready (can start after A1)
**Dependencies:** A1
**Parallel with:** —
**Delegate to:** tdd-guide

**Description:**
Write tests for the enhanced `searchByRequirements` function covering: customer ID parameter, 1.3x customer score boost, batch embeddings, raised field cap (20), and deduplication with customer preference.

**Test Cases:**
- [ ] With `customerId`: customer entries receive 1.3x similarity boost
- [ ] With `customerId`: result set includes both customer-scoped and org-wide entries (union filter)
- [ ] Without `customerId`: only org-wide entries returned (unchanged behavior)
- [ ] Deduplication: when same entry matches multiple fields, highest score is kept
- [ ] Deduplication with customer boost: customer entry kept over identical org-wide entry
- [ ] Batch embedding: `generateEmbeddings` called once with all field texts (not N individual calls)
- [ ] Field cap: only first 20 fields searched when >20 provided
- [ ] `CUSTOMER_BOOST_FACTOR` is an exported named constant (1.3)
- [ ] Graceful degradation: returns empty array when embedding API fails
- [ ] All tests FAIL before implementation

---

### Task A3: Enhanced `searchByRequirements` — Implementation
**Status:** 🔴 Blocked by A2
**Dependencies:** A2
**Parallel with:** —
**Delegate to:** backend-developer

**Description:**
Modify `src/lib/services/proposal-retrieval.ts`:
1. Add optional `customerId?: string` parameter to `searchByRequirements`
2. Add customer union filter to per-field DB queries (`customerId = X OR customerId IS NULL`)
3. Apply `CUSTOMER_BOOST_FACTOR = 1.3` multiplier to results where `entry.customerId === customerId`
4. Replace individual `generateEmbedding` calls with single `generateEmbeddings` batch call
5. Raise `REQUIREMENT_SEARCH_CAP` from 10 to 20
6. In deduplication, prefer customer-scoped entry when scores are equal

**Acceptance Criteria:**
- [ ] All tests from A2 pass
- [ ] `CUSTOMER_BOOST_FACTOR` exported as named constant
- [ ] `REQUIREMENT_SEARCH_CAP` raised to 20
- [ ] Function signature backward-compatible (customerId is optional)
- [ ] No cross-tenant data leakage (organizationId filter unchanged)

---

### Task A4: Pipeline 1 Integration — Tests
**Status:** 🔴 Blocked by A3
**Dependencies:** A3
**Parallel with:** —
**Delegate to:** tdd-guide

**Description:**
Write integration tests for `process-rfp.ts` Step 5 verifying that per-field search replaces the single-query approach.

**Test Cases:**
- [ ] Step 5 calls `searchByRequirements` with `parsedStructure.fields` (not `rfp.name`)
- [ ] Step 5 passes `rfp.customerId` to `searchByRequirements`
- [ ] Step 5 passes `openaiApiKey` to `searchByRequirements`
- [ ] Response generator receives per-field KB context (not single-query results)
- [ ] When `searchByRequirements` returns empty, pipeline continues without error
- [ ] All tests FAIL before implementation

---

### Task A5: Pipeline 1 Integration — Implementation
**Status:** 🔴 Blocked by A4
**Dependencies:** A4
**Parallel with:** —

**Description:**
Modify `src/lib/inngest/functions/process-rfp.ts` Step 5:
1. Replace `searchSimilar(rfp.name, ...)` with `searchByRequirements(analyzed.fields, organizationId, rfp.customerId, openaiApiKey)`
2. Map results to the `knowledgeContext` format expected by `generateResponses`

**Acceptance Criteria:**
- [ ] All tests from A4 pass
- [ ] `searchSimilar` import removed (or kept only if used elsewhere)
- [ ] `searchByRequirements` import added from `proposal-retrieval`
- [ ] Customer ID flows from `rfp.customerId` through to search

---

### Task A6: Pipeline 2 Integration — Tests
**Status:** 🔴 Blocked by A3
**Dependencies:** A3
**Parallel with:** A4
**Delegate to:** tdd-guide

**Description:**
Write integration tests for `generate-proposal.ts` Step 2 verifying customer ID is passed to `searchByRequirements`.

**Test Cases:**
- [ ] Step 2 passes `rfp.customerId` to `searchByRequirements`
- [ ] Customer-specific KB entries appear in `requirementResults` with boosted scores
- [ ] When `rfp.customerId` is null, search returns org-wide only
- [ ] All tests FAIL before implementation

---

### Task A7: Pipeline 2 Integration — Implementation
**Status:** 🔴 Blocked by A6
**Dependencies:** A6
**Parallel with:** A5

**Description:**
Modify `src/lib/inngest/functions/generate-proposal.ts` Step 2:
Pass `rfp.customerId` as the new parameter to `searchByRequirements`.

**Acceptance Criteria:**
- [ ] All tests from A6 pass
- [ ] `rfp.customerId` available from Step 1 fetch (already is — verify)
- [ ] No change to downstream steps (results format unchanged)

---

### Task A8: Phase A Quality Gate
**Status:** 🔴 Blocked by A5, A7
**Dependencies:** A5, A7
**Delegate to:** security-reviewer, code-reviewer

**Description:**
Run security review and code review on all Phase A changes.

**Acceptance Criteria:**
- [ ] No tenant isolation violations (organizationId scoping verified)
- [ ] No cross-customer data leakage in union filter
- [ ] All tests pass, 80%+ coverage on changed files
- [ ] No console.log statements
- [ ] CRITICAL and HIGH issues resolved

---

## Phase B: RFP Metadata Extraction

**Goal:** Document analyzer extracts structured metadata, stored on RFP, used in proposal output.
**User Story:** US4 (RFP Metadata Preservation)

---

### Task B1: Document Analyzer Metadata — Tests
**Status:** 🟡 Ready (independent of Phase A)
**Dependencies:** A1 (schema type only)
**Parallel with:** A2–A7
**Delegate to:** tdd-guide

**Description:**
Write tests for the extended document analyzer verifying structured metadata extraction.

**Test Cases:**
- [ ] Extracts title from RFP with clear title line (e.g., "Request for Proposal: Cloud Migration Services")
- [ ] Extracts issuing organization from document body
- [ ] Extracts submission deadline and project start date as free-text strings
- [ ] Extracts reference number (e.g., "RFP-2026-089")
- [ ] Extracts contact name, email, phone when present
- [ ] Returns null for each metadata field when not clearly stated (no fabrication)
- [ ] Returns null for all metadata fields when document has no identifiable metadata
- [ ] Preserves non-English metadata as-is (no translation)
- [ ] Existing field extraction behavior unchanged (backward compatible)
- [ ] All tests FAIL before implementation

---

### Task B2: Document Analyzer Metadata — Implementation
**Status:** 🔴 Blocked by B1
**Dependencies:** B1

**Description:**
Modify `src/lib/ai/agents/document-analyzer.ts`:
1. Add `metadata` object to Zod output schema with 8 nullable string fields
2. Add metadata extraction instructions to system prompt: "Extract the exact document title, issuing organization, reference number, submission deadline, project start date, and contact details. Return null for any field not clearly stated — never fabricate."
3. Update `DocumentAnalysisResult` interface to include `metadata`

**Acceptance Criteria:**
- [ ] All tests from B1 pass
- [ ] Output schema includes `metadata` with all 8 fields
- [ ] System prompt explicitly prohibits fabrication
- [ ] Existing field extraction unchanged

---

### Task B3: Metadata Storage in process-rfp — Tests
**Status:** 🔴 Blocked by B2
**Dependencies:** A1, B2
**Delegate to:** tdd-guide

**Description:**
Write integration tests for metadata storage and auto-population in `process-rfp.ts`.

**Test Cases:**
- [ ] `extractedMetadata` JSONB stored on RFP record after analysis
- [ ] `dueDate` auto-populated from `metadata.submissionDeadline` when RFP's `dueDate` is null
- [ ] `dueDate` NOT overwritten when user already entered a value
- [ ] `customerCompanyName` auto-populated from `metadata.issuingOrganization` when null
- [ ] `customerCompanyName` NOT overwritten when user already entered a value
- [ ] Summary field from analyzer still handled correctly
- [ ] All tests FAIL before implementation

---

### Task B4: Metadata Storage in process-rfp — Implementation
**Status:** 🔴 Blocked by B3
**Dependencies:** B3

**Description:**
Modify `src/lib/inngest/functions/process-rfp.ts`:
1. In Step 4 (analyze-document), capture `analyzed.metadata`
2. In Step 8 (update-rfp), store `extractedMetadata` on RFP record
3. Auto-populate `dueDate` and `customerCompanyName` only when null (user data takes precedence)

**Acceptance Criteria:**
- [ ] All tests from B3 pass
- [ ] `analyzed.summary` still stored (if it was before — verify; currently it's discarded, which is fine)
- [ ] No user-entered values overwritten

---

### Task B5: Proposal Writer Metadata — Tests
**Status:** 🔴 Blocked by B2
**Dependencies:** B2
**Parallel with:** B3
**Delegate to:** tdd-guide

**Description:**
Write tests for the proposal writer receiving and using RFP metadata.

**Test Cases:**
- [ ] Output starts with `# Proposal: [exact RFP title]` when metadata title is provided
- [ ] Output starts with `# Proposal: [rfp.name]` as fallback when metadata title is null
- [ ] Issuing organization name appears verbatim in proposal intro
- [ ] Submission deadline appears verbatim in proposal
- [ ] Metadata fields that are null are omitted (not rendered as "null" or "N/A")
- [ ] All tests FAIL before implementation

---

### Task B6: Proposal Writer Metadata — Implementation
**Status:** 🔴 Blocked by B5
**Dependencies:** B5

**Description:**
Modify `src/lib/ai/agents/proposal-writer.ts`:
1. Add `rfpMetadata?: ExtractedRfpMetadata | null` and `rfpName: string` to `WriteProposalInput`
2. Update system prompt: "Start with `# Proposal: [exact RFP title]`. Use the RFP metadata below verbatim — never paraphrase titles, dates, or organization names."
3. Add metadata context block to prompt assembly

**Acceptance Criteria:**
- [ ] All tests from B5 pass
- [ ] `WriteProposalInput` extended with `rfpMetadata` and `rfpName`
- [ ] Prompt explicitly prohibits metadata fabrication

---

### Task B7: Pipeline 2 Metadata Wiring — Implementation
**Status:** 🔴 Blocked by B4, B6
**Dependencies:** B4, B6

**Description:**
Modify `src/lib/inngest/functions/generate-proposal.ts`:
1. In Step 1, fetch `rfp.extractedMetadata` (already fetching full RFP row)
2. In Step 8, pass `rfpMetadata: rfp.extractedMetadata` and `rfpName: rfp.name` to `writeProposal`

**Acceptance Criteria:**
- [ ] `rfp.extractedMetadata` read from Step 1 result
- [ ] `rfpMetadata` and `rfpName` passed to `writeProposal` call
- [ ] Type-safe (no `any` casts)

---

### Task B8: Phase B Quality Gate
**Status:** 🔴 Blocked by B7
**Dependencies:** B4, B6, B7
**Delegate to:** code-reviewer

**Description:**
Run code review on all Phase B changes.

**Acceptance Criteria:**
- [ ] All tests pass, 80%+ coverage on changed files
- [ ] No metadata fabrication possible (prompt + fallback verified)
- [ ] Error logging sanitized (no PII in logs from extracted metadata)

---

## Phase C: KB Pre-Fill for Clarifying Questions

**Goal:** Questions pre-filled from KB, user sees fewer gaps to fill manually.
**User Story:** US3 (Pre-Fill From KB Before Clarifying Questions)

---

### Task C1: ClarifyingQuestion Interface Extension
**Status:** 🟡 Ready
**Dependencies:** None
**Parallel with:** Phase A, Phase B

**Description:**
Extend `ClarifyingQuestion` interface in `src/lib/db/schema/proposal-drafts.ts` with 4 optional fields: `suggestedAnswer`, `kbSourceId`, `kbSourceTitle`, `suggestionConfidence`.

**Acceptance Criteria:**
- [ ] All 4 new fields are optional (backward compatible with existing JSONB data)
- [ ] Types: `suggestedAnswer?: string | null`, `kbSourceId?: string | null`, `kbSourceTitle?: string | null`, `suggestionConfidence?: number | null`
- [ ] Existing tests still pass
- [ ] No migration needed (JSONB column)

---

### Task C2: KB Pre-Fill in createDraft — Tests
**Status:** 🔴 Blocked by A3, C1
**Dependencies:** A3 (searchByRequirements), C1 (interface)
**Delegate to:** tdd-guide

**Description:**
Write tests for KB pre-fill logic in `createDraft` service.

**Test Cases:**
- [ ] `knowledgeTopics` populated from actual KB entries (not empty array)
- [ ] `contentLibraryCategories` populated from KB entries grouped by type
- [ ] After question generation, each non-mandatory question searched against KB
- [ ] Question with KB match (similarity >= 0.7) gets `suggestedAnswer` from KB entry content
- [ ] Question with KB match gets `kbSourceId`, `kbSourceTitle`, `suggestionConfidence`
- [ ] Question with no KB match (similarity < 0.7) has null suggestion fields
- [ ] Mandatory questions (deliverables, exclusions, timeline) never get KB suggestions
- [ ] Empty KB: all questions have null suggestion fields, no errors
- [ ] KB search uses customer context when RFP has `customerId`
- [ ] All tests FAIL before implementation

---

### Task C3: KB Pre-Fill in createDraft — Implementation
**Status:** 🔴 Blocked by C2
**Dependencies:** C2

**Description:**
Modify `src/lib/services/proposal-draft.ts` `createDraft`:
1. Before calling `generateClarifyingQuestions`, query KB for distinct topics/categories and pass as `knowledgeTopics` and `contentLibraryCategories`
2. After question generation, for each non-mandatory question:
   a. Call `searchSimilar(question.question, orgId, 3, customerId, openaiApiKey)`
   b. If top result has similarity >= 0.7, attach `suggestedAnswer`, `kbSourceId`, `kbSourceTitle`, `suggestionConfidence`
3. Store enriched questions on the draft

**Note:** Uses `searchSimilar` (not `searchByRequirements`) intentionally — clarifying questions are searched individually (1-7 queries), not batched. `searchSimilar` already has the customer union filter and is the simpler choice for small query counts.

**Acceptance Criteria:**
- [ ] All tests from C2 pass
- [ ] `MANDATORY_QUESTION_IDS` imported and used to skip mandatory questions
- [ ] Similarity threshold (0.7) is a named constant
- [ ] Graceful degradation on KB search failure (questions still generated, no suggestions)

---

### Task C4: submitAnswers Preservation — Tests
**Status:** 🔴 Blocked by C1
**Dependencies:** C1
**Parallel with:** C2
**Delegate to:** tdd-guide

**Description:**
Write tests verifying `submitAnswers` preserves suggestion fields during answer merge.

**Test Cases:**
- [ ] After merge, `suggestedAnswer`, `kbSourceId`, `kbSourceTitle` preserved on each question
- [ ] User-provided answer overwrites `answer` field but suggestion fields remain
- [ ] Questions without suggestions still merge correctly (backward compatible)
- [ ] All tests FAIL before implementation

---

### Task C5: submitAnswers Preservation — Implementation
**Status:** 🔴 Blocked by C4
**Dependencies:** C4

**Description:**
Modify `src/lib/services/proposal-draft.ts` `submitAnswers`:
Ensure the merge logic spreads all existing question fields (`...q`), not just `id`, `question`, `rfpSection`, `answer`.

**Acceptance Criteria:**
- [ ] All tests from C4 pass
- [ ] Merge uses spread operator to preserve all fields
- [ ] No new fields stripped during answer merge

---

### Task C6: Phase C Quality Gate
**Status:** 🔴 Blocked by C3, C5
**Dependencies:** C3, C5
**Delegate to:** code-reviewer

**Description:**
Run code review on all Phase C changes.

**Acceptance Criteria:**
- [ ] All tests pass, 80%+ coverage on changed files
- [ ] No console.log statements
- [ ] KB search errors handled gracefully
- [ ] Mandatory questions never suppressed or pre-filled

---

## Phase D: UI — Pre-Fill Display

**Goal:** ClarifyingQuestionsForm shows KB suggestions with attribution badges.
**User Story:** US3 (Pre-Fill — UI portion)

---

### Task D1: ClarifyingQuestionsForm Pre-Fill — Tests
**Status:** 🔴 Blocked by C1
**Dependencies:** C1 (interface)
**Parallel with:** Phase C implementation
**Delegate to:** tdd-guide + react-component-architect

**Description:**
Write component tests for ClarifyingQuestionsForm with pre-fill behavior.

**Test Cases:**
- [ ] Textarea initializes with `suggestedAnswer` text when present
- [ ] Textarea initializes empty when `suggestedAnswer` is null/undefined
- [ ] "Auto-answered from Knowledge Base" badge renders when `kbSourceTitle` present
- [ ] Badge shows `kbSourceTitle` text
- [ ] Badge does NOT render when no suggestion exists
- [ ] User can edit pre-filled text (textarea is not readonly)
- [ ] "Clear" button empties textarea and removes badge
- [ ] After clearing, badge does not reappear
- [ ] Form submits with user-edited text (not original suggestion)
- [ ] Backward compatible: renders normally when no suggestion fields exist on any question
- [ ] All tests FAIL before implementation

---

### Task D2: ClarifyingQuestionsForm Pre-Fill — Implementation
**Status:** 🔴 Blocked by D1
**Dependencies:** D1

**Description:**
Modify `src/components/rfp/ClarifyingQuestionsForm.tsx`:
1. Initialize `answers` state from `q.suggestedAnswer` instead of empty string
2. Track which questions have active suggestions (for badge display)
3. Render shadcn Badge component with "Auto-answered from Knowledge Base" + `kbSourceTitle` beneath textarea when suggestion is active
4. Add "Clear" button that empties textarea and marks suggestion as cleared

**Acceptance Criteria:**
- [ ] All tests from D1 pass
- [ ] Uses shadcn Badge component (consistent with existing UI)
- [ ] Badge visually distinct (e.g., blue/info color, not red/error)
- [ ] Clear button is subtle (ghost variant or icon-only)
- [ ] No layout shift when badge appears/disappears

---

### Task D3: Phase D Quality Gate
**Status:** 🔴 Blocked by D2
**Dependencies:** D2
**Delegate to:** code-reviewer

**Description:**
Run code review on Phase D UI changes.

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Accessible: badge and clear button keyboard-navigable
- [ ] No unnecessary re-renders
- [ ] Component works with 0, some, and all questions having suggestions

---

## Phase E: Source Attribution in Proposals (P3 — Deferrable)

**Goal:** Proposal sections cite KB sources via inline blockquotes.
**User Story:** US5 (KB Match Transparency)

---

### Task E1: Proposal Writer Attribution — Tests
**Status:** 🔴 Blocked by A3 (enhanced search with source tracking)
**Dependencies:** A3, B6
**Delegate to:** tdd-guide

**Description:**
Write tests for proposal writer source attribution.

**Test Cases:**
- [ ] Prompt includes KB entry titles grouped by RFP section
- [ ] Output contains `> *Source: [KB entry title]*` blockquotes
- [ ] Sections with no KB match include `> *Source: No knowledge base match — consider uploading relevant content*`
- [ ] Multiple sources per section are listed
- [ ] All tests FAIL before implementation

---

### Task E2: Proposal Writer Attribution — Implementation
**Status:** 🔴 Blocked by E1
**Dependencies:** E1

**Description:**
Modify `src/lib/ai/agents/proposal-writer.ts`:
1. Accept `requirementResults` with source title metadata (already passed, verify titles present)
2. Group KB results by RFP section in prompt assembly
3. Update system prompt: "After each section heading, include a blockquote citing the KB sources used. If no KB source matched this section, write `> *Source: No knowledge base match — consider uploading relevant content*`"

**Acceptance Criteria:**
- [ ] All tests from E1 pass
- [ ] Source blockquotes present in all sections
- [ ] Gap indicator clearly communicates "upload better content"

---

### Task E3: Response Generator Source Verification
**Status:** 🔴 Blocked by A3
**Dependencies:** A3

**Description:**
Verify `src/lib/ai/agents/response-generator.ts` `sources` field includes KB entry titles. Fix if incomplete.

**Acceptance Criteria:**
- [ ] `sources` array in response output includes KB entry titles (not just IDs)
- [ ] Sources traceable back to specific KB entries

---

### Task E4: Aggregate KB Coverage Metric — Tests
**Status:** 🔴 Blocked by E2
**Dependencies:** E2
**Delegate to:** tdd-guide

**Description:**
Write tests for computing and displaying an aggregate KB coverage percentage on the proposal draft summary. This fulfills US5 acceptance scenario 3 (SC-005).

**Test Cases:**
- [ ] Given a proposal where 8 of 10 sections have KB source blockquotes, metric shows 80%
- [ ] Given a proposal where 0 sections have KB matches, metric shows 0%
- [ ] Given a proposal with all sections matched, metric shows 100%
- [ ] Metric is computed from the proposal markdown content (parsing `> *Source:*` blockquotes)
- [ ] Sections with `> *Source: No knowledge base match*` count as unmatched
- [ ] All tests FAIL before implementation

---

### Task E5: Aggregate KB Coverage Metric — Implementation
**Status:** 🔴 Blocked by E4
**Dependencies:** E4

**Description:**
Add a KB coverage metric to the proposal draft view:
1. Parse the generated proposal markdown to count sections with vs. without KB source matches
2. Compute percentage: `(matched sections / total sections) * 100`
3. Display as a badge or stat on the proposal draft summary (e.g., "KB Coverage: 75%")
4. Store the metric on the draft record (in `coverageReport` or as a lightweight field)

**Acceptance Criteria:**
- [ ] All tests from E4 pass
- [ ] Metric visible on proposal draft view
- [ ] Metric updates when proposal is regenerated
- [ ] No additional LLM calls needed (computed from markdown parsing)

---

### Task E6: Phase E Quality Gate
**Status:** 🔴 Blocked by E2, E3, E5
**Dependencies:** E2, E3, E5
**Delegate to:** code-reviewer

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Attribution doesn't clutter proposal readability
- [ ] Gap indicators are helpful, not alarming
- [ ] Aggregate metric is accurate and clearly displayed

---

## Dependency Graph

```
A1 (migration/schema)
├── A2 (search tests) → A3 (search impl) ─┬── A4 (P1 tests) → A5 (P1 impl) ─┐
│                                           ├── A6 (P2 tests) → A7 (P2 impl) ─┤
│                                           ├── C2 (pre-fill tests) → C3       │
│                                           ├── E1 (attrib tests) → E2 → E4 → E5 → E6
│                                           └── E3 (source verification) ──────► E6
├── B1 (analyzer tests) → B2 (analyzer impl)                                  │
│   ├── B3 (storage tests) → B4 (storage impl) ──┐                            │
│   └── B5 (writer tests) → B6 (writer impl) ────┤                            │
│                                                  └── B7 (wiring) → B8       │
│                                                                              │
├── C1 (interface) ─┬── C4 (submit tests) → C5 (submit impl) ─┐              │
│                    └── D1 (UI tests) → D2 (UI impl) → D3     │              │
│                                                               └── C6        │
│                                                                              │
└─────────────────────────────────────────── A8 (Phase A gate) ◄───────────────┘
```

## Critical Path

```
A1 → A2 → A3 → A4 → A5 → A8 (Phase A gate)
                 └──→ C2 → C3 → C6 (Phase C gate)
                             └──→ D1 → D2 → D3 (Phase D gate)
```

**Duration:** 12 tasks on critical path

## Parallelization Opportunities

| Parallel Set | Tasks | Rationale |
|-------------|-------|-----------|
| Set 1 | B1 alongside A2–A7 | Metadata extraction is independent of retrieval enhancement |
| Set 2 | A4+A5 alongside A6+A7 | Pipeline 1 and Pipeline 2 integration are independent |
| Set 3 | B3 alongside B5 | Storage and writer tests are independent |
| Set 4 | C4 alongside C2 | Submit preservation and pre-fill logic are independent |
| Set 5 | D1 alongside C2–C5 | UI tests only need the interface (C1), not the backend |
| Set 6 | C1 alongside everything | Interface extension has no dependencies |

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| A: Retrieval | 8 | Per-field search, customer boost, pipeline wiring |
| B: Metadata | 8 | Document analysis, storage, proposal writer |
| C: Pre-Fill | 6 | KB suggestions for clarifying questions |
| D: UI | 3 | Form pre-fill, attribution badge |
| E: Attribution | 6 | Source blockquotes + aggregate KB coverage metric (P3, deferrable) |
| **Total** | **26** (31 including 5 quality gates) | |
