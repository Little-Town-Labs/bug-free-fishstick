# Feature Specification: F8 — Revised Proposal Pipeline

**Feature ID:** F8
**Branch:** `008-revised-proposal-pipeline` (stay on `main` — no branch switch)
**PRD Source:** `docs/prd-proposal-bid-engine.md` §5 US5, US6, US7, US8 (partial), §6.4, §6.7
**Depends on:** F1, F2, F3, F4, F5, F6, F7 (all complete)
**Blocks:** F9 (coverage checker agent — step 9 is a stub here, un-stubbed by F9)
**Status:** Ready for planning

---

## Overview

The current proposal generation pipeline (`generate-proposal`) produces a narrative text draft from an RFP but has three critical gaps: it does not include deterministic pricing, it does not inject verbatim contract templates, and it does not validate coverage against RFP requirements.

F8 rebuilds this pipeline from 6 steps to 11 steps. It is the integration keystone that wires together all Phase 1–2 deliverables (F1–F7). The pipeline remains fully asynchronous (Inngest), adds no new database tables, and introduces no new user-facing UI. Its outputs are immediately visible through the existing proposal draft viewer.

**Business value:**
- Proposals become bid-ready: pricing + commercial terms + requirement coverage in a single generation
- Required contract clauses are immune to LLM paraphrasing — injected verbatim post-generation
- The system has rich, structured access to the supplier's identity, capabilities, and past performance
- Graceful degradation ensures generation never fails due to missing optional context

---

## User Stories

### User Story 1: Requirement-Driven Proposal Generation

**As a** Proposal Preparer
**I want** the generated proposal to address every RFP requirement using the organization's relevant capabilities, past performance, certifications, and customer preferences
**So that** the draft is substantive and specific rather than generic, reducing the manual rewriting I need to do

**Acceptance Criteria:**
- [ ] The proposal contains one section per RFP requirement field (from `parsedStructure.fields`)
- [ ] Knowledge base retrieval uses each requirement's question text as the search query, not just the RFP name
- [ ] The proposal prompt includes separately organized context blocks: company profile, certifications, case studies, and past won proposals filtered by industry tag
- [ ] Customer context (preferred tone, industry, custom instructions) is included in the prompt
- [ ] Organization and customer learnings are included in the prompt context
- [ ] Sections with no available evidence include a `[PLACEHOLDER: ...]` rather than fabricated content
- [ ] Each section includes a source annotation blockquote

**Priority:** High

---

### User Story 2: Deterministic Pricing Section

**As a** Proposal Preparer
**I want** the generated proposal to automatically include a properly formatted pricing section computed from my rate card and scope answers
**So that** I do not need to calculate pricing manually and the figures are arithmetically correct

**Acceptance Criteria:**
- [ ] The pricing section is computed deterministically — the LLM does not perform arithmetic
- [ ] The pricing section shows: line items, subtotal, margin amount, discounts, and total
- [ ] If the preparer answered the scope-deliverables clarifying question, that answer is parsed to extract scope line items
- [ ] If scope data cannot be extracted, a `[PLACEHOLDER: pricing details required]` is inserted
- [ ] The pricing section is inserted at a defined location in the proposal (after the RFP requirement sections, before the template block)
- [ ] The currency appears on all monetary values
- [ ] The pricing model label (T&M, Fixed Price, Cost-Plus) is reflected in the table structure

**Priority:** High

---

### User Story 3: Verbatim Template Injection

**As a** Supplier Admin
**I want** the standard legal clauses I have written to appear in every generated proposal exactly as written
**So that** my commercial protections are never weakened by AI paraphrasing

**Acceptance Criteria:**
- [ ] Required templates (isRequired=true) are appended to every proposal without exception
- [ ] Situational templates are appended when the RFP's rfpType or industryTags match the template's trigger conditions
- [ ] Template content is concatenated to the proposal markdown after LLM generation completes — it is never included in the LLM prompt
- [ ] Template content in the final output is character-for-character identical to the stored template body
- [ ] Templates appear in section type order: Assumptions → Exclusions → Payment Terms → Change Management → IP Ownership → Liability → Force Majeure → Warranty
- [ ] A `---` separator precedes the templates block in the output
- [ ] The LLM is explicitly instructed not to generate Terms & Conditions sections

**Priority:** High

---

### User Story 4: Coverage Report Generation

**As a** Proposal Preparer
**I want** a coverage report stored alongside my generated draft indicating which RFP requirements are addressed and which have gaps
**So that** I know exactly what to review before submitting

**Acceptance Criteria:**
- [ ] A coverage report is stored on the proposal draft after every generation
- [ ] The report includes an overall coverage score (0–100)
- [ ] The report lists every RFP requirement with: requirement ID, question text, addressed (true/false), evidence quote, and gap description
- [ ] The coverage report stored in F8 is produced by a stub (passthrough) until F9 is implemented — the stub produces a report with `coverageScore: 0` and all requirements marked `addressed: false`
- [ ] Template content (injected post-LLM) is marked as supplier-controlled and excluded from coverage evaluation

**Priority:** Medium (stub behavior is acceptable in F8; full behavior in F9)

---

### User Story 5: Graceful Degradation Throughout

**As a** Proposal Preparer
**I want** a proposal to generate successfully even when optional context is missing
**So that** I am not blocked by incomplete configuration

**Acceptance Criteria:**
- [ ] If the rate card is not configured, the proposal generates with `[PLACEHOLDER: pricing details required]` in the pricing section — generation does not fail
- [ ] If the company profile is empty, the company profile context block is omitted — proposal generates normally
- [ ] If no relevant knowledge base entries are found for a requirement, that section includes a `[PLACEHOLDER]` — generation does not fail
- [ ] If the customer context fetch fails or the customer has no settings, generation continues without customer context
- [ ] If template fetching returns zero templates, the templates block is omitted — generation does not fail
- [ ] Every pipeline step failure is handled: partial results propagate, total failure sets draft to error status

**Priority:** High

---

## Functional Requirements

### Pipeline Execution

**FR-001:** The pipeline must execute the following steps in order:
1. `fetch-draft-and-rfp` — load draft and RFP from database; fail if either is missing
2. `fetch-customer-context` — load customer tone, industry, and custom instructions; null on failure
3. `search-requirements` — per-requirement vector search using F7 `searchByRequirements`; empty on failure
4. `fetch-typed-supplier-context` — typed knowledge queries using F7 `fetchTypedSupplierContext`; includes company profile from tenant settings; partial results on failure
5. `fetch-required-templates` — query proposal templates where `isRequired = true`, ordered by `section` enum order then `sortOrder`; empty on failure
6. `fetch-situational-templates` — query proposal templates matching RFP's `rfpType` and `industryTags`; empty on failure
7. `compute-pricing` — parse scope from clarifying answers; call F5 `computePricingEstimate`; return placeholder on failure
8. `generate-proposal-content` — call updated `writeProposal` with all context; includes pre-computed pricing markdown; includes instruction not to generate T&C
9. `check-requirement-coverage` — stub returning `{ coverageScore: 0, requirements: [...allMarkedFalse] }` until F9 is implemented
10. `inject-required-templates` — append `---` separator + all templates (required + situational) in section order to the LLM output
11. `save-proposal-content` — save final markdown + coverage report to the draft record

**FR-002:** Step ordering must be deterministic and sequential. No step may be skipped regardless of input availability.

**FR-003:** Any unhandled exception in a step causes the draft status to be set to `'error'` with the error message stored. The error path must not corrupt the proposal markdown field.

### Scope Line Parser

**FR-004:** A scope line parser must extract structured deliverable data from the answer to the `scope-deliverables` clarifying question (identified by `MANDATORY_QUESTION_IDS.DELIVERABLES = 'scope-deliverables'`).

**FR-005:** The parser must attempt to identify: description, role (optional), quantity (number), and unit (hour/day/fixed) from the free-text answer.

**FR-006:** The parser must return an empty array (triggering placeholder pricing) when the answer is absent, the question was skipped, or the answer cannot be meaningfully parsed — it must never throw.

**FR-007:** Parsing accuracy is best-effort. A line item that cannot be parsed is omitted (not errored). If parsing yields zero line items, the pricing estimate uses the placeholder path.

### Proposal Writer (updated)

**FR-008:** The `writeProposal` function must accept new input fields: `companyProfile`, `supplierContext`, `customerContext`, `learnings`, and `pricingMarkdown`.

**FR-009:** The proposal writer system prompt must include an explicit instruction: "Do NOT generate Terms & Conditions, Assumptions, Exclusions, Payment Terms, or any contract clause sections. These will be added separately."

**FR-010:** The proposal writer prompt must structure supplier context into labeled blocks: company profile block, certifications block, case studies block, and past winning proposals block.

**FR-011:** The proposal writer prompt must include customer context when available: preferred tone, industry, and custom instructions.

**FR-012:** The proposal writer prompt must include the pre-computed pricing markdown injected at the defined location in the prompt, not generated by the LLM.

**FR-013:** When `pricingMarkdown` is the placeholder string, the prompt must instruct the writer to insert the placeholder text verbatim.

### Template Injection

**FR-014:** The template injection step must concatenate templates in canonical section type order:
`assumptions → exclusions → payment_terms → change_management → ip_ownership → liability → force_majeure → warranty`

**FR-015:** Within each section type, templates must be ordered by their `sortOrder` field ascending.

**FR-016:** The output format for the templates block is:
```
\n\n---\n\n## Supplier Terms & Conditions\n\n### [Template Title]\n\n[Template Content]\n\n
```

**FR-017:** When both required templates and situational templates apply, they must be merged and sorted by section type order. Situational templates do not duplicate required templates.

**FR-018:** The LLM output string is never modified except by appending the templates block. If there are no templates, the LLM output is used as-is.

### Coverage Report (Stub)

**FR-019:** The stub coverage check must produce a `CoverageReport` object with:
- `coverageScore: 0`
- `evaluatedAt: new Date().toISOString()`
- `requirements`: one entry per RFP requirement field with `addressed: false`, `evidence: null`, `gap: 'Coverage check pending — re-evaluate after F9 is implemented'`

**FR-020:** The stub must not make any LLM calls.

**FR-021:** Template-sourced content must be tracked separately from LLM-generated content so F9 can exclude it from coverage evaluation.

### Data Persistence

**FR-022:** Step 11 must save both `markdownContent` (final markdown including templates) and `coverageReport` (JSONB) to the draft record atomically.

**FR-023:** The draft status must transition from `'generating'` to `'draft'` on successful completion of step 11.

---

## Non-Functional Requirements

**NFR-001 — Performance:** The pipeline must complete within 60 seconds for a 20-field RFP when running in a staging environment with live LLM calls. Steps 3–6 (retrieval steps) should be parallelized internally to minimize latency.

**NFR-002 — Tenant isolation:** All database queries in the pipeline must be scoped by `organizationId`. No cross-tenant data access is possible.

**NFR-003 — Template verbatim integrity:** Template content must appear in the final output character-for-character identical to the stored template body. Integration tests must verify this for at least one required template and one situational template.

**NFR-004 — Pricing accuracy:** The pricing section in the proposal matches the output of `computePricingEstimate` exactly. No rounding or reformatting is applied after the function returns.

**NFR-005 — No pricing in LLM context:** The LLM must not be given raw rate card data (rates, margins, discount values). Only the pre-computed pricing markdown is included in the prompt.

**NFR-006 — No templates in LLM prompt:** Template content must never be passed to the LLM. Templates are concatenated to the output after the LLM returns.

**NFR-007 — Graceful degradation:** Generation must succeed (producing a `'draft'` status result) even when: rate card is null, company profile is empty, no templates exist, no knowledge base results are returned, or customer context is not found.

**NFR-008 — Test coverage:** Integration tests must mock all external calls (DB, LLM, OpenAI embeddings) and verify pipeline execution order and output correctness.

---

## Edge Cases & Error Handling

**EC-001:** `parsedStructure` is null on the RFP — the pipeline falls back to a single section from `rfp.name`. (Existing behavior preserved.)

**EC-002:** The `scope-deliverables` answer is skipped (null answer) — pricing uses placeholder.

**EC-003:** The `scope-deliverables` answer is present but contains no parseable quantity data (e.g. "We'll handle the full project") — parser returns empty array, pricing uses placeholder.

**EC-004:** Rate card is configured but in by-role mode and no roles match the parsed line items — pricing engine uses first-role fallback (existing F5 behavior).

**EC-005:** `searchByRequirements` is called with an empty fields array — returns empty array immediately without API calls.

**EC-006:** All embedding API calls fail (e.g. no OpenAI key configured) — `searchByRequirements` returns empty array (existing F7 behavior); proposal generates without requirement-matched context.

**EC-007:** No required templates exist in the database — template block is omitted from output, no `---` separator is added.

**EC-008:** A situational template's `triggerRfpTypes` is `null` — the template is treated as triggering on all RFP types (not filtered).

**EC-009:** A situational template's `triggerIndustryTags` is `null` — the template is treated as triggering on all industry tags (not filtered).

**EC-010:** Both `triggerRfpTypes` and `triggerIndustryTags` are specified on a template — the template is included when the RFP matches either condition (OR logic, not AND).

**EC-011:** The LLM call in step 8 fails — the pipeline throws, the outer catch block sets draft status to `'error'`. No partial content is saved.

**EC-012:** The `companyProfile` field is an empty string — the company profile block is omitted from the prompt (same as null/undefined).

**EC-013:** Customer not found (customerId exists on draft but customer record deleted) — `fetchCustomerContext` returns null; pipeline continues without customer context.

**EC-014:** `proposalDrafts.customerId` is null — `fetchCustomerContext` is skipped entirely (no customer-specific context to fetch).

---

## Success Metrics

- Generated proposals include a pricing section in 100% of cases where rate card is configured
- Required template content appears verbatim (character-for-character) in 100% of generated proposals
- Pipeline completes within 60 seconds for a 20-field RFP in staging
- Zero arithmetic errors in pricing sections (inherited from F5 correctness guarantee)
- Draft status is `'draft'` after successful generation; `'error'` on failure — no intermediate states persist

---

## Constraints

- No new database tables introduced (all schema changes in F1)
- No new UI components (proposal draft viewer already exists)
- No new API routes (generation triggered by existing `proposal/generate` Inngest event)
- Step 9 (`check-requirement-coverage`) is a stub — F9 will un-stub it in a subsequent feature
- The scope line parser uses heuristic text parsing only — no additional LLM calls for parsing
- Template content must never be modified, reformatted, or trimmed before injection
