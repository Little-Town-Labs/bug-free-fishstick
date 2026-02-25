# Implementation Roadmap: Structured Proposal Bid Engine

**PRD Source:** `docs/prd-proposal-bid-engine.md` (v1.1)
**Created:** 2026-02-25
**Constitution:** `.specify/memory/constitution.md` (v1.0.0)

---

## Executive Summary

The Structured Proposal Bid Engine transforms the current proposal generator from a narrative drafting tool into a complete bid submission system. It adds deterministic pricing, verbatim legal template injection, requirement-driven retrieval, and post-generation coverage validation.

| Metric | Value |
|---|---|
| Total Features | 10 |
| Phases | 4 |
| P0 Critical | 3 |
| P1 High | 4 |
| P2 Medium | 3 |
| Critical Path | F1 → F2 → F5 → F8 → F9 → F10 |
| Parallel Opportunities | F3 alongside F2; F4/F5/F6 in parallel; F7 alongside early F8 planning |

---

## Feature Inventory

### Feature 1: `001-data-model-foundation`
**PRD Source:** §6.1, §6.2, §6.6, §7
**Description:** Single Drizzle migration that lands all schema changes needed by downstream features. No UI. No business logic. Just the data model.

**Changes:**
- `tenant_settings`: add `rateCard` (JSONB), `proposalDefaults` (JSONB), `companyProfile` (text)
- `proposal_templates`: new table (id, organizationId, section enum, title, content, isRequired, triggerRfpTypes, triggerIndustryTags, evaluateCoverage, sortOrder, createdBy, timestamps)
- `proposal_drafts`: add `coverageReport` (JSONB)
- TypeScript types and Zod schemas for all new structures

**Priority:** P0 — Critical (blocks all other features)
**Complexity:** Small
**Depends on:** None
**Blocks:** All other features

---

### Feature 2: `002-rate-card-management`
**PRD Source:** §5 US1, §6.1
**Description:** Settings UI and API for the organization rate card. Supports blended (single rate) and by-role modes, margin, pricing model, payment terms, and customer discount rules.

**Deliverables:**
- Settings page section: Rate Card
- Blended/By Role toggle with conditional form fields
- Role table (add/edit/remove) for by-role mode
- Margin %, pricing model selector, payment terms input
- Discount rules list (add/edit/remove/reorder)
- `GET/PATCH /api/settings/rate-card` API routes
- Zod validation, tenant-scoped reads and writes

**Priority:** P0 — Critical (pricing engine depends on rate card data)
**Complexity:** Medium
**Depends on:** Feature 1
**Blocks:** Feature 5 (pricing engine needs data to compute against)

---

### Feature 3: `003-company-profile`
**PRD Source:** §5 US3, §6.7
**Description:** Markdown editor in settings for the supplier's company profile. Single field, gracefully omitted when empty.

**Deliverables:**
- Settings page section: Company Profile (markdown textarea)
- `GET/PATCH /api/settings/company-profile` API routes
- Profile surfaced in proposal pipeline (wired in Feature 8)

**Priority:** P2 — Medium
**Complexity:** Small
**Depends on:** Feature 1
**Blocks:** Feature 8 (pipeline reads it)
**Note:** Can be built in parallel with Feature 2

---

### Feature 4: `004-proposal-template-library`
**PRD Source:** §5 US2, §6.2
**Description:** Full CRUD UI for the proposal template library. Templates are contract clauses injected verbatim into proposals. Supports required vs situational (triggered by RFP type / industry tags), sort ordering, and per-template `evaluateCoverage` flag.

**Deliverables:**
- Settings page section: Proposal Templates
- List grouped by section type with sort handles
- Add/edit/delete template modal
- Required toggle (enforces evaluateCoverage=false when required=true)
- Trigger tags inputs (rfpType multi-select, industryTags free-entry)
- `GET/POST/PATCH/DELETE /api/settings/proposal-templates` API routes
- Zod validation, tenant-scoped

**Priority:** P1 — High
**Complexity:** Medium
**Depends on:** Feature 1
**Blocks:** Feature 8 (pipeline fetches templates)
**Note:** Can be built in parallel with Feature 5 and Feature 6

---

### Feature 5: `005-pricing-computation-engine`
**PRD Source:** §5 US5, §6.3
**Description:** Pure TypeScript pricing function. No LLM involvement. Takes rate card + scope lines + pricing model, produces a structured `PricingEstimate` with formatted markdown table. Comprehensive unit tests verify arithmetic correctness for both modes and all discount configurations.

**Deliverables:**
- `src/lib/services/pricing-computation.ts` — `computePricingEstimate()` function
- Blended mode: single rate × total hours
- By-role mode: per-line role lookup with fallback to first role
- Discount application (after margin, in order, customer-scoped)
- `formattedMarkdown` output: line-item table + subtotal + margin + discounts + total
- Graceful degradation: returns placeholder markdown when rate card missing or scope answers absent
- Unit tests for: blended/by-role, T&M/fixed/cost-plus, discounts (percentage + fixed, customer-specific + universal), missing rate card, missing scope, math edge cases

**Priority:** P0 — Critical (pricing section cannot exist without this)
**Complexity:** Medium
**Depends on:** Feature 1 (types), Feature 2 (rate card data at runtime)
**Blocks:** Feature 8 (pipeline calls this function)

---

### Feature 6: `006-scope-clarifying-questions`
**PRD Source:** §5 US4
**Description:** Extend the clarifying question generator to always include pricing, scope, exclusions, and timeline questions. The pricing question format adapts to the org's configured pricing model.

**Deliverables:**
- Update `src/lib/ai/agents/proposal-question-generator.ts`
- Read `proposalDefaults.pricingModel` from tenant settings
- Always inject: deliverables+effort question (or fixed price question), exclusions question, timeline question
- Adapt effort question wording: T&M asks for hours per deliverable; fixed price asks for total; cost-plus asks for cost and margin target
- Update system prompt to communicate pricing context
- Tests: mocked LLM, verify pricing questions always present, verify format adapts by pricing model

**Priority:** P1 — High
**Complexity:** Small
**Depends on:** Feature 1 (proposalDefaults column), Feature 2 (pricing model value at runtime)
**Blocks:** Feature 8 (pipeline parses answers to feed pricing computation)
**Note:** Can be built in parallel with Features 4 and 5

---

### Feature 7: `007-requirement-driven-retrieval`
**PRD Source:** §5 US6 (retrieval portion), §6.4 Steps 2–4
**Description:** Replace the single `rfp.name` vector search with per-requirement searches and typed knowledge base queries. Separate, independent module — can be developed and tested before the full pipeline rebuild.

**Deliverables:**
- New function `src/lib/services/proposal-retrieval.ts`:
  - `searchByRequirements(fields, orgId, openaiKey)` — one embedding per requirement question, deduplicated results
  - `fetchTypedSupplierContext(orgId, industryTags, rfpType, openaiKey)` — separate queries per knowledge type:
    - `company_doc` entries (identity context)
    - `certification` entries
    - `case_study` entries
    - `past_rfp` entries where `outcome = 'won'` filtered by `industryTags` overlap
  - `fetchCustomerContext(customerId, orgId)` — loads customer settings (tone, industry, instructions)
  - `fetchLearnings(orgId, customerId)` — loads learnings, customer-specific first
- Unit tests: mocked DB results, verify deduplication, verify type filters, verify outcome filter on past_rfp

**Priority:** P1 — High
**Complexity:** Medium
**Depends on:** Feature 1
**Blocks:** Feature 8 (pipeline calls these functions)
**Note:** Can begin development in parallel with Phase 2 features

---

### Feature 8: `008-revised-proposal-pipeline`
**PRD Source:** §5 US6 (generation), §5 US7, §6.4, §6.7 (settings context)
**Description:** Rebuild the `generate-proposal` Inngest function with the full 11-step pipeline. Wires together all Phase 1–2 deliverables. Updates the proposal writer prompt to narrative-only. Injects pre-computed pricing. Appends templates verbatim post-generation.

**Deliverables:**
- Rewrite `src/lib/inngest/functions/generate-proposal.ts`:
  - Step 1: `fetch-draft-and-rfp` (unchanged)
  - Step 2: `fetch-customer-context` (calls `fetchCustomerContext`)
  - Step 3: `search-requirements` (calls `searchByRequirements`)
  - Step 4: `fetch-typed-supplier-context` (calls `fetchTypedSupplierContext`, includes company profile from tenantSettings)
  - Step 5: `fetch-required-templates` (queries proposal_templates where isRequired=true)
  - Step 6: `fetch-situational-templates` (queries by trigger tags matching RFP)
  - Step 7: `compute-pricing` (calls `computePricingEstimate` with rate card + clarifying answer scope lines)
  - Step 8: `generate-proposal-content` (updated `writeProposal` with new structured prompt)
  - Step 9: `check-requirement-coverage` (calls coverage checker agent — stub/passthrough if Feature 9 not yet merged)
  - Step 10: `inject-required-templates` (deterministic verbatim append)
  - Step 11: `save-proposal-content` (saves markdown + coverage report)
- Update `src/lib/ai/agents/proposal-writer.ts` with restructured prompt (customer requirements section, typed supplier context blocks, pre-computed pricing injection, instruction not to generate T&C)
- Scope line parser: extract deliverable/hours data from clarifying answers to feed `computePricingEstimate`
- Integration tests: mock all external calls, verify pipeline executes all steps in order, verify template content not modified, verify pricing table present in output

**Priority:** P0 — Critical (this is the integration keystone)
**Complexity:** Large
**Depends on:** Features 1, 2, 3, 4, 5, 6, 7
**Blocks:** Feature 9 (coverage step is in this pipeline)

---

### Feature 9: `009-coverage-checker-agent`
**PRD Source:** §5 US8, §6.5
**Description:** New AI agent that evaluates whether the generated proposal addresses each RFP requirement. Runs as an Inngest step inside the pipeline (wired in Feature 8 stub). Provides on-demand re-evaluation endpoint.

**Deliverables:**
- New agent `src/lib/ai/agents/proposal-coverage-checker.ts` using `generateObject`
- System prompt: evaluates each requirement against proposal sections; assigns addressed/gap + evidence quote
- Zod output schema: `{ coverageScore, requirements[{ requirementId, question, addressed, evidence, gap }] }`
- `POST /api/rfps/[rfpId]/proposals/[draftId]/coverage` — triggers re-evaluation, saves result, returns report
- Feature 8 step 9 is un-stubbed to call this agent
- Tests: mocked LLM with fixtures for fully-addressed, all-placeholder, and mixed proposals

**Priority:** P1 — High
**Complexity:** Medium
**Depends on:** Feature 8 (needs pipeline output to evaluate)
**Blocks:** Feature 10 (UI needs the stored coverage report)

---

### Feature 10: `010-coverage-report-ui`
**PRD Source:** §5 US9, §6.8
**Description:** Coverage report panel on the proposal view page. Shows score badge, per-requirement pass/fail list with expandable evidence/gap, Re-check button, last-checked timestamp, and visual distinction for supplier-controlled template sections.

**Deliverables:**
- New component `src/components/rfp/CoverageReport.tsx`
- Score badge (colored: green ≥80, amber 60–79, red <60)
- Collapsible requirements list: requirement text, addressed icon, expandable evidence or gap description
- Requirements with `[PLACEHOLDER]` in evidence marked as gaps automatically (client-side)
- Re-check button → calls `POST .../coverage` endpoint → refreshes panel
- Last-checked timestamp display
- Supplier Terms section visually labelled and excluded from score
- Wired into `src/app/(auth)/rfps/[id]/proposal/page.tsx` in the viewing step

**Priority:** P2 — Medium
**Complexity:** Medium
**Depends on:** Feature 9
**Blocks:** Nothing

---

## Dependency Graph

```
F1 (schema)
├── F2 (rate card UI) ──────────────────────────────────┐
├── F3 (company profile) ───────────────────────────────┤
├── F4 (template library) ──────────────────────────────┤
├── F5 (pricing engine) ← F2 (reads rate card) ─────────┤
├── F6 (scope questions) ← F2 (reads pricing model) ────┤
└── F7 (retrieval module) ──────────────────────────────┤
                                                         ▼
                                                    F8 (pipeline rebuild)
                                                         │
                                                    F9 (coverage agent)
                                                         │
                                                   F10 (coverage UI)
```

**Critical Path:** F1 → F2 → F5 → F8 → F9 → F10

**Parallel Opportunities:**
- F3 can be built simultaneously with F2 (same phase, no interdependency)
- F4, F5, F6 can all be built simultaneously in Phase 2
- F7 can begin in parallel with Phase 2 (no Phase 2 deps)

---

## Implementation Phases

### Phase 1: Data Model & Settings Foundation
**Goal:** All schema changes live in production. Admin can configure rate card and company profile. Nothing downstream is connected yet.

| Feature | Priority | Complexity | Parallel with |
|---|---|---|---|
| F1: Data Model Foundation | P0 | Small | — |
| F2: Rate Card Management | P0 | Medium | F3 |
| F3: Company Profile | P2 | Small | F2 |

**Phase 1 Gate:**
- [ ] Migration applied to production without errors
- [ ] Admin can save and retrieve rate card (blended and by-role modes)
- [ ] Admin can save and retrieve company profile
- [ ] All new data is tenant-isolated (verified by tests)
- [ ] TypeScript types exported and used in dependent code stubs

---

### Phase 2: Commercial Engine
**Goal:** Pricing computes correctly. Template library is manageable. Clarifying questions ask the right scope questions. All three can be built in parallel.

| Feature | Priority | Complexity | Parallel with |
|---|---|---|---|
| F4: Proposal Template Library | P1 | Medium | F5, F6 |
| F5: Pricing Computation Engine | P0 | Medium | F4, F6 |
| F6: Scope Clarifying Questions | P1 | Small | F4, F5 |

**Phase 2 Gate:**
- [ ] Admin can add, edit, delete, and reorder proposal templates
- [ ] Required templates flagged; trigger tags save correctly
- [ ] `computePricingEstimate` unit tests pass for all modes and discount configurations
- [ ] Zero arithmetic errors in pricing function (verified by test suite)
- [ ] Clarifying questions always include pricing/scope/exclusions/timeline questions
- [ ] Pricing question wording adapts correctly to pricing model

---

### Phase 3: Pipeline Rebuild
**Goal:** The full proposal generation pipeline is operational end-to-end. This is the highest-risk phase — it touches the most code and integrates all prior work.

| Feature | Priority | Complexity | Parallel with |
|---|---|---|---|
| F7: Requirement-Driven Retrieval | P1 | Medium | Early F8 planning |
| F8: Revised Proposal Pipeline | P0 | Large | — (F7 must complete first) |

**Phase 3 Gate:**
- [ ] `searchByRequirements` returns different results than single-query search (tested with fixture RFP)
- [ ] Typed knowledge queries return correct entry types (no cross-type leakage)
- [ ] Generated proposal contains pre-computed pricing table verbatim
- [ ] Template content in output is character-for-character identical to stored template (verified by integration test)
- [ ] LLM is not asked to generate Terms & Conditions sections
- [ ] Pipeline completes end-to-end for a 20-field RFP in under 60 seconds
- [ ] Graceful degradation: proposal generates without error when rate card is unconfigured

---

### Phase 4: Quality Gate
**Goal:** Every proposal is validated against its requirements. Preparers have a clear signal of what needs human attention before submission.

| Feature | Priority | Complexity | Parallel with |
|---|---|---|---|
| F9: Coverage Checker Agent | P1 | Medium | F10 planning |
| F10: Coverage Report UI | P2 | Medium | — (F9 must complete first) |

**Phase 4 Gate:**
- [ ] Coverage report generated and stored for every new proposal
- [ ] Re-check endpoint triggers fresh evaluation and updates stored report
- [ ] Coverage score badge shows correct color bands (green/amber/red)
- [ ] Per-requirement pass/fail list renders with evidence/gap expandable
- [ ] `[PLACEHOLDER]` content is auto-flagged as gap without LLM call
- [ ] Supplier Terms sections visually distinct and excluded from score
- [ ] Last-checked timestamp visible in UI

---

## Execution Checklist

### Pre-Implementation
- [x] PRD reviewed and approved (`docs/prd-proposal-bid-engine.md` v1.1)
- [x] All open questions resolved (§12)
- [x] Features identified and numbered (10 features)
- [x] Dependencies mapped
- [x] Priorities assigned
- [x] Phases defined
- [x] Constitutional compliance verified (see §below)

### Phase 1: Data Model & Settings Foundation

- [ ] **F1: Data Model Foundation**
  - [ ] `/speckit-specify 001-data-model-foundation`
  - [ ] Write Drizzle migration
  - [ ] Export TypeScript types
  - [ ] Verify migration applies cleanly on dev database
  - [ ] Deploy migration

- [ ] **F2: Rate Card Management**
  - [ ] `/speckit-specify 002-rate-card-management`
  - [ ] API routes (GET/PATCH)
  - [ ] Settings UI (rate card section)
  - [ ] Tests: validation, tenant isolation, blended/by-role modes
  - [ ] Phase 1 gate check

- [ ] **F3: Company Profile** *(parallel with F2)*
  - [ ] `/speckit-specify 003-company-profile`
  - [ ] API routes (GET/PATCH)
  - [ ] Settings UI (profile markdown editor)
  - [ ] Tests

**Phase 1 Completion Gate** *(all items above checked)*

### Phase 2: Commercial Engine

- [ ] **F4: Proposal Template Library**
  - [ ] `/speckit-specify 004-proposal-template-library`
  - [ ] New table API routes (CRUD)
  - [ ] Settings UI (list + modal)
  - [ ] Tests: CRUD, sort order, required/evaluateCoverage enforcement

- [ ] **F5: Pricing Computation Engine** *(parallel with F4)*
  - [ ] `/speckit-specify 005-pricing-computation-engine`
  - [ ] `computePricingEstimate` function
  - [ ] Markdown formatter
  - [ ] Unit tests (all modes, discounts, edge cases)

- [ ] **F6: Scope Clarifying Questions** *(parallel with F4, F5)*
  - [ ] `/speckit-specify 006-scope-clarifying-questions`
  - [ ] Update `proposal-question-generator.ts`
  - [ ] Tests: pricing questions present, wording adapts by model

**Phase 2 Completion Gate** *(all items above checked)*

### Phase 3: Pipeline Rebuild

- [ ] **F7: Requirement-Driven Retrieval**
  - [ ] `/speckit-specify 007-requirement-driven-retrieval`
  - [ ] `proposal-retrieval.ts` module
  - [ ] Tests: deduplication, type filters, outcome filter

- [ ] **F8: Revised Proposal Pipeline**
  - [ ] `/speckit-specify 008-revised-proposal-pipeline`
  - [ ] Rewrite `generate-proposal.ts` (11 steps)
  - [ ] Update `proposal-writer.ts` prompt
  - [ ] Scope line parser for clarifying answers
  - [ ] Integration tests (full pipeline with mocks)
  - [ ] Performance test: <60s for 20-field RFP

**Phase 3 Completion Gate** *(all items above checked)*

### Phase 4: Quality Gate

- [ ] **F9: Coverage Checker Agent**
  - [ ] `/speckit-specify 009-coverage-checker-agent`
  - [ ] `proposal-coverage-checker.ts` agent
  - [ ] Re-evaluation API endpoint
  - [ ] Un-stub pipeline step 9
  - [ ] Tests: mocked LLM, fixture proposals

- [ ] **F10: Coverage Report UI**
  - [ ] `/speckit-specify 010-coverage-report-ui`
  - [ ] `CoverageReport.tsx` component
  - [ ] Wire into proposal page
  - [ ] Tests: score bands, placeholder detection, re-check flow

**Phase 4 Completion Gate** *(all items above checked)*

---

## Risk Assessment

### F1 — Data Model Foundation
**Technical Risk:** Migration conflicts with in-flight proposals during deploy (Low — new nullable columns only)
**Mitigation:** All new columns are nullable or have defaults; existing rows unaffected

### F2 — Rate Card Management
**Technical Risk:** JSONB validation gaps allowing malformed rate card data to reach pricing engine (Medium)
**Mitigation:** Zod schema validates at API boundary before write; pricing engine has its own defensive parsing

### F5 — Pricing Computation Engine
**Technical Risk:** Floating point rounding errors on currency arithmetic (Medium)
**Mitigation:** Use integer cent arithmetic internally, format to 2 decimal places on output; test with known decimal edge cases (e.g. $33.33/hr × 3 hours)

### F6 — Scope Clarifying Questions
**Technical Risk:** LLM ignores scope question injection, generates unrelated questions (Low)
**Mitigation:** System prompt enforces inclusion; test verifies required question types present regardless of RFP content

### F7 — Requirement-Driven Retrieval
**Technical Risk:** Per-requirement embedding calls increase OpenAI API cost significantly for large RFPs (Medium)
**Mitigation:** Cap at 10 requirements per search pass; deduplicate results before passing to writer; graceful degradation if no API key

### F8 — Revised Proposal Pipeline
**Technical Risk:** 11-step Inngest pipeline increases end-to-end latency beyond 60s target (High)
**Mitigation:** Steps 3–6 can be parallelized inside a `step.run` using Promise.all; test performance before declaring phase complete; profile step durations in staging

**Technical Risk:** Scope line parser fails to extract structured data from freeform clarifying answers (Medium)
**Mitigation:** Fallback to `[PLACEHOLDER: pricing details required]` when parser cannot extract; never fail generation

### F9 — Coverage Checker Agent
**Technical Risk:** Coverage checker returns inconsistent scores for the same proposal (Medium — LLM non-determinism)
**Mitigation:** Prompt uses structured examples; use temperature=0 if supported; on-demand (not blocking) so occasional inaccuracy is acceptable

### F10 — Coverage Report UI
**Technical Risk:** `[PLACEHOLDER]` auto-detection has false positives (Low)
**Mitigation:** Only scan for the exact string `[PLACEHOLDER:` in proposal markdown; bounded pattern

---

## Constitutional Compliance

**Reading:** `.specify/memory/constitution.md` v1.0.0

| Principle | How Roadmap Addresses It |
|---|---|
| I. Tenant Isolation | Every feature spec must include tenant-scoped DB queries. Rate card, templates, coverage reports all keyed by `organizationId`. Phase gates require isolation tests. |
| II. Type Safety | F1 exports TypeScript types first; all downstream features import from there. Zod validation at all API boundaries. No `any` types in new code. |
| III. Explicit Over Implicit | Pricing is computed by explicit function, not inferred by LLM. Template injection is explicit post-generation append. Coverage report is explicitly requested, not auto-triggered. |
| IV. Secure by Default | Rate card data (margin, discount rules) is sensitive; API routes require auth. No pricing data in error messages. |
| V. 80% Coverage Minimum | Every feature's checklist includes tests. F5 (pricing) requires exhaustive unit tests by design. Phase gates will not pass without coverage. |
| VI. Test the Agents | F9 specifies mocked LLM tests with fixture proposals as a hard deliverable, not optional. |
| VII. Integration Tests for Workflows | F8 requires full pipeline integration test with all steps mocked. Phase 3 gate verifies end-to-end. |
| IX. Progressive Disclosure | Coverage report is collapsible; score badge is the primary signal; detail is on-demand. Rate card complexity is in a separate settings section. |
| X. Human Always in Control | Coverage re-evaluation is on-demand. Pricing is pre-computed but human-editable in the draft. Templates are admin-maintained. |
| XIII. Sub-3-Second Parse | Not directly affected; upstream pipeline unchanged. |
| XIV. Streaming AI Responses | F8 pipeline runs in Inngest (async); existing polling UI unchanged. |
| XV. Efficient Vector Search | F7 caps per-requirement searches; deduplication prevents redundant DB hits. |
| XVI. Graceful Degradation | F5 returns placeholder when rate card missing. F7 returns empty when no API key. F8 never fails generation due to missing optional context. |

**Status:** ✅ All applicable constitutional principles addressed

---

## Next Steps

Start with Phase 1, Feature 1:

```
/speckit-specify 001-data-model-foundation
```

Use `docs/prd-proposal-bid-engine.md` §6.1, §6.2, §6.6, and §7 as the input.

**Recommended approach:** Specify each feature immediately before implementing it (phase-by-phase), rather than specifying all 10 upfront. This allows learnings from earlier phases to sharpen later specifications.

```
Phase 1:  specify → implement F1, F2, F3
Phase 2:  specify → implement F4, F5, F6 (parallel)
Phase 3:  specify → implement F7, then F8
Phase 4:  specify → implement F9, then F10
```
