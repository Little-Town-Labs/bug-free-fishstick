# Tasks — F8: Revised Proposal Pipeline

**Feature ID:** F8
**Spec:** `.specify/specs/008-revised-proposal-pipeline/spec.md`
**Plan:** `.specify/specs/008-revised-proposal-pipeline/plan.md`
**Branch:** `008-revised-proposal-pipeline` (stay on `main` — no branch switch)
**Generated:** 2026-02-26

---

## Summary

| Metric | Value |
|---|---|
| Total tasks | 13 |
| Phases | 6 (Phase 0 = code review gate; Phases 1–5 = implementation) |
| Test tasks (RED) | 5 |
| Implementation tasks (GREEN) | 5 |
| Gate tasks | 1 (Phase 0: code review) |
| Files modified | 8 |
| New files | 2 (`scope-line-parser.ts`, `scope-line-parser.test.ts`) |

### Critical Path

```
1.1 (write parser tests)
  → 1.2 (implement parser)
    → 4.1 (write integration tests)  ← also blocked by 2.2 and 3.2
      → 5.1 (implement pipeline)
        → 0.1 (code review)

2.1 (write draft tests) → 2.2 (implement draft extension) → 4.1
3.1 (write writer tests) → 3.2 (implement writer update) → 4.1
```

All of Phase 4 (integration test rewrite) is blocked until Phases 1–3 are complete, because the integration tests import and mock all three new/changed modules. Phase 5 (pipeline implementation) is blocked by Phase 4 (TDD gate). The code review gate (Phase 0) is blocked by all implementation tasks.

---

## Phase 1: Scope Line Parser

**Files:**
- `src/lib/services/scope-line-parser.ts` (new)
- `tests/unit/services/scope-line-parser.test.ts` (new)

---

### Task 1.1: Write scope-line-parser unit tests (RED)

**Status:** 🟡 Ready
**Dependencies:** None

**Description:**
Create `tests/unit/services/scope-line-parser.test.ts`. The implementation file does not exist yet — all tests must fail (RED) before Task 1.2 begins. The parser is a pure function with no I/O, so no mocks are needed.

Write tests for the following `parseScopeLines(clarifyingQuestions: ClarifyingQuestion[]): ScopeLineItem[]` function:

- Returns `[]` when the `scope-deliverables` question is not present in the input array
- Returns `[]` when the `scope-deliverables` question is present but its answer is `null`
- Returns `[]` when the `scope-deliverables` question answer is an empty string
- Returns `[]` when the answer contains text but no parseable quantity/unit combinations (e.g. `"We will handle the full project"`)
- Single line: `"Requirements Analysis: 40 hours"` → 1 item with `quantity=40`, `unit='hour'`
- Single line with role pattern: `"Development by Senior Developer: 120 hrs"` → 1 item with `role='Senior Developer'`
- Multi-line answer with newline separators: 3 parseable lines → 3 items
- Day unit keyword: `"2 days of workshops"` → `unit='day'`
- Fixed unit keyword: `"1 fixed deliverable"` → `unit='fixed'`
- Mixed units in a single answer: yields one item per parseable line with correct units
- 20-item cap: answer with 25 parseable lines → exactly 20 items returned
- Partial parseability: answer with 3 lines where 1 line has no unit → 2 items returned (the unparseable line is omitted, not errored)

**Acceptance Criteria:**
- [ ] Test file exists at `tests/unit/services/scope-line-parser.test.ts`
- [ ] All 12 tests are defined and fail with "module not found" or equivalent (RED confirmed)
- [ ] No mocks or test doubles used (pure function)
- [ ] Tests import `parseScopeLines` from `@/lib/services/scope-line-parser`
- [ ] Tests import `MANDATORY_QUESTION_IDS` from the appropriate constants file to reference `'scope-deliverables'` — no magic strings

---

### Task 1.2: Implement scope-line-parser.ts (GREEN)

**Status:** 🔴 Blocked by Task 1.1
**Dependencies:** Task 1.1

**Description:**
Create `src/lib/services/scope-line-parser.ts`. Implement `parseScopeLines` as a pure exported function with no I/O, no database calls, and no LLM calls. The function must never throw — any parsing failure returns `[]`.

Parser algorithm (from plan):
1. Find the question with `id === MANDATORY_QUESTION_IDS.DELIVERABLES` (`'scope-deliverables'`)
2. If no such question exists, or answer is null/empty string, return `[]`
3. Split answer text on newlines, semicolons, and bullet markers (`-`, `*`, `•`)
4. For each candidate segment:
   a. Extract quantity: first numeric value (integer or decimal)
   b. Identify unit: `hour`/`hours`/`hr`/`hrs` → `'hour'`; `day`/`days` + standalone `d` → `'day'`; `fixed` → `'fixed'`; no unit found → skip segment
   c. Extract description: remaining text after removing quantity + unit tokens; trim
   d. Extract optional role: look for ` by [Word(s)]` or `([Role])` pattern; remove from description
5. Cap result at 20 items
6. Return `[]` if zero items parsed

Internal `ScopeLine` type (not exported):
```typescript
type ScopeLine = {
  description: string
  role: string | null
  quantity: number
  unit: 'hour' | 'day' | 'fixed'
}
```

**Acceptance Criteria:**
- [ ] All 12 tests from Task 1.1 pass (GREEN confirmed)
- [ ] Function never throws for any input — all error paths return `[]`
- [ ] No imports of database modules, LLM clients, or async utilities
- [ ] `ScopeLine` internal type is not exported
- [ ] File is under 100 lines
- [ ] `pnpm vitest run tests/unit/services/scope-line-parser.test.ts` exits 0

---

## Phase 2: updateDraftContent Extension

**Files:**
- `src/lib/services/proposal-draft.ts` (modify)
- `tests/unit/services/proposal-draft.test.ts` (extend)

---

### Task 2.1: Write updateDraftContent extension tests (RED)

**Status:** 🟡 Ready
**Dependencies:** None

**Description:**
Extend `tests/unit/services/proposal-draft.test.ts` with two new test cases for the optional 4th parameter on `updateDraftContent`. Do NOT modify existing tests — they document the current 3-argument behavior that must remain passing.

New tests to add:
1. When called with a 4th argument (`coverageReport: CoverageReport`), the DB update `set()` payload includes `coverageReport` with the provided value
2. When called with only 3 arguments (no `coverageReport`), the DB update `set()` payload does NOT include a `coverageReport` key (existing behavior preserved)

Use the existing DB mock pattern already present in `proposal-draft.test.ts`.

**Acceptance Criteria:**
- [ ] Two new test cases added to existing test file
- [ ] New tests fail with a TypeScript or runtime error (RED — 4th param not yet accepted by the implementation)
- [ ] Existing tests continue to pass
- [ ] Tests reference the `CoverageReport` type from `@/lib/db/schema/proposal-drafts`
- [ ] No existing test modified

---

### Task 2.2: Implement updateDraftContent optional 4th param (GREEN)

**Status:** 🔴 Blocked by Task 2.1
**Dependencies:** Task 2.1

**Description:**
Modify `src/lib/services/proposal-draft.ts` to add an optional 4th parameter to `updateDraftContent`:

```typescript
export async function updateDraftContent(
  draftId: string,
  orgId: string,
  markdownContent: string,
  coverageReport?: CoverageReport,
): Promise<ProposalDraft>
```

When `coverageReport` is provided (not `undefined`), include it in the Drizzle `set()` payload. When absent, do not include it. This is a backward-compatible extension — all existing 3-argument callers continue to work unchanged.

Import `CoverageReport` type from `@/lib/db/schema/proposal-drafts` if not already imported.

**Acceptance Criteria:**
- [ ] Both new tests from Task 2.1 pass (GREEN confirmed)
- [ ] All pre-existing `proposal-draft.test.ts` tests continue to pass
- [ ] TypeScript strict mode: no `any`, no type assertions needed
- [ ] Existing callers of `updateDraftContent` with 3 args are unaffected (verified by running full test suite)
- [ ] `pnpm vitest run tests/unit/services/proposal-draft.test.ts` exits 0

---

## Phase 3: writeProposal Update

**Files:**
- `src/lib/ai/agents/proposal-writer.ts` (modify)
- `tests/unit/agents/proposal-writer.test.ts` (rewrite)

---

### Task 3.1: Rewrite proposal-writer unit tests (RED)

**Status:** 🟡 Ready
**Dependencies:** None

**Description:**
Fully rewrite `tests/unit/agents/proposal-writer.test.ts` to match the new `WriteProposalInput` interface. The old interface (`knowledgeContext`, `contentLibraryEntries`) is being removed — tests for the old shape must not remain.

Mock `generateText` from `ai` (existing pattern). Verify the new input shape and prompt content.

Tests to include:
- `generateText` is called when `writeProposal` is invoked with the new `WriteProposalInput` shape
- The system prompt passed to `generateText` contains the string `"Do NOT generate Terms & Conditions"`
- The system prompt contains `"Do NOT perform any pricing calculations"`
- The prompt includes `pricingMarkdown` verbatim (exact substring match)
- When `companyProfile` is `null`, the prompt does NOT contain a "Company Profile" block
- When `companyProfile` is a non-empty string, the prompt contains that string
- When `customerContext` is `null`, the prompt does NOT contain a "Customer Preferences" block
- When `customerContext` is provided, tone/industry/custom instructions appear in the prompt
- The function returns `{ markdownContent: string }` where `markdownContent` matches `generateText`'s output

**Acceptance Criteria:**
- [ ] Old test file content fully replaced
- [ ] All new tests fail (RED — implementation not yet updated)
- [ ] `generateText` is mocked via `vi.mock('ai', ...)`
- [ ] No imports of old fields (`knowledgeContext`, `contentLibraryEntries`) remain
- [ ] New `WriteProposalInput` type fields are all used in test fixtures: `rfpSections` (with `id` field), `requirementResults`, `supplierContext`, `companyProfile`, `customerContext`, `learnings`, `pricingMarkdown`, `clarifyingAnswers`, `organizationId`

---

### Task 3.2: Implement writeProposal new interface (GREEN)

**Status:** 🔴 Blocked by Task 3.1
**Dependencies:** Task 3.1

**Description:**
Modify `src/lib/ai/agents/proposal-writer.ts`:

1. Replace `WriteProposalInput` interface with the new shape (from plan/data-model):
   ```typescript
   export interface WriteProposalInput {
     rfpSections: Array<{ id: string; title: string; content: string }>
     requirementResults: KnowledgeEntryWithSimilarity[]
     supplierContext: TypedSupplierContext
     companyProfile: string | null
     customerContext: CustomerContext | null
     learnings: Learning[]
     pricingMarkdown: string
     clarifyingAnswers: ClarifyingQuestion[]
     organizationId: string
   }
   ```

2. Update the system prompt to include:
   - `"Do NOT generate Terms & Conditions, Assumptions, Exclusions, Payment Terms, Change Management, IP Ownership, Liability, Force Majeure, or Warranty sections. These will be added separately."`
   - `"Do NOT perform any pricing calculations. The pricing section is pre-computed and provided to you."`

3. Restructure the user prompt body into labeled sections (in order):
   - `## RFP Requirements` — `rfpSections` rendered as subsections
   - `## Company Profile` — `companyProfile` content (omit entire block if null or empty string)
   - `## Knowledge Base Context` — `requirementResults` grouped by type
   - `## Certifications` — `supplierContext.certifications`
   - `## Case Studies` — `supplierContext.caseStudies`
   - `## Past Winning Proposals` — `supplierContext.wonPastRfps`
   - `## Customer Preferences` — tone, industry, custom instructions (omit entire block if `customerContext` is null)
   - `## Learnings` — `learnings`
   - `## Scope & Clarifying Question Answers` — `clarifyingAnswers`
   - `## PRE-COMPUTED PRICING SECTION (insert verbatim)` — `pricingMarkdown`

4. Remove all references to `knowledgeContext` and `contentLibraryEntries`.

**Acceptance Criteria:**
- [ ] All tests from Task 3.1 pass (GREEN confirmed)
- [ ] TypeScript strict mode: no `any`, imports typed via existing exported types from F7
- [ ] `knowledgeContext` and `contentLibraryEntries` are completely absent from the file
- [ ] `companyProfile` block omitted from prompt when value is `null` or `''`
- [ ] `customerContext` block omitted from prompt when value is `null`
- [ ] File estimated size ~140 lines (per plan); stays under 200 lines
- [ ] `pnpm vitest run tests/unit/agents/proposal-writer.test.ts` exits 0

---

## Phase 4: Pipeline Integration Tests (TDD Gate)

**Files:**
- `tests/integration/inngest/generate-proposal.test.ts` (rewrite)

**This is the TDD gate for Phase 5. Phase 5 may not begin until all Phase 4 tests are confirmed RED (module structure correct, tests defined, assertions failing against old implementation).**

---

### Task 4.1: Rewrite generate-proposal integration tests (RED)

**Status:** 🔴 Blocked by Tasks 1.2, 2.2, 3.2
**Dependencies:** Tasks 1.2, 2.2, 3.2

**Description:**
Fully rewrite `tests/integration/inngest/generate-proposal.test.ts`. The existing test file mocks old dependencies and tests the 6-step pipeline — it must be replaced entirely. The new test file must mock all F5, F7, and new F8 dependencies.

**Required `vi.mock` calls:**
```typescript
vi.mock('@/lib/services/proposal-retrieval', () => ({
  searchByRequirements: vi.fn().mockResolvedValue([]),
  fetchTypedSupplierContext: vi.fn().mockResolvedValue({
    companyDocs: [], certifications: [], caseStudies: [], wonPastRfps: [],
  }),
  fetchCustomerContext: vi.fn().mockResolvedValue(null),
  fetchLearnings: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/rate-card', () => ({
  getRateCard: vi.fn().mockResolvedValue({ rateCard: null, proposalDefaults: null }),
}))

vi.mock('@/lib/services/scope-line-parser', () => ({
  parseScopeLines: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/services/pricing-computation', () => ({
  computePricingEstimate: vi.fn().mockReturnValue({
    formattedMarkdown: '[PLACEHOLDER: pricing details required]',
    isPlaceholder: true,
    total: 0,
  }),
}))
```

Plus retain existing mocks for: `@/lib/db`, `inngest/client`, `@/lib/ai/agents/proposal-writer`, `@/lib/services/proposal-draft`.

**Tests required (14 minimum):**

| # | Test description | Key assertion |
|---|---|---|
| 1 | All 11 step names are called | `step.run` invoked with each of: `'fetch-draft-and-rfp'`, `'fetch-customer-context'`, `'search-requirements'`, `'fetch-typed-supplier-context'`, `'fetch-required-templates'`, `'fetch-situational-templates'`, `'compute-pricing'`, `'generate-proposal-content'`, `'check-requirement-coverage'`, `'inject-required-templates'`, `'save-proposal-content'` |
| 2 | `fetchCustomerContext` called with rfp.customerId and orgId | `expect(fetchCustomerContext).toHaveBeenCalledWith('customer-1', 'org-1')` |
| 3 | `searchByRequirements` called with parsed structure fields | Called with the fields array from `rfp.parsedStructure` |
| 4 | `fetchTypedSupplierContext` called with orgId, industryTags, rfpType | All three args verified |
| 5 | Template DB select is called for the organization | `proposalTemplates` table queried with `organizationId` filter |
| 6 | `parseScopeLines` called with draft.clarifyingQuestions | Called with the clarifying questions array |
| 7 | `computePricingEstimate` called with rateCard and scopeLines | Both args verified |
| 8 | `writeProposal` called with new input shape | `expect.objectContaining({ pricingMarkdown: expect.any(String), requirementResults: expect.any(Array) })` |
| 9 | When required template exists, its content appears verbatim in `updateDraftContent` call | Exact `template.content` string found in the `markdownContent` argument |
| 10 | `updateDraftContent` called with 4 args including a CoverageReport | 4th arg has `coverageScore: 0` and `evaluatedAt` |
| 11 | When rate card is null, `pricingMarkdown` is the placeholder string (not raw rate values) | `writeProposal` receives `pricingMarkdown: '[PLACEHOLDER: pricing details required]'` |
| 12 | When LLM call (`writeProposal`) throws, draft status is set to `'error'` | DB update called with `status: 'error'` |
| 13 | Situational template matching rfpType is included in final output | Template content appears in `updateDraftContent` markdownContent arg |
| 14 | Situational template NOT matching rfpType is excluded from final output | Template content does NOT appear in `updateDraftContent` markdownContent arg |

**Acceptance Criteria:**
- [ ] All 14 tests are defined and fail with assertion errors or "function not called" errors (RED — against the old 6-step pipeline)
- [ ] Old test file content fully replaced — no references to old 6-step step names remain
- [ ] All 4 new `vi.mock` targets are present
- [ ] Fixtures include at least: one required template with known `content` string, one situational template with `triggerRfpTypes` matching the test RFP, one situational template with non-matching `triggerRfpTypes`
- [ ] Test for template verbatim integrity uses exact string equality (not `toContain` with a substring — use the full `template.content` value)

---

## Phase 5: Pipeline Implementation

**Files:**
- `src/lib/inngest/functions/generate-proposal.ts` (complete rewrite)

---

### Task 5.1: Implement 11-step generate-proposal pipeline (GREEN)

**Status:** 🔴 Blocked by Task 4.1
**Dependencies:** Task 4.1

**Description:**
Completely rewrite `src/lib/inngest/functions/generate-proposal.ts` from the current 6-step implementation to the 11-step pipeline defined in the plan. Implement to make all Phase 4 integration tests pass.

**Required imports:**
```typescript
import { getRateCard } from '@/lib/services/rate-card'
import {
  searchByRequirements,
  fetchTypedSupplierContext,
  fetchCustomerContext,
  fetchLearnings,
} from '@/lib/services/proposal-retrieval'
import { parseScopeLines } from '@/lib/services/scope-line-parser'
import { computePricingEstimate } from '@/lib/services/pricing-computation'
import { writeProposal } from '@/lib/ai/agents/proposal-writer'
import { updateDraftContent } from '@/lib/services/proposal-draft'
import { proposalTemplateSections } from '@/lib/db/schema/proposal-templates'
import type { ProposalTemplate } from '@/lib/db/schema/proposal-templates'
import type { CoverageReport } from '@/lib/db/schema/proposal-drafts'
```

**Private helper: `generateCoverageReportStub(rfp)`**
Inline function (not exported). Returns a `CoverageReport` with:
- `coverageScore: 0`
- `evaluatedAt: new Date().toISOString()`
- `requirements`: one entry per `rfp.parsedStructure?.fields` entry with `addressed: false`, `evidence: null`, `gap: 'Coverage check pending — re-evaluate after F9 is implemented'`; falls back to `[]` if `parsedStructure` is null

**Private helper: `renderTemplatesBlock(templates: ProposalTemplate[])`**
1. If `templates.length === 0`, return `''`
2. Sort by `proposalTemplateSections.indexOf(template.section)` as primary key, `template.sortOrder` as secondary key
3. Map each to `### ${template.title}\n\n${template.content}`
4. Join with `\n\n`
5. Prepend `\n\n---\n\n## Supplier Terms & Conditions\n\n`

**Private helper: `matchesSituational(template, rfpType, industryTags)`**
OR logic (from plan TD-4 and EC-008/EC-009/EC-010):
- If both `triggerRfpTypes` and `triggerIndustryTags` are null/empty → return `true` (matches all)
- If `triggerRfpTypes` is set and `rfpType` is in the array → return `true`
- If `triggerIndustryTags` is set and any `industryTags` element is in the array → return `true`
- Otherwise → return `false`

**Pipeline structure:**
- Pre-step: decrypt `openaiApiKeyEncrypted` from `tenantSettings` (outside `try` block, before steps)
- Step 1: `'fetch-draft-and-rfp'` — fetch `proposalDrafts` and `rfps` by id + organizationId; throw if either is null
- Steps 2–6 via `Promise.all([step.run(...), step.run(...), ...])`:
  - Step 2: `'fetch-customer-context'` — `fetchCustomerContext(rfp.customerId, organizationId)`; catch → return `null`
  - Step 3: `'search-requirements'` — `searchByRequirements(rfp.parsedStructure?.fields ?? [], organizationId, openaiApiKey)`; catch → return `[]`
  - Step 4: `'fetch-typed-supplier-context'` — parallel `fetchTypedSupplierContext` + `fetchLearnings` + `tenantSettings.companyProfile` DB query; catch → return defaults
  - Step 5: `'fetch-required-templates'` — DB select on `proposalTemplates` where `isRequired = true` and `organizationId`; catch → return `[]`
  - Step 6: `'fetch-situational-templates'` — DB select on `proposalTemplates` where `isRequired = false` and `organizationId`; then TypeScript-filter via `matchesSituational`; catch → return `[]`
- Step 7: `'compute-pricing'` — `getRateCard(organizationId)` + `parseScopeLines(draft.clarifyingQuestions ?? [])` + `computePricingEstimate(rateCard, scopeLines, proposalDefaults?.pricingModel ?? 'time_and_materials')`
- Step 8: `'generate-proposal-content'` — `writeProposal({ rfpSections, requirementResults, supplierContext, companyProfile, customerContext, learnings, pricingMarkdown, clarifyingAnswers: draft.clarifyingQuestions ?? [], organizationId })`; `rfpSections` built from `rfp.parsedStructure?.fields` (with `id` field) or fallback to `[{ id: 'default', title: rfp.name, content: rfp.name }]`
- Step 9: `'check-requirement-coverage'` — `generateCoverageReportStub(rfp)`
- Step 10: `'inject-required-templates'` — `markdownContent + renderTemplatesBlock([...requiredTemplates, ...situationalTemplates])`
- Step 11: `'save-proposal-content'` — `updateDraftContent(draftId, organizationId, finalMarkdown, coverageReport)`
- Error catch: `db.update(proposalDrafts).set({ status: 'error', generationError: msg, updatedAt: new Date() }).where(...)`

**Acceptance Criteria:**
- [ ] All 14 integration tests from Task 4.1 pass (GREEN confirmed)
- [ ] `step.run` called exactly 11 times with the exact step name strings listed in Task 4.1 test #1
- [ ] Steps 2–6 implemented via a single `Promise.all([step.run(...), ...])` call — not sequential awaits
- [ ] `generateCoverageReportStub` is a private function (not exported)
- [ ] `renderTemplatesBlock` returns `''` when passed empty array — no `---` separator appended
- [ ] Template content in final output is character-for-character identical to stored template body (no trimming)
- [ ] Rate card values (rates, margins, discounts) are never passed to `writeProposal` — only `pricingMarkdown`
- [ ] Template content is never passed to `writeProposal` — only appended after LLM returns
- [ ] All DB queries include `organizationId` in `where` clause
- [ ] File is under 200 lines
- [ ] `pnpm vitest run tests/integration/inngest/generate-proposal.test.ts` exits 0
- [ ] `pnpm vitest run` (full suite) exits 0 with coverage ≥ 80%

---

## Phase 0: Code Review Gate

**This phase runs after all implementation tasks are complete.**

---

### Task 0.1: Code review of all F8 changes

**Status:** 🔴 Blocked by Tasks 1.2, 2.2, 3.2, 5.1
**Dependencies:** Tasks 1.2, 2.2, 3.2, 5.1

**Description:**
Run the `code-reviewer` agent across all 8 files changed in F8. Address all CRITICAL and HIGH severity findings before marking this task complete. MEDIUM findings should be addressed where practical.

Files to review:
- `src/lib/services/scope-line-parser.ts`
- `src/lib/services/proposal-draft.ts`
- `src/lib/ai/agents/proposal-writer.ts`
- `src/lib/inngest/functions/generate-proposal.ts`
- `tests/unit/services/scope-line-parser.test.ts`
- `tests/unit/services/proposal-draft.test.ts`
- `tests/unit/agents/proposal-writer.test.ts`
- `tests/integration/inngest/generate-proposal.test.ts`

Security checklist (from `security.md` and plan):
- [ ] No rate card values (rates, margins, discounts) appear in `writeProposal` call arguments
- [ ] No template content appears in the LLM prompt
- [ ] All DB queries in `generate-proposal.ts` include `organizationId` filter
- [ ] `parseScopeLines` performs no SQL, no shell execution — pure string processing only
- [ ] `pricingMarkdown` is output of `computePricingEstimate` only — no user-controlled string interpolated into SQL
- [ ] No hardcoded secrets or API keys

Coding style checklist (from `coding-style.md`):
- [ ] No mutations of arrays or objects passed as parameters (immutability)
- [ ] No `console.log` statements in production code
- [ ] No `any` type assertions
- [ ] Functions are under 50 lines
- [ ] Files are under 800 lines (all estimated well under)
- [ ] Error handling present on all async operations

**Acceptance Criteria:**
- [ ] Code review completed with no unresolved CRITICAL issues
- [ ] Code review completed with no unresolved HIGH issues
- [ ] All security checklist items verified
- [ ] All coding style checklist items verified
- [ ] Final `pnpm vitest run` passes with ≥ 80% coverage after any review-driven fixes
- [ ] Ready to commit: `feat: revised proposal pipeline — 11-step bid-ready generation`

---

## Task Dependency Graph

```
Phase 1: Scope Line Parser
  1.1 [READY]     → 1.2 [blocked by 1.1]

Phase 2: updateDraftContent Extension
  2.1 [READY]     → 2.2 [blocked by 2.1]

Phase 3: writeProposal Update
  3.1 [READY]     → 3.2 [blocked by 3.1]

Phase 4: Pipeline Integration Tests (TDD Gate)
  4.1 [blocked by 1.2, 2.2, 3.2]

Phase 5: Pipeline Implementation
  5.1 [blocked by 4.1]

Phase 0: Code Review Gate
  0.1 [blocked by 1.2, 2.2, 3.2, 5.1]
```

Phases 1, 2, and 3 are fully independent of each other and may be worked in parallel.

---

## File Change Checklist

| File | Task | Change Type |
|---|---|---|
| `tests/unit/services/scope-line-parser.test.ts` | 1.1 | New file |
| `src/lib/services/scope-line-parser.ts` | 1.2 | New file |
| `tests/unit/services/proposal-draft.test.ts` | 2.1 | Extend (2 new tests) |
| `src/lib/services/proposal-draft.ts` | 2.2 | Modify (optional 4th param) |
| `tests/unit/agents/proposal-writer.test.ts` | 3.1 | Rewrite |
| `src/lib/ai/agents/proposal-writer.ts` | 3.2 | Modify (new interface + restructured prompt) |
| `tests/integration/inngest/generate-proposal.test.ts` | 4.1 | Rewrite |
| `src/lib/inngest/functions/generate-proposal.ts` | 5.1 | Complete rewrite (6→11 steps) |
