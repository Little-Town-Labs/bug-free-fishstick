# Task Breakdown: Content Library Pipeline Integration

**Feature:** 012-content-library-pipeline-integration
**Plan:** plan.md
**Created:** 2026-03-27

---

## Summary

| Metric | Value |
|---|---|
| Total Tasks | 16 |
| Phases | 4 (A-D) |
| Critical Path | A1 -> A3 -> A5 -> B1 -> C1 -> C4 -> D1 |
| Parallel Opportunities | A1 + A2; B2 + B3; C2 + C3 |

---

## User Story Mapping

| User Story | Tasks |
|---|---|
| US1: Content Library in Proposals | A3, A4, A5, B1, B2, C1, C2, C4 |
| US2: Per-Role Rate Card | A1, A2, B3, B4, C1, C3, C4 |
| US3: Source Attribution | C4 (prompt instructions) |
| US4: Category Matching | A3, A4, A5 |

---

## Phase A: Content Library Retrieval Module

> **Goal:** New `content-library-retrieval.ts` module with all pure functions and tests.
> **Files:** `src/lib/services/content-library-retrieval.ts`, `tests/unit/services/content-library-retrieval.test.ts`

### Task A1: `isVendorProfileField` - Tests + Implementation (TDD)
**Status:** :yellow_circle: Ready
**Dependencies:** None
**Parallel with:** A2

**Description:**
Write tests for `isVendorProfileField(question: string): boolean`, then implement. This is a pure function with a static keyword list -- straightforward TDD.

**Test cases (RED first):**
- Positive: "Company Name", "Corporate Headquarters Address", "Primary Point of Contact", "Contact Email & Phone", "Years in Business", "Company Website"
- Negative: "Describe your approach to data migration", "List certifications", "Proposed Delivery Timeline"
- Case insensitivity: "COMPANY NAME" and "company name" both return true
- Partial match: "Please provide your company name and title" returns true
- Empty/null input: returns false

**Acceptance Criteria:**
- [ ] Tests written and confirmed to FAIL before implementation
- [ ] `isVendorProfileField` passes all test cases
- [ ] Keyword list covers all patterns from TD-2 in plan.md
- [ ] Function exported from `content-library-retrieval.ts`

---

### Task A2: `formatRateCardRoles` - Tests + Implementation (TDD)
**Status:** :yellow_circle: Ready
**Dependencies:** None
**Parallel with:** A1

**Description:**
Write tests for `formatRateCardRoles(rateCard: RateCard | null | undefined): string`, then implement. Pure function, no DB access.

**Test cases (RED first):**
- `by_role` mode with 3 roles -> markdown table with role names and rates
- `blended` mode -> empty string (blended rate already in pricing markdown)
- `null` rate card -> empty string
- `undefined` rate card -> empty string
- `by_role` mode with 0 roles -> empty string
- Currency formatting: rates display with 2 decimal places and currency code

**Acceptance Criteria:**
- [ ] Tests written and confirmed to FAIL before implementation
- [ ] `formatRateCardRoles` passes all test cases
- [ ] Output matches TD-4 markdown format from plan.md
- [ ] Function exported from `content-library-retrieval.ts`

---

### Task A3: `fetchContentLibraryForProposal` - Tests (TDD RED)
**Status:** :red_circle: Blocked by A1
**Dependencies:** A1 (needs `isVendorProfileField`)
**Parallel with:** None

**Description:**
Write tests for the orchestration function that combines semantic search + category-based lookup for vendor fields. Mock `searchContentLibrary` and `searchContentLibraryByCategory` from `content-library-search.ts`.

**Test cases (RED first):**
- RFP with vendor profile fields -> calls both semantic search AND category search
- RFP with no vendor profile fields -> calls semantic search only (no category lookup)
- Empty CL (no entries) -> returns empty array, no errors
- CL entries without embeddings -> falls back to category search (existing fallback in `searchContentLibrary`)
- Deduplication: same CL entry returned by both semantic and category search -> appears once (highest similarity kept)
- Result cap: never returns more than 10 entries
- Tenant isolation: `organizationId` passed to all search calls

**Acceptance Criteria:**
- [ ] Tests written with mocked DB/search functions
- [ ] Tests confirmed to FAIL (function not yet implemented)
- [ ] All edge cases from EC-1, EC-2, EC-5, EC-6 covered

---

### Task A4: `fetchContentLibraryForProposal` - Implementation (TDD GREEN)
**Status:** :red_circle: Blocked by A3
**Dependencies:** A3

**Description:**
Implement `fetchContentLibraryForProposal` to pass all tests from A3.

**Implementation notes:**
- Import `searchContentLibrary` and `searchContentLibraryByCategory` from existing module
- For each RFP field, check `isVendorProfileField()`:
  - If vendor field: also run `searchContentLibraryByCategory()` with categories like "Vendor Profile", "Contact Information", "Company Information"
  - Always: run `searchContentLibrary()` with the field question as query
- Merge all results, deduplicate by entry ID (keep highest similarity)
- Cap at 10 results, sorted by similarity descending

**Acceptance Criteria:**
- [ ] All tests from A3 pass
- [ ] No `any` types used
- [ ] Graceful degradation: try/catch around search calls, return empty on failure

---

### Task A5: TypeScript Compilation Check
**Status:** :red_circle: Blocked by A1, A2, A4
**Dependencies:** A1, A2, A4

**Description:**
Run `npx tsc --noEmit` to verify the new module compiles cleanly with strict mode.

**Acceptance Criteria:**
- [ ] Zero TypeScript errors
- [ ] All exports properly typed

---

## Phase B: Pipeline Integration

> **Goal:** Wire new module into `generate-proposal.ts`.
> **Files:** `src/lib/inngest/functions/generate-proposal.ts`

### Task B1: Import + CL Fetch in Promise.all
**Status:** :red_circle: Blocked by A5
**Dependencies:** A5

**Description:**
Add `fetchContentLibraryForProposal` to the existing `Promise.all` block in the generate-proposal pipeline (steps 2-6).

**Implementation notes:**
- Import `fetchContentLibraryForProposal` from new module
- Add as 6th entry in the `Promise.all` array
- Wrap in try/catch returning empty array on failure (matches existing pattern)
- Add to the type assertion tuple at the end of the Promise.all

**Acceptance Criteria:**
- [ ] CL fetch runs in parallel with existing fetches
- [ ] Failure returns empty array (no pipeline disruption)
- [ ] Type assertion updated for 6th return value

---

### Task B2: Import + Rate Card Roles in Pricing Step
**Status:** :red_circle: Blocked by A5
**Dependencies:** A5
**Parallel with:** B1

**Description:**
In the `compute-pricing` step, also extract the rate card role markdown using `formatRateCardRoles`.

**Implementation notes:**
- Import `formatRateCardRoles` from new module
- After `getRateCard(organizationId)`, call `formatRateCardRoles(rateCard)`
- Return both `pricingMarkdown` and `rateCardRolesMarkdown` from the step

**Acceptance Criteria:**
- [ ] `rateCardRolesMarkdown` extracted alongside existing `pricingMarkdown`
- [ ] Empty string returned for blended mode / missing rate card

---

### Task B3: Pass New Fields to writeProposal
**Status:** :red_circle: Blocked by B1, B2
**Dependencies:** B1, B2

**Description:**
Update the `writeProposal()` call in step 8 to pass the new `contentLibraryEntries` and `rateCardRolesMarkdown` fields.

**Acceptance Criteria:**
- [ ] `contentLibraryEntries` passed from CL fetch result
- [ ] `rateCardRolesMarkdown` passed from pricing step result
- [ ] TypeScript compilation passes

---

### Task B4: TypeScript Compilation Check
**Status:** :red_circle: Blocked by B3
**Dependencies:** B3

**Description:**
Run `npx tsc --noEmit` to verify pipeline changes compile. This will fail until Phase C extends `WriteProposalInput` -- that's expected. Verify no OTHER errors introduced.

**Acceptance Criteria:**
- [ ] Only expected error: `WriteProposalInput` missing new fields (resolved in C1)
- [ ] No unrelated TypeScript errors

---

## Phase C: Proposal Writer Prompt Update

> **Goal:** Extend `writeProposal` to use CL entries and rate card roles in the prompt.
> **Files:** `src/lib/ai/agents/proposal-writer.ts`, `tests/unit/agents/proposal-writer.test.ts`

### Task C1: Extend WriteProposalInput Interface
**Status:** :red_circle: Blocked by B3
**Dependencies:** B3

**Description:**
Add new optional fields to `WriteProposalInput`:
- `contentLibraryEntries?: ContentLibraryEntryWithSimilarity[]`
- `rateCardRolesMarkdown?: string`

Optional fields ensure backward compatibility -- existing callers don't break.

**Acceptance Criteria:**
- [ ] Interface extended with optional fields
- [ ] Import type for `ContentLibraryEntryWithSimilarity` added
- [ ] TypeScript compilation passes (resolves B4 expected error)

---

### Task C2: Content Library Prompt Block
**Status:** :red_circle: Blocked by C1
**Dependencies:** C1
**Parallel with:** C3

**Description:**
Add a `## Content Library` prompt block to the `promptBlocks` array. Only added when CL entries are non-empty.

**Format:**
```
## Content Library (Vendor Information)
[category] name: content
[category] name: content
```

**Acceptance Criteria:**
- [ ] CL entries formatted with category and name labels
- [ ] Block omitted when `contentLibraryEntries` is empty or undefined
- [ ] Source attribution label "Content Library" included for LLM to reference

---

### Task C3: Rate Card Roles Prompt Block
**Status:** :red_circle: Blocked by C1
**Dependencies:** C1
**Parallel with:** C2

**Description:**
Add a `## Standard Rate Card by Role` prompt block. Only added when `rateCardRolesMarkdown` is non-empty.

**Acceptance Criteria:**
- [ ] Rate card roles markdown inserted as prompt block
- [ ] Block omitted when string is empty or undefined
- [ ] Positioned after the pricing section for logical flow

---

### Task C4: Update System Prompt Instructions
**Status:** :red_circle: Blocked by C2, C3
**Dependencies:** C2, C3

**Description:**
Update the system prompt in `writeProposal` to instruct the LLM on how to use the new data sources.

**New instructions to add:**
1. "For vendor profile sections (company name, address, contact info, website, years in business), use Content Library entries as the primary source. Mark these with `> *Source: Content Library — [entry name]*`"
2. "For rate card tables requested by the RFP, use the Standard Rate Card by Role data to populate per-role hourly rates. Do not use PLACEHOLDER for rates that are provided."
3. "When the same information appears in both Knowledge Base and Content Library, prefer the Content Library version for vendor profile fields."

**Acceptance Criteria:**
- [ ] System prompt updated with CL and rate card instructions
- [ ] Attribution format specified for CL-sourced content (US3)
- [ ] Instructions are additive (don't remove existing prompt rules)

---

### Task C5: Prompt Construction Tests
**Status:** :red_circle: Blocked by C4
**Dependencies:** C4

**Description:**
Write tests verifying the proposal writer prompt includes the new blocks correctly.

**Test cases:**
- CL entries provided -> prompt contains `## Content Library` block with formatted entries
- CL entries empty -> prompt does NOT contain `## Content Library` block
- Rate card roles markdown provided -> prompt contains `## Standard Rate Card by Role` block
- Rate card roles empty string -> prompt does NOT contain rate card block
- Both provided -> both blocks present
- Neither provided -> backward compatible (identical to current behavior)
- System prompt contains CL preference instruction
- System prompt contains rate card usage instruction

**Acceptance Criteria:**
- [ ] All test cases pass
- [ ] Backward compatibility verified (empty inputs = no change)
- [ ] Tests use mocked LLM (no real API calls)

---

## Phase D: Integration Verification

> **Goal:** Verify everything works together, no regressions.

### Task D1: Full Test Suite
**Status:** :red_circle: Blocked by C5
**Dependencies:** C5

**Description:**
Run `npm test` to verify all tests pass -- both new and existing.

**Acceptance Criteria:**
- [ ] All new tests pass (content-library-retrieval, proposal-writer prompt)
- [ ] All existing tests pass (no regressions)
- [ ] Coverage >= 80% on new module

---

### Task D2: TypeScript Strict Compilation
**Status:** :red_circle: Blocked by D1
**Dependencies:** D1

**Description:**
Run `npx tsc --noEmit` on full project.

**Acceptance Criteria:**
- [ ] Zero TypeScript errors in strict mode

---

### Task D3: Code Review Quality Gate
**Status:** :red_circle: Blocked by D2
**Dependencies:** D2

**Description:**
Run code-reviewer agent on all changed files:
- `src/lib/services/content-library-retrieval.ts`
- `src/lib/inngest/functions/generate-proposal.ts`
- `src/lib/ai/agents/proposal-writer.ts`
- `tests/unit/services/content-library-retrieval.test.ts`

**Acceptance Criteria:**
- [ ] No CRITICAL issues
- [ ] No HIGH security issues
- [ ] All MEDIUM issues addressed or documented
- [ ] Tenant isolation verified in review

---

## Dependency Graph

```
A1 (isVendorProfileField) ──┐
                              ├── A3 (fetch tests) ── A4 (fetch impl) ──┐
A2 (formatRateCardRoles) ───┘                                           ├── A5 (tsc)
                                                                        │
                                                          ┌─────────────┘
                                                          │
                                                   B1 (CL in pipeline) ────┐
                                                   B2 (rate in pricing) ───┤
                                                                           ├── B3 (pass to writer) ── B4 (tsc)
                                                                           │
                                                                    C1 (extend interface) ──┐
                                                                                             │
                                                                    C2 (CL prompt block) ───┤
                                                                    C3 (rate prompt block) ─┤
                                                                                             │
                                                                    C4 (system prompt) ─────┤
                                                                                             │
                                                                    C5 (prompt tests) ──────┤
                                                                                             │
                                                                    D1 (full tests) ────────┤
                                                                    D2 (tsc) ───────────────┤
                                                                    D3 (code review) ───────┘
```

---

## Quality Gates

| Gate | Location | Criteria |
|---|---|---|
| TDD Enforcement | A1, A2, A3/A4, C5 | Tests written and FAILING before implementation |
| TypeScript Strict | A5, B4, D2 | Zero errors with `--noEmit` |
| Full Test Suite | D1 | All tests pass, 80%+ coverage on new code |
| Code Review | D3 | No CRITICAL/HIGH issues |
| Backward Compatibility | C5 | Empty CL + blended rate = identical behavior |
