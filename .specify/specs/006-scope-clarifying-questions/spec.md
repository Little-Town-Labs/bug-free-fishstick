# Feature Specification: Scope Clarifying Questions

**Feature ID:** F6
**Branch:** `006-scope-clarifying-questions`
**PRD Source:** §5 US4
**Depends on:** F1 (`001-data-model-foundation`), F2 (`002-rate-card-management`)
**Blocks:** F8 (`008-revised-proposal-pipeline`)
**Priority:** P1 — High
**Status:** Draft

---

## Overview

When a Proposal Preparer initiates a proposal, the system asks clarifying questions to fill gaps before drafting begins. Currently, those questions are entirely LLM-generated and may or may not touch on scope, pricing, exclusions, or timeline — critical commercial inputs without which the pricing computation engine (F5) cannot produce an accurate estimate.

This feature extends the clarifying question generator so that three categories of question are always present, regardless of RFP content, and the pricing-related question is phrased specifically for the organization's configured pricing model (Time & Materials, Fixed Price, or Cost-Plus). The LLM continues to generate context-specific questions for other gaps; this feature only guarantees the mandatory commercial scaffolding is always included.

**What this feature is NOT:** It does not compute pricing (that is F5). It does not parse answers into scope lines (that is handled in F8). It is exclusively the question generation surface: what questions are asked, in what form, and how pricing model context is communicated to the model.

---

## User Stories

### US-001: Scope and Deliverables Question Always Present

**As a** Proposal Preparer
**I want** the system to always ask me about deliverables and effort
**So that** the pricing computation engine has the scope data it needs to calculate a cost estimate

**Acceptance Criteria:**
- [ ] At least one clarifying question always addresses deliverables and the estimated effort required
- [ ] The question is present even when the RFP summary makes no explicit mention of scope or effort
- [ ] The question is present even when the knowledge base already has relevant entries for the RFP type
- [ ] The phrasing of the effort request adapts to the configured pricing model (see US-003)

**Priority:** High

---

### US-002: Exclusions Question Always Present

**As a** Proposal Preparer
**I want** the system to always ask me what is explicitly excluded from scope
**So that** the generated proposal can include accurate exclusions language and avoid overpromising

**Acceptance Criteria:**
- [ ] At least one clarifying question always asks what work, activities, or responsibilities are explicitly out of scope
- [ ] The exclusions question is present regardless of RFP content, knowledge base coverage, or content library coverage
- [ ] The question is independent of the pricing model; its wording does not change between T&M, fixed price, and cost-plus

**Priority:** High

---

### US-003: Pricing Question Adapts to Configured Pricing Model

**As a** Proposal Preparer
**I want** the pricing question to be phrased in terms of the engagement model my organization uses
**So that** my answer can be directly used to compute the pricing estimate without translation

**Acceptance Criteria:**
- [ ] When the pricing model is Time & Materials, the question asks for each deliverable and the estimated hours required for each
- [ ] When the pricing model is Fixed Price, the question asks for the total fixed engagement budget or price the preparer intends to quote
- [ ] When the pricing model is Cost-Plus, the question asks for the estimated cost breakdown and the target margin percentage to apply
- [ ] The pricing model in use is communicated to the LLM so it can phrase the question appropriately
- [ ] If no pricing model is configured for the organization, the question defaults to Time & Materials phrasing (hours per deliverable)
- [ ] All three variations produce a single, clearly labelled question that can be identified as the pricing/scope question

**Priority:** High

---

### US-004: Timeline Question Always Present

**As a** Proposal Preparer
**I want** the system to always ask about the target delivery timeline
**So that** the proposal can include accurate scheduling commitments and the pricing engine has duration context

**Acceptance Criteria:**
- [ ] At least one clarifying question always asks for the target delivery timeline or milestone dates
- [ ] The timeline question is present regardless of RFP content or knowledge base coverage
- [ ] The timeline question is independent of pricing model and does not change wording based on rate card configuration

**Priority:** High

---

### US-005: LLM-Generated Context Questions Continue to Work

**As a** Proposal Preparer
**I want** to also receive questions specific to this particular RFP's gaps
**So that** the system still surfaces unique requirements beyond the mandatory commercial questions

**Acceptance Criteria:**
- [ ] The mandatory questions (scope/effort, exclusions, timeline) are injected in addition to any LLM-generated questions — they do not replace them
- [ ] The total question count remains within a reasonable range (3–10 questions per PRD) including mandatory questions
- [ ] The LLM is informed of the mandatory questions it must include so it does not duplicate them with similar but differently-worded questions
- [ ] Questions returned to the user do not contain obvious duplicates for the same topic

**Priority:** Medium

---

### US-006: Pricing Context Available to the LLM

**As a** Proposal Preparer
**I want** the question generator to be aware of our pricing model
**So that** LLM-generated questions are consistent with how my organization structures engagements

**Acceptance Criteria:**
- [ ] The system prompt includes the organization's current pricing model label (e.g. "Time & Materials", "Fixed Price", "Cost-Plus")
- [ ] The system prompt includes instruction on how to phrase the effort/pricing question for that model
- [ ] If the organization has no rate card or pricing model configured, the system prompt communicates that pricing defaults to T&M and questions should reflect that
- [ ] The pricing context from tenant settings is read at question generation time, not hardcoded

**Priority:** High

---

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-001 | The question generator always produces at least one question covering deliverables and effort/pricing for the engagement |
| FR-002 | The question generator always produces at least one question covering what is explicitly excluded from scope |
| FR-003 | The question generator always produces at least one question covering the target delivery timeline |
| FR-004 | The mandatory questions (FR-001, FR-002, FR-003) are present in the output regardless of RFP content, knowledge base coverage, or content library coverage |
| FR-005 | When `proposalDefaults.pricingModel` is `time_and_materials`, the deliverables question requests hours per deliverable |
| FR-006 | When `proposalDefaults.pricingModel` is `fixed_price`, the deliverables question requests the total fixed price or budget confirmation |
| FR-007 | When `proposalDefaults.pricingModel` is `cost_plus`, the deliverables question requests estimated cost breakdown and target margin percentage |
| FR-008 | When `proposalDefaults.pricingModel` is null or absent, the question generator falls back to T&M phrasing (hours per deliverable) |
| FR-009 | The system prompt passed to the LLM includes the organization's pricing model and instructions for how to phrase the pricing question accordingly |
| FR-010 | The pricing model is read from the organization's tenant settings at question-generation time; it is not hardcoded |
| FR-011 | LLM-generated context questions are not removed; mandatory questions are added on top of the LLM output |
| FR-012 | The LLM is instructed to avoid generating questions that duplicate the mandatory question topics (deliverables/effort, exclusions, timeline) |
| FR-013 | Total question count after mandatory injection stays within a bounded range; when the LLM generates the maximum, mandatory questions replace the lowest-priority LLM questions to avoid exceeding the cap |
| FR-014 | All mandatory questions have a predictable, machine-parseable question ID format (e.g. `scope-deliverables`, `scope-exclusions`, `scope-timeline`) so downstream pipeline steps can reliably identify their answers |
| FR-015 | The question generator input accepts the organization's pricing model as a parameter; callers are responsible for fetching and passing this value |
| FR-016 | If the tenant settings read fails (e.g. org not found or settings null), question generation proceeds with T&M fallback rather than failing |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-001 | Question generation latency is not measurably increased by the mandatory injection; injecting pre-built questions adds no LLM calls |
| NFR-002 | The pricing model value from tenant settings is treated as configuration, not user-controlled input; it does not alter any prompt in a way that could be exploited for prompt injection |
| NFR-003 | All new function parameters and return types are fully typed; no `any` types introduced |
| NFR-004 | The mandatory question injection is covered by unit tests with mocked LLM responses, verifying the three mandatory questions appear in all outputs |
| NFR-005 | Tests verify all three pricing model variants (T&M, fixed price, cost-plus) produce differently worded scope questions |
| NFR-006 | The question generator is testable without a real LLM or database connection (mocked dependencies) |

---

## Edge Cases & Error Handling

### No Pricing Model Configured
- `proposalDefaults` is null or `proposalDefaults.pricingModel` is undefined.
- **Behavior:** Fall back to T&M phrasing. Ask for hours per deliverable. Log a debug message indicating fallback was used. Do not throw an error.

### No Rate Card Configured at All
- `rateCard` is null; `proposalDefaults` may also be null.
- **Behavior:** Same as no pricing model — fall back to T&M phrasing. The downstream pricing engine (F5) will handle the missing rate card with its own graceful degradation (placeholder). Question generation does not fail.

### LLM Generates a Duplicate of a Mandatory Question
- The LLM may generate a question that semantically overlaps with one of the three mandatory questions (e.g. it asks about timeline in its own words).
- **Resolution approach:** The system prompt instructs the LLM not to ask about deliverables/effort, exclusions, or timeline, as those questions will be added separately. This reduces but does not guarantee zero duplicates. Exact deduplication by question ID is guaranteed; semantic deduplication is best-effort via prompt instruction.

### LLM Generates Maximum Questions (10)
- If the LLM generates 10 questions and 3 mandatory questions are to be added, the total would be 13.
- **Behavior:** Mandatory questions always take the first three slots. The LLM is instructed to generate up to `(maxQuestions - 3)` questions, reserving space for the mandatory ones. If the LLM ignores this and returns more, the output is trimmed to `maxQuestions` total, keeping all mandatory questions and reducing the LLM-generated set.

### RFP With No Structured Fields
- The current generator already handles this case with an instruction to use the RFP summary.
- **Behavior:** The mandatory questions are still injected. The fallback message for missing fields is unchanged.

### Pricing Model Tenant Settings Read Failure
- Database error or network issue when fetching `proposalDefaults.pricingModel`.
- **Behavior:** Log the error with context. Proceed with T&M fallback. Do not propagate the error to the caller — question generation is not blocked by a settings read failure.

---

## Clarifications Resolved

The following design decisions were made using best-practice defaults without requiring user input. Each decision is documented here.

### Decision 1: Where mandatory questions are injected — pre-LLM vs post-LLM

**Options considered:**
1. **Pre-injection (instruct LLM to ask them):** Tell the LLM "you must include these three questions." Risk: LLM may rephrase them in ways that break downstream parsing.
2. **Post-injection (deterministic append):** LLM generates context questions; mandatory questions are programmatically appended after. Question IDs are stable and machine-parseable.
3. **Hybrid:** LLM is instructed not to ask about those three topics; questions are appended post-generation with stable IDs.

**Decision:** Option 3 (hybrid). The system prompt instructs the LLM to skip the three mandatory topics; the three questions are deterministically constructed and appended after LLM generation. This ensures stable question IDs (critical for F8's scope-line parser) while letting the LLM contribute unique context questions without duplication.

**Rationale:** FR-014 requires machine-parseable question IDs. Post-injection is the only approach that guarantees ID stability. The hybrid approach additionally reduces semantic duplication by prompting the LLM to skip those topics.

---

### Decision 2: What the mandatory question IDs are

**Decision:** Three fixed IDs: `scope-deliverables`, `scope-exclusions`, `scope-timeline`. These IDs are constants, not generated by the LLM, ensuring downstream pipeline steps can reliably address `clarifyingAnswers.find(a => a.id === 'scope-deliverables')` without fragility.

**Rationale:** F8 (revised pipeline) parses clarifying answers to feed the pricing engine. Stable, predictable IDs are necessary for reliable parsing. Using a naming convention with the `scope-` prefix distinguishes mandatory commercial questions from LLM-generated questions.

---

### Decision 3: Handling the total question count ceiling

**Decision:** The LLM is instructed to generate up to 7 questions (leaving 3 slots for mandatory questions), targeting a total of 10 maximum. If the LLM generates more than 7, the output is trimmed to 7 before mandatory questions are appended. The existing 3-question minimum for LLM output is maintained.

**Rationale:** The PRD specifies 3–10 questions. Reserving 3 slots for mandatory questions means the LLM generates 0–7 context questions, resulting in a total of 3–10. This respects the existing contract with the rest of the system.

---

### Decision 4: Cost-plus question specificity

**Decision:** For cost-plus, the deliverables question asks for: (a) a breakdown of estimated direct costs per deliverable or work package, and (b) the target margin percentage to apply. The question acknowledges that this may differ from the default margin in the rate card, allowing the preparer to specify a project-specific margin.

**Rationale:** Cost-plus pricing requires both the cost base and the margin to compute a total. Asking for the rate-card default margin would defeat the purpose — the preparer may be quoting a different margin for a specific engagement. The question should surface both inputs explicitly.

---

## Out of Scope

- Parsing the answers to extract structured scope lines (that is F8's responsibility)
- Validating whether the answers are complete enough for pricing (F8 handles fallback to placeholder)
- Displaying or editing clarifying questions in the UI (existing question review flow is unchanged)
- Dynamic question templates stored in the database (mandatory questions are code constants, not admin-configurable)
- Localization or internationalization of question text

---

## Success Metrics

- 100% of question generation outputs contain all three mandatory question IDs (`scope-deliverables`, `scope-exclusions`, `scope-timeline`)
- All three pricing model variants (T&M, fixed price, cost-plus) produce distinct wording in the scope-deliverables question (verified by unit tests)
- Mocked LLM tests pass for the null/missing pricing model case (falls back to T&M wording)
- No regression in existing question generation behavior for non-mandatory questions

---

## Acceptance Criteria Summary

| Story | Done When |
|---|---|
| US-001 | `scope-deliverables` question present in all generated outputs |
| US-002 | `scope-exclusions` question present in all generated outputs |
| US-003 | Wording of `scope-deliverables` question differs correctly across all three pricing model values and null |
| US-004 | `scope-timeline` question present in all generated outputs |
| US-005 | LLM-generated questions appear alongside mandatory questions; total does not exceed 10 |
| US-006 | System prompt includes pricing model label and phrasing instructions read from tenant settings |
