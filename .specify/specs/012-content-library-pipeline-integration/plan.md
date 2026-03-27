# Implementation Plan: Content Library Pipeline Integration

**Feature:** 012-content-library-pipeline-integration
**Specification:** spec.md (Clarified)
**Created:** 2026-03-27

---

## Executive Summary

Two gaps in proposal generation produce unnecessary PLACEHOLDERs: (1) the `proposal_content_library` table is never queried during generation, and (2) per-role rate card data isn't passed to the proposal writer prompt. This plan wires both data sources into the existing pipeline with minimal disruption.

**Scope:** 4 files modified, 1 new utility module, tests for each change. No schema changes. No UI changes. No new API routes.

---

## Architecture Overview

```
Current pipeline (generate-proposal.ts):
  Step 1: fetch-draft-and-rfp
  Steps 2-6: parallel fetches (customer, KB search, supplier context, templates)
  Step 7: compute-pricing
  Step 8: generate-proposal-content (writeProposal)
  Step 9-11: coverage, templates, save

Changes:
  Steps 2-6: ADD fetch-content-library (parallel with existing fetches)
  Step 7: ADD rate card role data extraction (alongside pricing computation)
  Step 8: MODIFY writeProposal input + prompt (add CL context + role rates)
```

No new Inngest steps required -- the Content Library fetch runs in parallel within the existing `Promise.all` block (steps 2-6).

---

## Technical Decisions

### TD-1: Content Library Fetch Location

**Context:** Where to add the CL query in the pipeline.
**Options:**
1. New Inngest step (separate serialization boundary)
2. Add to existing `Promise.all` block in steps 2-6

**Chosen:** Option 2 -- add to existing `Promise.all`
**Rationale:** The CL fetch is a simple DB query, same as the other fetches in that block. Adding a separate Inngest step would add serialization overhead for no benefit. The existing pattern already handles Promise.allSettled for graceful degradation.

### TD-2: Vendor Profile Detection

**Context:** How to identify RFP sections requesting vendor info.
**Chosen:** Keyword pattern matching (per clarification session)
**Implementation:** A pure function `isVendorProfileField(question: string): boolean` that checks against a static keyword list. Deterministic, unit-testable, zero dependencies.

**Keyword list:**
```
company name, legal name, corporate headquarters, headquarters address,
company address, mailing address, company website, website url, web address,
primary contact, point of contact, contact name, contact person,
contact email, email address, contact phone, phone number, telephone,
years in business, year founded, year established, date of incorporation
```

### TD-3: Content Library Search Strategy

**Context:** How to search CL entries for relevance.
**Chosen:** Parallel merge (per clarification session)
**Implementation:**
- Semantic search: reuse `searchContentLibrary()` from `content-library-search.ts` (already exists, has embedding + fallback support)
- Category-based: for vendor-profile RFP fields, also call `searchContentLibraryByCategory()` with common vendor categories
- Merge results, deduplicate by CL entry ID (keep highest similarity)

### TD-4: Rate Card Role Data Format

**Context:** How to pass per-role rates to the proposal writer.
**Chosen:** Formatted markdown table alongside existing `pricingMarkdown`
**Implementation:** A pure function `formatRateCardRoles(rateCard: RateCard): string` that produces a markdown table:
```markdown
**Standard Hourly Rates by Role**
| Role | Rate |
|---|---|
| Project Manager | USD 175.00 |
| Senior Developer | USD 200.00 |
```
This is passed as a separate prompt block so the LLM uses it to fill role-rate tables in the RFP response. Returns empty string when mode is `blended` or no roles configured.

### TD-5: Prompt Modification Strategy

**Context:** How to add CL context and rate data to the writer prompt.
**Chosen:** Add two new prompt blocks to the existing `promptBlocks` array:
1. `## Content Library` -- CL entries formatted as `[category] name: content`
2. `## Standard Rate Card by Role` -- the role-rate markdown table (TD-4)

Add prompt instructions:
- "For vendor profile sections (company name, address, contact info), prefer Content Library entries over Knowledge Base entries."
- "For rate card tables, use the Standard Rate Card by Role data to populate per-role rates."

---

## Files Modified

### 1. `src/lib/services/content-library-retrieval.ts` (NEW)

New module containing:
- `isVendorProfileField(question: string): boolean` -- keyword matcher
- `fetchContentLibraryForProposal(orgId: string, rfpFields: RequirementField[], openaiApiKey?: string): Promise<ContentLibraryEntryWithSimilarity[]>` -- orchestrates semantic + category search, deduplicates
- `formatRateCardRoles(rateCard: RateCard | null | undefined): string` -- formats role-rate table

### 2. `src/lib/inngest/functions/generate-proposal.ts` (MODIFIED)

- Import new module
- Add `fetch-content-library` call to `Promise.all` block (steps 2-6)
- Extract rate card role markdown in `compute-pricing` step
- Pass both to `writeProposal` call

### 3. `src/lib/ai/agents/proposal-writer.ts` (MODIFIED)

- Extend `WriteProposalInput` with `contentLibraryEntries` and `rateCardRolesMarkdown`
- Add `## Content Library` prompt block
- Add `## Standard Rate Card by Role` prompt block
- Update system prompt with CL/rate-card usage instructions

### 4. `tests/unit/services/content-library-retrieval.test.ts` (NEW)

- `isVendorProfileField` -- positive/negative keyword tests
- `formatRateCardRoles` -- blended mode, by_role mode, empty roles, no rate card
- `fetchContentLibraryForProposal` -- mock DB, verify semantic + category merge, verify dedup

### 5. `tests/unit/agents/proposal-writer.test.ts` (MODIFIED or NEW)

- Verify CL entries appear in prompt
- Verify rate card roles appear in prompt
- Verify backward compat when CL is empty / rate card is blended

---

## Implementation Phases

### Phase A: Content Library Retrieval Module (new file + tests)

1. **A1:** Create `isVendorProfileField()` with keyword list + unit tests (TDD)
2. **A2:** Create `formatRateCardRoles()` + unit tests (TDD)
3. **A3:** Create `fetchContentLibraryForProposal()` + unit tests (TDD, mocked DB)
4. **A4:** TypeScript compilation check

### Phase B: Pipeline Integration (modify generate-proposal.ts)

1. **B1:** Import new module in generate-proposal.ts
2. **B2:** Add `fetch-content-library` to `Promise.all` block
3. **B3:** Extract `rateCardRolesMarkdown` in compute-pricing step
4. **B4:** Pass new fields to `writeProposal()` call
5. **B5:** TypeScript compilation check

### Phase C: Proposal Writer Prompt Update (modify proposal-writer.ts)

1. **C1:** Extend `WriteProposalInput` interface with new fields
2. **C2:** Add Content Library prompt block construction
3. **C3:** Add Rate Card Roles prompt block construction
4. **C4:** Update system prompt with CL/rate usage instructions
5. **C5:** Backward compatibility: empty CL / blended mode handled gracefully
6. **C6:** Tests for prompt construction

### Phase D: Integration Verification

1. **D1:** Run full test suite -- verify no regressions
2. **D2:** TypeScript strict mode compilation
3. **D3:** Code review quality gate

---

## Testing Strategy

| Test Type | What | Where |
|---|---|---|
| Unit | `isVendorProfileField` keyword matching | content-library-retrieval.test.ts |
| Unit | `formatRateCardRoles` all modes | content-library-retrieval.test.ts |
| Unit | `fetchContentLibraryForProposal` with mocked DB | content-library-retrieval.test.ts |
| Unit | Prompt blocks include CL + rate data | proposal-writer.test.ts |
| Unit | Backward compat: empty CL, blended mode | proposal-writer.test.ts |
| Existing | All existing proposal-draft, pricing, retrieval tests pass | existing test files |

**Coverage target:** 80%+ on new module, no regression on existing.

---

## Security Considerations

- All CL queries scoped by `organizationId` (Constitutional Principle I)
- Rate card data is org-scoped via existing `getRateCard(organizationId)`
- No new API routes exposed -- all changes are internal pipeline
- No user input directly interpolated into queries (existing parameterized patterns)

---

## Performance Impact

| Operation | Estimated Latency | Notes |
|---|---|---|
| CL semantic search | ~500ms | Reuses existing `searchContentLibrary`, single embedding call |
| CL category search | ~50ms | Simple DB query with index |
| Rate card formatting | <1ms | In-memory string building |
| Prompt size increase | ~500-2000 tokens | CL entries + role table |

**Total pipeline impact:** < 1 second additional latency (CL fetch runs in parallel with existing fetches).

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| CL search returns irrelevant entries, polluting prompt | Medium | Cap at top 10 results by similarity; vendor-profile category match is targeted |
| LLM ignores CL context in favor of KB entries | Low | Explicit prompt instruction to prefer CL for vendor fields |
| Rate card roles markdown confuses pricing section | Low | Separate prompt block with clear label; tested in isolation |
| Existing tests break from interface change | Low | `WriteProposalInput` new fields are optional with defaults |

---

## Constitutional Compliance

| Principle | Compliance |
|---|---|
| I. Tenant Isolation | All queries scoped by organizationId |
| II. Type Safety | New interfaces fully typed; no `any` |
| III. Explicit Over Implicit | CL and rate data passed as explicit prompt blocks |
| V. 80% Coverage | TDD for all new code |
| VI. Test the Agents | Proposal writer prompt tested with mocked inputs |
| XVI. Graceful Degradation | Empty CL / missing rate card handled without error |

---

## Dependencies

- **Existing:** `searchContentLibrary()` and `searchContentLibraryByCategory()` from `content-library-search.ts`
- **Existing:** `getRateCard()` from `rate-card.ts`
- **Existing:** `RateCard`, `RateCardRole` types from `tenant-settings.ts`
- **No new npm packages required**
- **No schema migrations required**
