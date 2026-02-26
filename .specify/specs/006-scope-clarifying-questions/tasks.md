# Task Breakdown — F6: Scope Clarifying Questions

**Feature ID:** F6
**Branch:** `006-scope-clarifying-questions` (stay on `main`)
**Spec:** `.specify/specs/006-scope-clarifying-questions/spec.md`
**Plan:** `.specify/specs/006-scope-clarifying-questions/plan.md`
**Generated:** 2026-02-26

---

## Summary

- **Total Tasks:** 18
- **Phases:** 4
- **Estimated Total Effort:** 8.5 hours
- **Estimated Duration (with parallelization):** ~1 day

### Phase Breakdown

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Tests — `proposal-question-generator` | 6 | 3.0 h |
| Phase 2: Implementation — `proposal-question-generator` | 4 | 2.5 h |
| Phase 3: Tests — `proposal-draft` call-site | 3 | 1.5 h |
| Phase 4: Implementation — `proposal-draft` call-site | 3 | 1.0 h |
| Quality Gates | 2 | 0.5 h |

### Critical Path

Task 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 3.3 → 4.1 → 4.2 → 4.3 → QG.1 → QG.2

---

## Dependency Graph

```
Phase 1 (tests — agent)
  1.1 ──┐
  1.2 ──┤
  1.3 ──┤ (parallel within Phase 1; all written before any implementation)
  1.4 ──┤
  1.5 ──┤
  1.6 ──┘
         │
         ▼
Phase 2 (impl — agent)
  2.1 (blocked by all of Phase 1)
  2.2 (blocked by 2.1)
  2.3 (blocked by 2.2)
  2.4 (blocked by 2.3)
         │
         ▼
Phase 3 (tests — call-site)
  3.1 ──┐
  3.2 ──┤ (parallel within Phase 3)
  3.3 ──┘
         │
         ▼
Phase 4 (impl — call-site)
  4.1 (blocked by all of Phase 3)
  4.2 (blocked by 4.1)
  4.3 (blocked by 4.2)
         │
         ▼
Quality Gates
  QG.1 → QG.2
```

---

## Phase 1: Tests — `proposal-question-generator.ts` (Write FAILING Tests First)

> All tasks in this phase modify `tests/unit/agents/proposal-question-generator.test.ts`.
> They add a new `describe('mandatory question injection', ...)` block.
> Tasks 1.1–1.6 are **independent of each other** and can be drafted in parallel,
> but **all must exist and FAIL before Phase 2 begins**.

---

### Task 1.1: Tests — `buildMandatoryQuestions` pure function (all pricing model variants)

**Status:** 🟡 Ready
**Effort:** 0.5 h
**Dependencies:** None
**Parallel with:** Tasks 1.2, 1.3, 1.4, 1.5, 1.6

**Description:**
Add unit tests for the pure `buildMandatoryQuestions` function directly (no LLM mock needed).
These tests call the function in isolation, varying the `pricingModel` argument across all four
possible values: `'time_and_materials'`, `'fixed_price'`, `'cost_plus'`, and `null`.

This function does not exist yet — the import will cause a compile/runtime failure, which
satisfies the RED step.

**Tests to write:**

```typescript
import { buildMandatoryQuestions, MANDATORY_QUESTION_IDS } from '@/lib/ai/agents/proposal-question-generator'

describe('buildMandatoryQuestions', () => {
  it('returns exactly 3 questions for time_and_materials', ...)
  it('returns exactly 3 questions for fixed_price', ...)
  it('returns exactly 3 questions for cost_plus', ...)
  it('returns exactly 3 questions when pricingModel is null (T&M fallback)', ...)
  it('scope-deliverables wording differs across T&M, fixed_price, cost_plus', ...)
  it('scope-deliverables null wording matches T&M wording', ...)
  it('scope-exclusions wording is identical across all pricing models', ...)
  it('scope-timeline wording is identical across all pricing models', ...)
})
```

**Acceptance Criteria:**
- [ ] Tests are written and added to the existing test file in a new `describe('buildMandatoryQuestions')` block
- [ ] All tests FAIL (function does not exist yet)
- [ ] Each test has a clear assertion (`expect(...).toBe(...)` or `toEqual(...)`)
- [ ] Tests verify stable IDs using `MANDATORY_QUESTION_IDS` constants (not magic strings)
- [ ] Tests verify `answer` is `null` on each returned question

---

### Task 1.2: Tests — Mandatory IDs always present in `generateClarifyingQuestions` output

**Status:** 🟡 Ready
**Effort:** 0.5 h
**Dependencies:** None
**Parallel with:** Tasks 1.1, 1.3, 1.4, 1.5, 1.6

**Description:**
Add integration-level unit tests (with mocked LLM) that verify all three mandatory question IDs
appear in the final `result.questions` array for every pricing model variant, including `null`.

Uses `vi.mocked(generateObject).mockResolvedValue(...)` returning 3 LLM questions (the typical
case).

**Tests to write:**

```typescript
describe('mandatory question injection — ID presence', () => {
  it('all three mandatory IDs present when pricingModel is time_and_materials', ...)
  it('all three mandatory IDs present when pricingModel is fixed_price', ...)
  it('all three mandatory IDs present when pricingModel is cost_plus', ...)
  it('all three mandatory IDs present when pricingModel is null', ...)
})
```

Each test: `expect(ids).toContain('scope-deliverables')`, `.toContain('scope-exclusions')`,
`.toContain('scope-timeline')`.

**Acceptance Criteria:**
- [ ] 4 tests written, each parameterised by `pricingModel` value
- [ ] All tests FAIL (function does not yet accept `pricingModel` param or inject mandatory questions)
- [ ] Mock returns controlled LLM output (3 questions with `q1`, `q2`, `q3` IDs)

---

### Task 1.3: Tests — Mandatory questions at front of output array

**Status:** 🟡 Ready
**Effort:** 0.25 h
**Dependencies:** None
**Parallel with:** Tasks 1.1, 1.2, 1.4, 1.5, 1.6

**Description:**
Verify that mandatory questions occupy positions 0, 1, 2 in the returned questions array,
and that LLM-generated questions follow.

**Tests to write:**

```typescript
describe('mandatory question injection — ordering', () => {
  it('mandatory questions are the first 3 elements in the result array', ...)
  it('LLM-generated questions appear after mandatory questions (index >= 3)', ...)
})
```

**Acceptance Criteria:**
- [ ] 2 tests written
- [ ] Tests check `result.questions[0].id === 'scope-deliverables'`, `[1]` exclusions, `[2]` timeline
- [ ] All tests FAIL

---

### Task 1.4: Tests — LLM question count trimming and merge ceiling

**Status:** 🟡 Ready
**Effort:** 0.25 h
**Dependencies:** None
**Parallel with:** Tasks 1.1, 1.2, 1.3, 1.5, 1.6

**Description:**
Verify the trim-and-merge logic for different LLM output sizes.

**Tests to write:**

```typescript
describe('mandatory question injection — count ceiling', () => {
  it('LLM returns 10 questions → trimmed to 7 → total result is 10', ...)
  it('LLM returns 3 questions → total result is 6', ...)
  it('LLM returns 0 questions → total result is 3 (mandatory only)', ...)
})
```

For the "LLM returns 10" test: mock `generateObject` to return an array of 10 questions; assert
`result.questions.length === 10` and mandatory questions are at index 0–2.

**Acceptance Criteria:**
- [ ] 3 tests written
- [ ] All tests FAIL
- [ ] "LLM returns 0" case also verifies the `answer: null` field on each mandatory question

---

### Task 1.5: Tests — System prompt includes pricing model label and deduplication instruction

**Status:** 🟡 Ready
**Effort:** 0.25 h
**Dependencies:** None
**Parallel with:** Tasks 1.1, 1.2, 1.3, 1.4, 1.6

**Description:**
Capture the `generateObject` call args and assert the `system` prompt string contains:
1. The correct human-readable pricing model label (e.g. `"Time & Materials"`)
2. The deduplication instruction (`"Do NOT ask about"` with the forbidden keywords)
3. The updated cardinality instruction (`"1 and 7"` instead of `"3 and 10"`)

**Tests to write:**

```typescript
describe('mandatory question injection — system prompt', () => {
  it('system prompt includes "Time & Materials" label for time_and_materials model', ...)
  it('system prompt includes "Fixed Price" label for fixed_price model', ...)
  it('system prompt includes "Cost-Plus" label for cost_plus model', ...)
  it('system prompt includes fallback label when pricingModel is null', ...)
  it('system prompt contains deduplication instruction (deliverables, exclusions, timeline)', ...)
  it('system prompt instructs LLM to return between 1 and 7 questions', ...)
})
```

**Acceptance Criteria:**
- [ ] 6 tests written
- [ ] All tests FAIL
- [ ] Assertions use `toContain(...)` on the captured system prompt string

---

### Task 1.6: Tests — Backward compatibility (existing tests still pass with optional `pricingModel`)

**Status:** 🟡 Ready
**Effort:** 0.25 h
**Dependencies:** None
**Parallel with:** Tasks 1.1, 1.2, 1.3, 1.4, 1.5

**Description:**
Write a regression test that calls `generateClarifyingQuestions` without passing `pricingModel`
at all (omitting it entirely, as the existing `baseInput` fixture does), and verifies that:
- The call succeeds
- The three mandatory questions are still present (T&M fallback)
- Existing question shape (id, question, rfpSection, answer: null) is preserved

This test guards the backward-compatibility guarantee from the plan.

**Tests to write:**

```typescript
describe('mandatory question injection — backward compatibility', () => {
  it('omitting pricingModel does not break existing callers; mandatory questions present with T&M wording', ...)
})
```

**Acceptance Criteria:**
- [ ] 1 test written using the existing `baseInput` fixture (which has no `pricingModel` field)
- [ ] Test FAILS (mandatory questions not injected yet)

---

## Phase 2: Implementation — `proposal-question-generator.ts`

> **Blocked by:** All of Phase 1 (Tasks 1.1–1.6 must be written and FAILING)
>
> File: `src/lib/ai/agents/proposal-question-generator.ts`
>
> Tasks within this phase are **sequential** — each builds on the previous.

---

### Task 2.1: Implement — `MANDATORY_QUESTION_IDS` constants and `pricingModel` input parameter

**Status:** 🔴 Blocked by Tasks 1.1–1.6
**Effort:** 0.5 h
**Dependencies:** Tasks 1.1, 1.2, 1.3, 1.4, 1.5, 1.6

**Description:**
Make the minimal changes needed to unblock the type-level failures in Phase 1 tests, without yet
implementing the logic.

Changes:
1. Export `MANDATORY_QUESTION_IDS` constant object with three string literals
2. Add `pricingModel?: ProposalDefaults['pricingModel'] | null` to `GenerateClarifyingQuestionsInput`
   - Import `ProposalDefaults` from `@/lib/db/schema/tenant-settings`
   - The field is optional for backward compatibility

**Do not yet implement `buildMandatoryQuestions` or modify the prompt.**

**Acceptance Criteria:**
- [ ] `MANDATORY_QUESTION_IDS.DELIVERABLES`, `.EXCLUSIONS`, `.TIMELINE` are exported with the correct string values
- [ ] `GenerateClarifyingQuestionsInput.pricingModel` is present and correctly typed as optional
- [ ] Existing tests (non-mandatory) still pass
- [ ] Task 1.1 tests for `MANDATORY_QUESTION_IDS` now pass
- [ ] Task 1.2–1.6 tests still fail (no injection logic yet)

---

### Task 2.2: Implement — `buildMandatoryQuestions` pure function

**Status:** 🔴 Blocked by Task 2.1
**Effort:** 0.75 h
**Dependencies:** Task 2.1

**Description:**
Implement and export the `buildMandatoryQuestions` function.

The function signature:
```typescript
export function buildMandatoryQuestions(
  pricingModel: ProposalDefaults['pricingModel'] | null | undefined
): ClarifyingQuestion[]
```

Logic:
- Always returns exactly 3 `ClarifyingQuestion` objects with `answer: null`
- IDs are taken from `MANDATORY_QUESTION_IDS` constants
- `scope-deliverables` question text varies by pricing model:
  - `time_and_materials` or `null` or `undefined`: ask for deliverables + estimated hours per deliverable
  - `fixed_price`: ask for total fixed engagement price or budget the preparer intends to quote
  - `cost_plus`: ask for estimated direct cost breakdown per deliverable and target margin percentage
- `scope-exclusions` question text is identical regardless of pricing model
- `scope-timeline` question text is identical regardless of pricing model
- `rfpSection` for all three: use a descriptive label (e.g. `"Commercial Scope"` for deliverables,
  `"Scope Exclusions"` for exclusions, `"Delivery Timeline"` for timeline)

**Acceptance Criteria:**
- [ ] `buildMandatoryQuestions` is exported and callable without LLM or DB
- [ ] All Task 1.1 tests (`buildMandatoryQuestions` unit tests) pass
- [ ] Task 1.2–1.6 integration tests still fail (no injection into `generateClarifyingQuestions` yet)
- [ ] Function has zero side effects (no I/O, no async)

---

### Task 2.3: Implement — Modified system prompt (cardinality + deduplication + pricing label)

**Status:** 🔴 Blocked by Task 2.2
**Effort:** 0.5 h
**Dependencies:** Task 2.2

**Description:**
Modify the `generateObject` call's `system` prompt inside `generateClarifyingQuestions`:

1. Add a `pricingModelLabel` lookup map (hardcoded, not user-interpolated):
   ```
   time_and_materials → "Time & Materials"
   fixed_price        → "Fixed Price"
   cost_plus          → "Cost-Plus"
   null/undefined     → "Time & Materials (default — no model configured)"
   ```

2. Prepend to the system prompt (before the Rules section):
   ```
   Organization pricing model: ${pricingModelLabel}
   When phrasing questions about effort or cost, use this model's terminology.
   ```

3. Change `"Return between 3 and 10 questions"` to `"Return between 1 and 7 questions"`.

4. Add to the Rules section:
   ```
   Do NOT ask about: deliverables, effort, hours, pricing, cost, budget, timeline,
   milestones, or explicit exclusions. Those questions will be added separately.
   ```

**Acceptance Criteria:**
- [ ] Task 1.5 tests (system prompt assertions) all pass
- [ ] Task 1.2–1.4 and 1.6 integration tests still fail (no merge logic yet)
- [ ] `pricingModelLabel` is built from a switch/map — the raw `pricingModel` value is never interpolated directly into the prompt (security: no prompt injection surface)

---

### Task 2.4: Implement — Post-generation trim and merge logic

**Status:** 🔴 Blocked by Task 2.3
**Effort:** 0.75 h
**Dependencies:** Task 2.3

**Description:**
After `generateObject` resolves, apply the trim-and-merge logic:

```typescript
const mandatoryQuestions = buildMandatoryQuestions(pricingModel)
const llmQuestions: ClarifyingQuestion[] = object.questions
  .slice(0, 7)           // trim to 7 max
  .map((q) => ({ ...q, answer: null }))
const questions = [...mandatoryQuestions, ...llmQuestions]
return { questions }
```

Replace the existing `questions` construction and `return` statement.

**Acceptance Criteria:**
- [ ] All Phase 1 tests (Tasks 1.1–1.6) pass — GREEN
- [ ] All pre-existing tests in the file still pass (no regressions)
- [ ] `pnpm vitest run tests/unit/agents/proposal-question-generator.test.ts` exits 0
- [ ] Total questions is in range [3, 10] for all test cases

---

## Phase 3: Tests — `proposal-draft.ts` Call-Site (Write FAILING Tests First)

> **Blocked by:** Phase 2 complete (Task 2.4 passing)
>
> File: `tests/unit/services/proposal-draft.test.ts`
>
> Tasks 3.1–3.3 are independent of each other and can be drafted in parallel,
> but **all must exist and FAIL before Phase 4 begins**.

---

### Task 3.1: Tests — `pricingModel` forwarded from rate card settings

**Status:** 🔴 Blocked by Task 2.4
**Effort:** 0.5 h
**Dependencies:** Task 2.4
**Parallel with:** Tasks 3.2, 3.3

**Description:**
Add `vi.mock('@/lib/services/rate-card', () => ({ getRateCard: vi.fn() }))` at the top of the
existing test file. Import `getRateCard`.

Write a test that:
1. Mocks `getRateCard` to resolve with `{ proposalDefaults: { pricingModel: 'fixed_price', paymentTermsDays: 30, warrantyPeriodDays: 90 } }`
2. Calls `createDraft('rfp-1', 'org-1', 'user-1')` with the standard DB mocks set up
3. Asserts `generateClarifyingQuestions` was called with `pricingModel: 'fixed_price'`

**Tests to write:**

```typescript
describe('createDraft — pricing model forwarding', () => {
  it('passes pricingModel from rate card settings to generateClarifyingQuestions', ...)
})
```

**Acceptance Criteria:**
- [ ] `vi.mock('@/lib/services/rate-card', ...)` added to the mock section at the top of the file
- [ ] `getRateCard` imported after the mock
- [ ] Test written and FAILING (call-site not yet modified to call `getRateCard`)

---

### Task 3.2: Tests — `pricingModel` is null when `proposalDefaults` is null

**Status:** 🔴 Blocked by Task 2.4
**Effort:** 0.5 h
**Dependencies:** Task 2.4
**Parallel with:** Tasks 3.1, 3.3

**Description:**
Write a test that:
1. Mocks `getRateCard` to resolve with `{ proposalDefaults: null }` (no defaults configured)
2. Calls `createDraft`
3. Asserts `generateClarifyingQuestions` was called with `pricingModel: null`

**Tests to write:**

```typescript
it('passes pricingModel: null when proposalDefaults is null', ...)
```

**Acceptance Criteria:**
- [ ] 1 test written and FAILING
- [ ] Uses same mock setup scaffold from Task 3.1

---

### Task 3.3: Tests — `pricingModel` is null and draft creation succeeds when `getRateCard` throws

**Status:** 🔴 Blocked by Task 2.4
**Effort:** 0.5 h
**Dependencies:** Task 2.4
**Parallel with:** Tasks 3.1, 3.2

**Description:**
Write a test that:
1. Mocks `getRateCard` to reject with `new Error('DB timeout')`
2. Calls `createDraft`
3. Asserts `generateClarifyingQuestions` was STILL called (draft creation was not aborted)
4. Asserts `generateClarifyingQuestions` was called with `pricingModel: null` (T&M fallback)
5. Asserts `createDraft` resolves successfully (does not throw)

This covers FR-016: graceful degradation on settings read failure.

**Tests to write:**

```typescript
it('proceeds with pricingModel: null and does not throw when getRateCard rejects', ...)
```

**Acceptance Criteria:**
- [ ] 1 test written and FAILING
- [ ] Test explicitly checks that `createDraft` resolves (does not re-throw the `getRateCard` error)

---

## Phase 4: Implementation — `proposal-draft.ts` Call-Site

> **Blocked by:** All of Phase 3 (Tasks 3.1–3.3 must be written and FAILING)
>
> File: `src/lib/services/proposal-draft.ts`
>
> Tasks within this phase are sequential.

---

### Task 4.1: Implement — Import `getRateCard` and `ProposalDefaults` type

**Status:** 🔴 Blocked by Tasks 3.1–3.3
**Effort:** 0.25 h
**Dependencies:** Tasks 3.1, 3.2, 3.3

**Description:**
Add the two imports to `src/lib/services/proposal-draft.ts`:

```typescript
import { getRateCard } from '@/lib/services/rate-card'
import type { ProposalDefaults } from '@/lib/db/schema/tenant-settings'
```

No logic changes yet — just add the imports. Verify the file still compiles.

**Acceptance Criteria:**
- [ ] Imports added without introducing lint errors
- [ ] TypeScript compiles (`pnpm tsc --noEmit` passes or pre-existing errors unchanged)
- [ ] Phase 3 tests still fail (call-site logic not changed yet)

---

### Task 4.2: Implement — `getRateCard` try/catch in `createDraft` with T&M fallback

**Status:** 🔴 Blocked by Task 4.1
**Effort:** 0.5 h
**Dependencies:** Task 4.1

**Description:**
In `createDraft`, add the pricing model fetch before the `generateClarifyingQuestions` call:

```typescript
let pricingModel: ProposalDefaults['pricingModel'] | null = null
try {
  const { proposalDefaults } = await getRateCard(orgId)
  pricingModel = proposalDefaults?.pricingModel ?? null
} catch (err) {
  // FR-016: settings read failure → T&M fallback; do not propagate
  console.warn('[createDraft] Could not read rate card for pricing model; defaulting to T&M', (err as Error).message)
}
```

Note: Use `console.warn` only (no orgId or settings data in the log). No structured logger utility
exists in `src/lib/utils/` — `console.warn` is the correct and final choice for this project.

**Acceptance Criteria:**
- [ ] `pricingModel` variable declared and populated before `generateClarifyingQuestions` call
- [ ] Task 3.3 test (getRateCard throws → does not throw) now passes
- [ ] Task 3.1 and 3.2 tests still fail (`pricingModel` not yet forwarded to question generator)

---

### Task 4.3: Implement — Forward `pricingModel` to `generateClarifyingQuestions`

**Status:** 🔴 Blocked by Task 4.2
**Effort:** 0.25 h
**Dependencies:** Task 4.2

**Description:**
Update the `generateClarifyingQuestions` call in `createDraft` to pass `pricingModel`:

```typescript
const { questions } = await generateClarifyingQuestions({
  rfpFields: rfp.parsedStructure.fields,
  rfpSummary: rfp.name,
  knowledgeTopics: [],
  contentLibraryCategories: [],
  organizationId: orgId,
  pricingModel,       // NEW
})
```

**Acceptance Criteria:**
- [ ] All Phase 3 tests (Tasks 3.1–3.3) pass — GREEN
- [ ] All pre-existing `createDraft` tests still pass (no regressions)
- [ ] `pnpm vitest run tests/unit/services/proposal-draft.test.ts` exits 0

---

## Quality Gates

### Task QG.1: Full Test Suite — Verify No Regressions and Coverage Threshold

**Status:** 🔴 Blocked by Task 4.3
**Effort:** 0.25 h
**Dependencies:** Task 4.3

**Description:**
Run the full Vitest suite to verify:
1. All new tests pass (GREEN)
2. No pre-existing tests broken (no regressions)
3. Coverage threshold maintained (≥ 80%)

```bash
pnpm vitest run --coverage
```

Review the coverage report for `proposal-question-generator.ts` and `proposal-draft.ts`.
All branches in `buildMandatoryQuestions` (4 pricing model variants × 3 question fields) must
be covered.

**Acceptance Criteria:**
- [ ] `pnpm vitest run` exits 0
- [ ] Coverage for `proposal-question-generator.ts` ≥ 80%
- [ ] Coverage for `proposal-draft.ts` ≥ 80%
- [ ] No pre-existing test failures introduced
- [ ] Total new tests: at least 25 (Phase 1: ~18 tests, Phase 3: ~3 tests)

---

### Task QG.2: Code Review and Security Check

**Status:** 🔴 Blocked by Task QG.1
**Effort:** 0.25 h
**Dependencies:** Task QG.1

**Description:**
Run the `code-reviewer` agent on both modified source files. Focus on:

1. **Security:** Confirm `pricingModel` value is never directly interpolated into the prompt —
   it must go through the hardcoded label map (NFR-002 / prompt injection prevention)
2. **Type safety:** No `any` types introduced; `ProposalDefaults['pricingModel']` used as the
   single source of truth for the union type (NFR-003)
3. **Immutability:** `buildMandatoryQuestions` returns new objects; no mutation of input
4. **Error handling:** `console.warn` in the catch block uses only `err.message`, not `orgId`
   or settings data (Constitution Article IV: Secure by Default)
5. **Backward compatibility:** Existing callers of `generateClarifyingQuestions` that omit
   `pricingModel` are unaffected

**Acceptance Criteria:**
- [ ] No CRITICAL or HIGH issues from code reviewer
- [ ] `pricingModel` prompt interpolation uses hardcoded label map (verified by inspection)
- [ ] No `any` types in either modified file
- [ ] All MEDIUM issues documented or resolved

---

## User Story → Task Mapping

| User Story | Tasks |
|---|---|
| US-001: Scope/Deliverables question always present | 1.1, 1.2, 1.3, 2.1, 2.2, 2.4 |
| US-002: Exclusions question always present | 1.1, 1.2, 2.1, 2.2, 2.4 |
| US-003: Pricing question adapts to pricing model | 1.1, 1.5, 2.2, 2.3 |
| US-004: Timeline question always present | 1.1, 1.2, 2.1, 2.2, 2.4 |
| US-005: LLM context questions continue to work | 1.4, 1.6, 2.3, 2.4 |
| US-006: Pricing context available to LLM | 1.5, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3 |

---

## Functional Requirement → Task Mapping

| FR | Tasks |
|---|---|
| FR-001 scope question present | 1.2, 2.4 |
| FR-002 exclusions question present | 1.2, 2.4 |
| FR-003 timeline question present | 1.2, 2.4 |
| FR-004 mandatory regardless of RFP content | 1.2, 2.4 |
| FR-005 T&M wording | 1.1, 2.2 |
| FR-006 Fixed Price wording | 1.1, 2.2 |
| FR-007 Cost-Plus wording | 1.1, 2.2 |
| FR-008 null fallback to T&M | 1.1, 1.6, 2.2 |
| FR-009 system prompt includes pricing model | 1.5, 2.3 |
| FR-010 pricing model read at generation time | 3.1, 4.2 |
| FR-011 LLM questions not removed | 1.4, 2.4 |
| FR-012 LLM instructed to skip mandatory topics | 1.5, 2.3 |
| FR-013 total count ceiling enforced | 1.4, 2.4 |
| FR-014 stable question IDs | 1.1, 2.1 |
| FR-015 pricingModel as input parameter | 2.1, 4.3 |
| FR-016 settings read failure → T&M fallback | 3.3, 4.2 |

---

## Parallelization Summary

| Window | Parallel Tasks |
|--------|---------------|
| Phase 1 (write tests simultaneously) | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 |
| Phase 3 (write tests simultaneously) | 3.1, 3.2, 3.3 |
| All other tasks | Sequential (each blocked by prior) |

---

## Notes for Implementer

- **Stay on `main`** — this feature does not require a separate branch per the plan.
- **No new files** — all changes go into the two existing source files and two existing test files.
- **No schema migration** — `proposal_defaults` JSONB column already exists.
- **Backward compatibility is non-negotiable** — the existing `baseInput` fixture in the test file
  has no `pricingModel` field; adding it as an optional param must not break any existing test.
- **Do not touch** `tests/integration/` — the existing integration test (`generate-proposal.test.ts`)
  covers the full flow and does not need updating for this change.
- **Run tests after each phase**, not just at QG.1, to catch regressions early:
  ```bash
  pnpm vitest run tests/unit/agents/proposal-question-generator.test.ts
  pnpm vitest run tests/unit/services/proposal-draft.test.ts
  ```
- **Commit message** (when ready):
  ```
  feat: guaranteed scope clarifying questions with pricing model awareness
  ```
