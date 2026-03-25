# Implementation Plan: KB-Driven Draft Intelligence

**Feature:** 011-kb-driven-draft-intelligence
**Spec:** `.specify/specs/011-kb-driven-draft-intelligence/spec.md`
**Constitution:** `.specify/memory/constitution.md` v1.0.0

## Executive Summary

This feature transforms KB/CL from a passive data store into the primary driver of draft quality. Three interrelated changes work together: (1) per-field KB search replaces the single-query approach so relevant content actually surfaces, (2) customer-specific entries are boosted so customer-uploaded docs flow into drafts, and (3) KB answers pre-fill clarifying questions so users aren't asked for information they already uploaded. A fourth change extracts and preserves RFP metadata (title, dates, issuing org) for output fidelity.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Pipeline 1: process-rfp                   │
│                                                              │
│  Step 4: analyze-document ──► [NEW] Extract metadata         │
│                                      ├── extractedMetadata   │
│                                      └── auto-fill rfp cols  │
│                                                              │
│  Step 5: generate-responses                                  │
│           └── [CHANGED] searchByRequirements (per-field)     │
│               ├── batch embeddings (generateEmbeddings)      │
│               ├── customer ID scoping + 1.3x boost          │
│               └── deduplication                              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               Draft Creation: createDraft                    │
│                                                              │
│  [NEW] Step A: Fetch KB topics for question suppression      │
│  Step B: generateClarifyingQuestions (existing, now with      │
│          populated knowledgeTopics/contentLibraryCategories)  │
│  [NEW] Step C: Per-question KB search → attach suggestions   │
│                ├── suggestedAnswer                            │
│                ├── kbSourceTitle                              │
│                └── suggestionConfidence                       │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Pipeline 2: generate-proposal                   │
│                                                              │
│  Step 2: search-requirements                                 │
│           └── [CHANGED] searchByRequirements + customerId    │
│               └── 1.3x customer boost                        │
│                                                              │
│  Step 8: generate-proposal-content                           │
│           └── [CHANGED] writeProposal receives rfpMetadata   │
│               ├── rfpTitle (verbatim)                         │
│               ├── issuingOrganization                         │
│               └── submissionDeadline                          │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    UI: ClarifyingQuestionsForm                │
│                                                              │
│  [CHANGED] Textarea pre-filled from suggestedAnswer          │
│  [NEW] "Auto-answered from Knowledge Base" badge             │
│  [NEW] Source attribution (kbSourceTitle)                     │
└──────────────────────────────────────────────────────────────┘
```

## Technology Stack

All changes use existing project technologies:
- **Drizzle ORM** — 1-line migration for `extractedMetadata` column
- **Vercel AI SDK** — `generateObject` for metadata extraction, `embedMany` for batch embeddings
- **pgvector** — Existing cosine distance search, no index changes required
- **Zod** — Schema validation for new metadata and extended question interfaces
- **React / shadcn/ui** — UI changes to ClarifyingQuestionsForm

No new dependencies.

## Implementation Phases

### Phase A: Data Model & Retrieval Enhancement
**Goal:** Per-field KB search works with customer prioritization in both pipelines.

| Step | File | Change | FR |
|------|------|--------|----|
| A1 | `drizzle/0009_kb_driven_draft_intelligence.sql` | Add `extracted_metadata` JSONB column to `rfps` | FR-006 |
| A2 | `src/lib/db/schema/rfps.ts` | Add `extractedMetadata` column + TypeScript type | FR-006 |
| A3 | `src/lib/services/proposal-retrieval.ts` | Add `customerId` param to `searchByRequirements`, add customer union filter to per-field queries, apply 1.3x score boost to customer entries, switch to batch `generateEmbeddings` | FR-001, FR-002, FR-008, FR-009 |
| A4 | `src/lib/inngest/functions/process-rfp.ts` | Replace `searchSimilar(rfp.name)` with `searchByRequirements(fields, orgId, customerId)` in Step 5 | FR-001, FR-002 |
| A5 | `src/lib/inngest/functions/generate-proposal.ts` | Pass `rfp.customerId` to `searchByRequirements` in Step 2 | FR-002 |

**Tests (A):**
- `searchByRequirements` with `customerId`: verify customer entries get 1.3x boost
- `searchByRequirements` without `customerId`: verify unchanged org-wide behavior
- `searchByRequirements` deduplication: verify highest score kept per entry
- `searchByRequirements` batch embedding: verify single `generateEmbeddings` call replaces N individual calls
- `searchByRequirements` field cap: verify cap is respected (default 20)
- Process-RFP integration: verify per-field results passed to response generator
- Generate-proposal integration: verify `customerId` flows through

### Phase B: RFP Metadata Extraction
**Goal:** Document analyzer extracts structured metadata, stored on RFP, used in proposals.

| Step | File | Change | FR |
|------|------|--------|----|
| B1 | `src/lib/ai/agents/document-analyzer.ts` | Extend output schema with `metadata` object (title, issuingOrg, deadline, etc.). Add extraction instructions to system prompt. | FR-005 |
| B2 | `src/lib/inngest/functions/process-rfp.ts` | Store `analyzed.metadata` → `rfps.extractedMetadata`. Auto-populate `dueDate`, `customerCompanyName` when null. | FR-006 |
| B3 | `src/lib/ai/agents/proposal-writer.ts` | Add `rfpMetadata` to `WriteProposalInput`. Update system prompt: use exact title in `# Proposal` heading, include issuing org and deadline verbatim. | FR-007, FR-012 |
| B4 | `src/lib/inngest/functions/generate-proposal.ts` | Read `rfp.extractedMetadata` in Step 1, pass to `writeProposal` in Step 8. | FR-006 |

**Tests (B):**
- Document analyzer: verify metadata extraction with fixture RFP text (title, org, dates)
- Document analyzer: verify null metadata when RFP has no clear title/dates (no fabrication)
- Process-RFP: verify `extractedMetadata` stored on RFP record
- Process-RFP: verify auto-populate respects existing user-entered values
- Proposal writer: verify output title matches extracted title
- Proposal writer: verify fallback to `rfp.name` when no extracted title

### Phase C: KB Pre-Fill for Clarifying Questions
**Goal:** Questions pre-filled from KB, user sees fewer gaps to fill manually.

| Step | File | Change | FR |
|------|------|--------|----|
| C1 | `src/lib/db/schema/proposal-drafts.ts` | Extend `ClarifyingQuestion` interface with `suggestedAnswer`, `kbSourceId`, `kbSourceTitle`, `suggestionConfidence` | FR-003 |
| C2 | `src/lib/services/proposal-draft.ts` | In `createDraft`: (1) fetch KB topics/categories and pass to question generator, (2) after generation, search KB per-question and attach suggestions | FR-003 |
| C3 | `src/lib/services/proposal-draft.ts` | In `submitAnswers`: preserve suggestion fields during answer merge | FR-003 |
| C4 | `src/lib/ai/agents/proposal-question-generator.ts` | No code change needed — already accepts `knowledgeTopics` and `contentLibraryCategories`, just needs real data | FR-003 |
| C5 | `src/app/api/rfps/[rfpId]/proposals/[draftId]/answers/route.ts` | No schema change needed — `answer` field carries the final resolved text regardless of source | FR-004 |

**Tests (C):**
- `createDraft` with KB entries matching 3 of 7 questions: verify `suggestedAnswer` attached to those 3
- `createDraft` with empty KB: verify all questions have null suggestions
- `createDraft`: verify mandatory questions (deliverables, exclusions, timeline) never get suggestedAnswer from KB
- `submitAnswers`: verify suggestion fields preserved after answer merge
- Integration: verify `knowledgeTopics` populated from real KB data

### Phase D: UI — Pre-Fill Display
**Goal:** ClarifyingQuestionsForm shows KB suggestions with attribution.

| Step | File | Change | FR |
|------|------|--------|----|
| D1 | `src/components/rfp/ClarifyingQuestionsForm.tsx` | Initialize textarea state from `q.suggestedAnswer` instead of empty string | FR-003 |
| D2 | `src/components/rfp/ClarifyingQuestionsForm.tsx` | Render "Auto-answered from Knowledge Base" badge with `kbSourceTitle` when `suggestedAnswer` is present | FR-010 |
| D3 | `src/components/rfp/ClarifyingQuestionsForm.tsx` | Add "Clear suggestion" button that empties the textarea and removes the badge | FR-003 |

**Tests (D):**
- Component renders pre-filled text from `suggestedAnswer`
- Component shows attribution badge when `kbSourceTitle` present
- Component allows user to edit pre-filled text (badge remains until cleared)
- Component allows user to clear suggestion (textarea empties, badge disappears)
- Component renders normally when no suggestions exist (backward compatible)

### Phase E: Source Attribution in Proposals (P3 — can be deferred)
**Goal:** Proposal sections cite KB sources via inline blockquotes.

| Step | File | Change | FR |
|------|------|--------|----|
| E1 | `src/lib/ai/agents/proposal-writer.ts` | Update prompt to include KB source titles per section in context block. Instruct model to cite sources in `> *Source: [title]*` blockquotes. | FR-010 |
| E2 | `src/lib/ai/agents/response-generator.ts` | Ensure `sources` field in response output includes KB entry titles (already partially done — verify completeness) | FR-010 |

**Tests (E):**
- Proposal writer output contains source blockquotes referencing KB entry titles
- Sections with no KB match show `> *Source: No knowledge base match*` or similar

## Security Considerations

- **Tenant isolation maintained:** All KB searches are scoped by `organizationId` (existing pattern, no change)
- **Customer scoping:** Customer entries are filtered by `customerId` OR null — no cross-customer leakage
- **No PII in logs:** Metadata extraction may contain contact info — ensure error logging sanitizes as per existing patterns
- **Prompt injection:** RFP metadata (title, org name) is inserted into prompts. The document analyzer already processes raw document text, so this doesn't expand the attack surface. Metadata fields are used as context, not as instructions.
- **API key handling:** Batch embedding uses the same BYOK key path as existing individual calls — no change to key management.

## Performance Strategy

- **Batch embeddings:** `generateEmbeddings` reduces N API round-trips to 1 for per-field search. For 20 fields, this saves ~19 round-trips (~2-4 seconds).
- **Field cap:** `REQUIREMENT_SEARCH_CAP` raised from 10 to 20 (configurable). Hard limit prevents runaway cost on large RFPs.
- **`RESULTS_PER_REQUIREMENT`:** Kept at 5. With 20 fields × 5 results = 100 max raw results before deduplication.
- **Customer boost:** Post-query score multiplication — zero additional DB queries.
- **Clarifying question KB search:** 1-7 questions × 1 embedding each. Negligible latency. Can batch these too.
- **Target:** Per-field search for 20-field RFP < 15 seconds total (SC-004).

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | Vitest | `searchByRequirements` boost logic, deduplication, metadata extraction schema, question pre-fill matching |
| Unit | Vitest | Proposal writer prompt assembly with metadata |
| Integration | Vitest + mocked AI | Full `process-rfp` pipeline with per-field search, `createDraft` with KB pre-fill |
| Component | Vitest + React Testing Library | ClarifyingQuestionsForm pre-fill rendering, badge display, clear behavior |
| E2E | Playwright (deferred) | Upload RFP → verify KB content appears in draft |

Coverage target: 80%+ on all new code (Constitution Principle V).

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Batch embedding API call fails for all fields | Medium | Graceful degradation: return empty results, pipeline continues with no KB context (existing pattern) |
| 1.3x boost multiplier too aggressive or too weak | Low | Make `CUSTOMER_BOOST_FACTOR` a named constant, easy to tune. Start at 1.3, adjust based on testing |
| Metadata extraction hallucination (LLM fabricates title/dates) | Medium | Prompt explicitly says "return null if not clearly stated." Fallback to `rfp.name` for title. User-entered values take precedence. |
| Pre-fill wrong answer from KB (low-relevance match presented as suggestion) | Medium | Only attach suggestion when `similarity >= 0.7` threshold. Display confidence so user can judge. |
| Large KB (500+ entries) causes slow per-field search | Low | Field cap (20) + results cap (5 per field) + deduplication bounds total work. HNSW index recommended for production scale (deferred). |

## Constitutional Compliance

| Principle | How Plan Addresses It |
|-----------|----------------------|
| I. Tenant Isolation | All KB searches scoped by `organizationId`. Customer filter uses union (customer OR null), never cross-tenant. |
| II. Type Safety | All new interfaces fully typed. `ExtractedRfpMetadata` is a strict TypeScript interface. `ClarifyingQuestion` extensions are optional fields for backward compatibility. |
| III. Explicit Over Implicit | Customer boost is an explicit 1.3x multiplier, not hidden logic. Pre-filled answers are visibly tagged, not silently injected. |
| IV. Secure by Default | No new attack surface. Metadata fields are context, not instructions. Error logs sanitized per existing patterns. |
| V. 80% Coverage | Test plan covers unit, integration, and component layers. All phases include explicit test requirements. |
| VI. Test the Agents | Document analyzer metadata extraction tested with fixture RFP text. Proposal writer metadata handling tested with mocked AI. |
| VII. Integration Tests | Process-RFP and generate-proposal pipelines tested end-to-end with mocked external calls. |
| VIII. Document Fidelity | Not directly affected. This feature changes proposal markdown content, not PDF overlay rendering or Word template structure. The existing export pipeline renders markdown unchanged. Phase B quality gate includes manual verification that metadata in the title (`# Proposal: [RFP title]`) renders correctly in Word/PDF export. |
| IX. Progressive Disclosure | KB suggestions are pre-filled but not forced. Attribution badges are informational. Coverage metric is a summary number. |
| X. Human Always in Control | Pre-filled answers are editable and clearable. User can override any KB suggestion. Mandatory questions always shown. |
| XI. Consistent Feedback | KB suggestion badges use existing shadcn Badge component. Loading/error states follow existing patterns. |
| XII. Accessible First | Phase D quality gate verifies keyboard navigation for badge and clear button. Color is not the sole indicator for suggestions. |
| XV. Efficient Vector Search | Each individual pgvector query targets <500ms. Batch embedding is a single API call. 20 parallel queries execute concurrently, keeping total wall time under 15 seconds (SC-004). HNSW index recommended for production scale. |
| XVI. Graceful Degradation | Empty KB = no suggestions, pipeline continues. Failed embedding = empty results. Missing metadata = null fields, fallback to rfp.name. |

**Exceptions:** None.

## Implementation Order

```
Phase A (retrieval) ──► Phase B (metadata) ──► Phase C (pre-fill) ──► Phase D (UI) ──► Phase E (attribution, P3)
     │                       │                       │
     │                       │                       └─ Depends on A (KB search) + question schema
     │                       └─ Independent of A, but sequenced for testing
     └─ Foundation — all other phases use enhanced search
```

Phases A and B are independent and could be parallelized, but sequencing A first allows B's integration tests to use the improved search. Phase E is P3 and can be deferred.
