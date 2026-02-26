# Task Breakdown: F7 — Requirement-Driven Retrieval

**Feature ID:** F7
**Branch:** `main`
**Spec:** `.specify/specs/007-requirement-driven-retrieval/spec.md`
**Plan:** `.specify/specs/007-requirement-driven-retrieval/plan.md`
**Data Model:** `.specify/specs/007-requirement-driven-retrieval/data-model.md`
**Contracts:** `.specify/specs/007-requirement-driven-retrieval/contracts/proposal-retrieval-api.yaml`

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 14 |
| Phases | 4 |
| Estimated Effort | 9.5 hours |
| Estimated Duration | 1–2 days (with parallelization in Phase 2) |

### Task Count by Phase

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Module Skeleton | 1 | 0.5 h |
| Phase 2: Test Suite (TDD — RED) | 4 | 4.0 h |
| Phase 3: Implementation (GREEN) | 4 | 3.5 h |
| Phase 4: Quality Gates | 5 | 1.5 h |
| **Total** | **14** | **9.5 h** |

---

## Critical Path

```
Task 1.1 → Task 2.1 → Task 3.1 → Task 4.1 → Task 4.2 → Task 4.3 → Task 4.4 → Task 4.5
```

Tasks 2.2, 2.3, and 2.4 are parallel with 2.1 (unblocked by each other; all blocked only by 1.1).
Tasks 3.2, 3.3, and 3.4 are parallel with 3.1 (unblocked by each other; each blocked by its own test task).

---

## TDD Enforcement

Every implementation task is **blocked** by its corresponding test task. Tests must be written
and confirmed failing (RED) before any implementation begins.

```
Task 2.1 (tests — RED)  →  Task 3.1 (implement — GREEN)
Task 2.2 (tests — RED)  →  Task 3.2 (implement — GREEN)
Task 2.3 (tests — RED)  →  Task 3.3 (implement — GREEN)
Task 2.4 (tests — RED)  →  Task 3.4 (implement — GREEN)
```

---

## Phase 1: Module Skeleton and Types

**Goal:** Create `proposal-retrieval.ts` with exported types, module constants, and empty function
stubs. TypeScript must compile cleanly from this task forward.

---

### Task 1.1: Create Module Skeleton with Types and Stubs

**Status:** 🟡 Ready
**Effort:** 0.5 h
**Dependencies:** None
**Parallel with:** Nothing (foundation for all other tasks)

**Description:**

Create `src/lib/services/proposal-retrieval.ts` with:

1. Module-level constants at the top:
   ```typescript
   const REQUIREMENT_SEARCH_CAP = 10
   const RESULTS_PER_REQUIREMENT = 5
   ```

2. Type and interface exports matching the contracts file:
   - `export interface RequirementField { id: string; question: string; type?: string }`
   - `export interface TypedSupplierContext { companyDocs: KnowledgeEntry[]; certifications: KnowledgeEntry[]; caseStudies: KnowledgeEntry[]; wonPastRfps: KnowledgeEntry[] }`
   - `export type CustomerContext = NonNullable<Customer['settings']> | null`
   - `export type { KnowledgeEntryWithSimilarity } from '@/lib/services/vector-search'`
   - `export type { Learning } from '@/lib/db/schema/learnings'`

3. Four async function stubs with correct signatures and bodies that return empty/null values:
   - `searchByRequirements(fields, orgId, openaiApiKey?)` → returns `[]`
   - `fetchTypedSupplierContext(orgId, industryTags?, rfpType?, openaiApiKey?)` → returns empty `TypedSupplierContext`
   - `fetchCustomerContext(customerId, orgId)` → returns `null`
   - `fetchLearnings(orgId, customerId?)` → returns `[]`

4. Required imports from:
   - `@/lib/db`
   - `@/lib/db/schema/knowledge-entries`
   - `@/lib/db/schema/customers`
   - `@/lib/db/schema/learnings`
   - `@/lib/ai/embeddings`
   - `@/lib/services/vector-search` (type only)
   - `drizzle-orm` (`eq`, `and`, `or`, `isNull`, `isNotNull`, `sql`)

**Acceptance Criteria:**
- [ ] File `src/lib/services/proposal-retrieval.ts` exists
- [ ] Both module constants defined as named consts (no magic numbers)
- [ ] All four function signatures exported and match `contracts/proposal-retrieval-api.yaml`
- [ ] All exported types match the data-model type contracts
- [ ] `pnpm tsc --noEmit` passes with no errors after this task
- [ ] No `any` types in the file

---

## Phase 2: Test Suite (TDD — RED State)

**Goal:** Write the complete unit test file. Every test must **FAIL** against the stubs from Phase 1.
Do NOT implement any function logic during this phase.

All four test tasks are independent and can be written in parallel. Each targets one function.
All are blocked only by Task 1.1.

---

### Task 2.1: Write Tests for `searchByRequirements`

**Status:** 🔴 Blocked by Task 1.1
**Effort:** 1.25 h
**Dependencies:** Task 1.1
**Parallel with:** Tasks 2.2, 2.3, 2.4

**Description:**

Create `tests/unit/services/proposal-retrieval.test.ts` (or open it if already started).

Use the same `vi.hoisted` + `vi.mock` pattern from `tests/unit/services/vector-search.test.ts`
to build a chainable Drizzle mock: `.select().from().where().orderBy().limit()`.
Also mock `@/lib/ai/embeddings` `generateEmbedding`.

Write a `describe('searchByRequirements')` block with the following test cases (all must FAIL
against the stub that returns `[]` for the wrong reasons — primarily that the stub skips all
logic, not that the test assertions are wrong):

1. **Empty fields array** — call with `[]`, assert empty array returned, assert `generateEmbedding`
   was never called.
2. **Single requirement field** — call with one field, assert `generateEmbedding` called once with
   the field's `question` text, assert results array length equals fixture length.
3. **Multiple fields, each gets one embedding call** — call with 3 fields, assert `generateEmbedding`
   called 3 times, results from all three queries merged.
4. **Fields count exceeds cap (>10)** — call with 12 fields, assert `generateEmbedding` called
   exactly `REQUIREMENT_SEARCH_CAP` (10) times; last 2 fields never queried.
5. **Deduplication: highest similarity retained** — configure mock so entry `id-A` appears in
   two query results with similarity scores 0.9 and 0.7; assert final array contains `id-A`
   exactly once with similarity 0.9.
6. **Same entry returned by two queries with equal similarity** — entry `id-B` at 0.8 from both;
   assert `id-B` appears once (either copy acceptable — uniqueness is the requirement).
7. **OpenAI key absent** — unset `process.env.OPENAI_API_KEY`, call with no `openaiApiKey` arg,
   assert empty array returned, assert `generateEmbedding` never called.
8. **Single embedding call rejects** — mock first `generateEmbedding` call to reject; mock
   second to resolve; assert second query's results are present in output; assert no error thrown.

**Fixture design:**
- `makeKnowledgeEntryWithSimilarity(overrides)` — factory returning a `KnowledgeEntryWithSimilarity`
  with sensible defaults, configurable `id`, `similarity`, `type`, `tags`, `metadata`, `organizationId`.

**Acceptance Criteria:**
- [ ] All 8 test cases exist in `describe('searchByRequirements')`
- [ ] Running `pnpm test tests/unit/services/proposal-retrieval.test.ts` shows all 8 tests **FAILING** (RED)
- [ ] No test is skipped or commented out
- [ ] Mocking pattern uses `vi.hoisted` consistent with existing test conventions

---

### Task 2.2: Write Tests for `fetchTypedSupplierContext`

**Status:** 🔴 Blocked by Task 1.1
**Effort:** 1.0 h
**Dependencies:** Task 1.1
**Parallel with:** Tasks 2.1, 2.3, 2.4

**Description:**

In `tests/unit/services/proposal-retrieval.test.ts`, add a `describe('fetchTypedSupplierContext')`
block with the following test cases:

1. **Returns four distinct groups** — configure mock for each type query; assert `companyDocs`,
   `certifications`, `caseStudies`, `wonPastRfps` are all present as arrays with their respective
   fixture entries; assert no cross-type leakage (e.g., no certification in `companyDocs`).
2. **`past_rfp` entries with `outcome='won'`** — fixture `KnowledgeEntry` with
   `type='past_rfp'` and `metadata: { outcome: 'won' }`; assert it appears in `wonPastRfps`.
3. **`past_rfp` entries with `outcome='lost'` excluded** — fixture with `metadata: { outcome: 'lost' }`;
   assert it does NOT appear in `wonPastRfps` (the query filter must exclude it).
4. **`past_rfp` entries with no outcome excluded** — fixture with `metadata: {}` or `metadata: null`;
   assert it does NOT appear in `wonPastRfps`.
5. **`company_doc` entries never appear in other groups** — assert `companyDocs` fixture entry
   is absent from `certifications`, `caseStudies`, and `wonPastRfps`.
6. **Non-empty `industryTags` activates tag filter** — call with `industryTags: ['healthcare']`;
   verify the Drizzle `sql` template was called with a fragment containing `?|`; assert only
   tag-matching fixtures appear in `wonPastRfps`.
7. **Null/empty `industryTags` — no tag filter applied** — call with `null` then with `[]`;
   assert `wonPastRfps` returns all `outcome='won'` entries regardless of tags.
8. **Empty knowledge base** — all mock queries resolve to `[]`; assert all four groups are
   empty arrays; assert no error thrown.

**Fixture design:**
- `makeKnowledgeEntry(overrides)` — returns `KnowledgeEntry` (without similarity) with configurable
  `type`, `tags`, `metadata`, `organizationId`.

**Acceptance Criteria:**
- [ ] All 8 test cases exist in `describe('fetchTypedSupplierContext')`
- [ ] Tests FAIL (RED) against the stub
- [ ] Tag filter test verifies the SQL fragment contains `?|` (implementation detail check)
- [ ] No test is skipped or commented out

---

### Task 2.3: Write Tests for `fetchCustomerContext`

**Status:** 🔴 Blocked by Task 1.1
**Effort:** 0.75 h
**Dependencies:** Task 1.1
**Parallel with:** Tasks 2.1, 2.2, 2.4

**Description:**

In `tests/unit/services/proposal-retrieval.test.ts`, add a `describe('fetchCustomerContext')`
block with the following test cases:

1. **Customer exists with settings** — mock DB returns a customer row with
   `settings: { preferredTone: 'formal', industryContext: 'government' }`; assert the settings
   object is returned as-is.
2. **Customer exists with null settings** — mock DB returns a customer row with `settings: null`;
   assert `null` is returned (not an empty object).
3. **Customer ID not found** — mock DB returns empty array `[]`; assert `null` is returned.
4. **Tenant isolation: customer belongs to different org** — mock DB returns `[]` when
   `orgId` does not match; assert `null` is returned. Verify the WHERE clause uses both
   `customerId` AND `orgId` (inspect mock call arguments).

**Fixture design:**
- `makeCustomer(overrides)` — returns a `Customer` shape with configurable `id`,
  `organizationId`, `settings`.

**Acceptance Criteria:**
- [ ] All 4 test cases exist in `describe('fetchCustomerContext')`
- [ ] Tests FAIL (RED) against the stub (stub returns `null` — test case 1 will fail; others pass vacuously, so test 1 is the key failure)
- [ ] Tenant isolation test explicitly inspects mock call args to confirm `orgId` is passed in WHERE
- [ ] No test is skipped or commented out

---

### Task 2.4: Write Tests for `fetchLearnings`

**Status:** 🔴 Blocked by Task 1.1
**Effort:** 1.0 h
**Dependencies:** Task 1.1
**Parallel with:** Tasks 2.1, 2.2, 2.3

**Description:**

In `tests/unit/services/proposal-retrieval.test.ts`, add a `describe('fetchLearnings')` block
with the following test cases:

1. **Customer-specific learnings ordered before org-wide** — fixture: two learnings, one with
   `customerId: 'cust-A'` and one with `customerId: null`; call with `customerId: 'cust-A'`;
   assert customer-specific learning appears at index 0; assert both are returned.
2. **Only org-wide learnings when `customerId` not provided** — fixture: two learnings, one
   customer-specific and one org-wide; call without `customerId`; assert only the org-wide
   learning (`customerId: null`) is returned; customer-specific learning absent.
3. **No learnings exist** — mock DB returns `[]`; assert empty array returned; no error thrown.
4. **Tenant isolation: learnings from other org never included** — fixture: two learnings with
   different `organizationId` values; assert only the matching org's learnings are in the result.
   Inspect mock call args to confirm `organizationId` is in the WHERE clause.

**Fixture design:**
- `makeLearning(overrides)` — returns a `Learning` shape with configurable `id`,
  `organizationId`, `customerId`, `content`, `sourceType`, `createdBy`.

**Acceptance Criteria:**
- [ ] All 4 test cases exist in `describe('fetchLearnings')`
- [ ] Tests FAIL (RED) against the stub
- [ ] Ordering test explicitly checks array index (not just membership)
- [ ] Tenant isolation test inspects mock call args
- [ ] No test is skipped or commented out

---

### Phase 2 Gate: Confirm RED State

Before proceeding to Phase 3, run the test suite and confirm every test fails:

```bash
pnpm test tests/unit/services/proposal-retrieval.test.ts
```

**Expected:** All tests FAIL. If any test passes against a stub, the test is asserting the wrong
thing — fix the test before proceeding.

---

## Phase 3: Implementation (GREEN State)

**Goal:** Implement all four functions to make Phase 2 tests pass. Each implementation task is
blocked by its corresponding test task. Implementations in Tasks 3.1–3.4 are independent and
can be written in parallel once their test counterpart is complete.

---

### Task 3.1: Implement `searchByRequirements`

**Status:** 🔴 Blocked by Task 2.1
**Effort:** 1.0 h
**Dependencies:** Task 2.1
**Parallel with:** Tasks 3.2, 3.3, 3.4 (after their respective test tasks complete)

**Description:**

Implement `searchByRequirements` in `src/lib/services/proposal-retrieval.ts` following the
outline in `plan.md` Phase 3:

1. Return `[]` immediately if `fields` is empty or both `openaiApiKey` and
   `process.env.OPENAI_API_KEY` are absent.
2. Slice `fields` to `REQUIREMENT_SEARCH_CAP` (10).
3. Use `Promise.allSettled` to run one embedding + pgvector query per sliced field concurrently.
4. Each settled result: if `status === 'fulfilled'`, iterate entries; if `status === 'rejected'`,
   skip silently (no error propagated, debug-level log permitted).
5. Deduplicate using `Map<string, KnowledgeEntryWithSimilarity>` keyed by entry `id`;
   when a duplicate is found, keep the copy with the higher `similarity` score.
6. Return `Array.from(dedupeMap.values())`.

**Key implementation details:**
- pgvector order expression: `sql\`${knowledgeEntries.embedding} <=> ${JSON.stringify(embedding)}::vector\``
- Per-query limit: `.limit(RESULTS_PER_REQUIREMENT)`
- WHERE clause must include `and(eq(knowledgeEntries.organizationId, orgId), isNotNull(knowledgeEntries.embedding))`
- SELECT must exclude the `embedding` column (bandwidth/cost savings; the `similarity` pseudo-column
  is added by the ORDER BY expression — follow the pattern in `vector-search.ts`)

**Acceptance Criteria:**
- [ ] All 8 tests in `describe('searchByRequirements')` now PASS (GREEN)
- [ ] `pnpm tsc --noEmit` passes — no TypeScript errors
- [ ] No `any` types introduced
- [ ] No `console.log` statements; only `console.debug` permitted for cap-exceeded message
- [ ] `REQUIREMENT_SEARCH_CAP` and `RESULTS_PER_REQUIREMENT` constants used (no magic numbers)

---

### Task 3.2: Implement `fetchTypedSupplierContext`

**Status:** 🔴 Blocked by Task 2.2
**Effort:** 1.0 h
**Dependencies:** Task 2.2
**Parallel with:** Tasks 3.1, 3.3, 3.4

**Description:**

Implement `fetchTypedSupplierContext` in `src/lib/services/proposal-retrieval.ts`:

1. Build `orgFilter = eq(knowledgeEntries.organizationId, orgId)`.
2. Run four queries concurrently via `Promise.allSettled`:
   - `company_doc` query: `where(and(orgFilter, eq(knowledgeEntries.type, 'company_doc')))`
   - `certification` query: `where(and(orgFilter, eq(knowledgeEntries.type, 'certification')))`
   - `case_study` query: `where(and(orgFilter, eq(knowledgeEntries.type, 'case_study')))`
   - `past_rfp` won query: delegated to a private `buildWonPastRfpsQuery(orgId, industryTags)` helper
3. Implement `buildWonPastRfpsQuery`:
   - Always include `eq(knowledgeEntries.type, 'past_rfp')` and
     `sql\`${knowledgeEntries.metadata}->>'outcome' = 'won'\``
   - When `industryTags` is a non-empty array, add:
     `sql\`${knowledgeEntries.tags} ?| array[${sql.join(industryTags.map(t => sql\`${t}\`), sql\`, \`)}]\``
   - When `industryTags` is null/undefined/empty, no tag filter applied
4. For each settled result: `status === 'fulfilled'` → use value; `status === 'rejected'` → use `[]`.
5. Return `{ companyDocs, certifications, caseStudies, wonPastRfps }`.

Note: the `rfpType` and `openaiApiKey` parameters are accepted but unused. Mark `_rfpType`
and `_openaiApiKey` with leading underscore if the linter requires it, or use `void rfpType`.

**Acceptance Criteria:**
- [ ] All 8 tests in `describe('fetchTypedSupplierContext')` now PASS (GREEN)
- [ ] `pnpm tsc --noEmit` passes
- [ ] Tag filter SQL uses `?|` operator via `sql` template (no string concatenation)
- [ ] No `any` types introduced
- [ ] No `console.log` statements

---

### Task 3.3: Implement `fetchCustomerContext`

**Status:** 🔴 Blocked by Task 2.3
**Effort:** 0.75 h
**Dependencies:** Task 2.3
**Parallel with:** Tasks 3.1, 3.2, 3.4

**Description:**

Implement `fetchCustomerContext` in `src/lib/services/proposal-retrieval.ts`:

1. Query the `customers` table:
   ```typescript
   const [customer] = await db
     .select({ settings: customers.settings })
     .from(customers)
     .where(and(eq(customers.id, customerId), eq(customers.organizationId, orgId)))
     .limit(1)
   ```
2. Return `customer?.settings ?? null`.
   - If row found with non-null settings: returns the settings object.
   - If row found with null settings: `customer.settings` is `null`, returns `null`.
   - If no row found: `customer` is `undefined`, returns `null`.

**Acceptance Criteria:**
- [ ] All 4 tests in `describe('fetchCustomerContext')` now PASS (GREEN)
- [ ] `pnpm tsc --noEmit` passes
- [ ] Return type is `Promise<CustomerContext>` (which is `NonNullable<Customer['settings']> | null`)
- [ ] No `any` types introduced
- [ ] WHERE clause always includes both `customerId` and `orgId` — verified by test 4

---

### Task 3.4: Implement `fetchLearnings`

**Status:** 🔴 Blocked by Task 2.4
**Effort:** 0.75 h
**Dependencies:** Task 2.4
**Parallel with:** Tasks 3.1, 3.2, 3.3

**Description:**

Implement `fetchLearnings` in `src/lib/services/proposal-retrieval.ts`:

1. Determine customer filter:
   - `customerId` provided: `or(eq(learnings.customerId, customerId), isNull(learnings.customerId))`
   - `customerId` not provided: `isNull(learnings.customerId)`
2. Build base query:
   ```typescript
   db.select()
     .from(learnings)
     .where(and(eq(learnings.organizationId, orgId), customerFilter))
   ```
3. When `customerId` is provided, chain `.orderBy(sql\`CASE WHEN ${learnings.customerId} = ${customerId} THEN 0 ELSE 1 END ASC\`)`.
4. Return the query result (Drizzle always returns an array; empty array when no rows).

**Acceptance Criteria:**
- [ ] All 4 tests in `describe('fetchLearnings')` now PASS (GREEN)
- [ ] `pnpm tsc --noEmit` passes
- [ ] Ordering uses `CASE WHEN` SQL expression (not application-side sort)
- [ ] No `any` types introduced
- [ ] Tenant isolation enforced at query level — `organizationId` always in WHERE

---

### Phase 3 Gate: Confirm GREEN State

Run the full test suite and confirm all tests pass:

```bash
pnpm test tests/unit/services/proposal-retrieval.test.ts
```

**Expected:** All tests PASS. Zero failures.

---

## Phase 4: Quality Gates

All Phase 3 tasks must be complete before Phase 4 tasks begin. Tasks 4.1, 4.2, and 4.3 are
independent and can run in parallel.

---

### Task 4.1: Verify Test Coverage ≥ 80%

**Status:** 🔴 Blocked by Tasks 3.1, 3.2, 3.3, 3.4
**Effort:** 0.25 h
**Dependencies:** Tasks 3.1, 3.2, 3.3, 3.4
**Parallel with:** Tasks 4.2, 4.3

**Description:**

Run coverage for the new module:

```bash
pnpm test --coverage --reporter=verbose tests/unit/services/proposal-retrieval.test.ts
```

Inspect the coverage report for `src/lib/services/proposal-retrieval.ts`. All four functions
must individually exceed 80% line/branch coverage. If any function is below threshold, add
additional test cases targeting uncovered branches (e.g., a missing `else` arm, the cap-exceeded
path, or a settled-rejected code path).

**Acceptance Criteria:**
- [ ] `src/lib/services/proposal-retrieval.ts` coverage ≥ 80% (lines, branches, functions)
- [ ] No `istanbul ignore` directives added to game the threshold
- [ ] Any added tests are meaningful assertions (not empty stubs)

---

### Task 4.2: TypeScript Strict Mode Compliance

**Status:** 🔴 Blocked by Tasks 3.1, 3.2, 3.3, 3.4
**Effort:** 0.25 h
**Dependencies:** Tasks 3.1, 3.2, 3.3, 3.4
**Parallel with:** Tasks 4.1, 4.3

**Description:**

Run TypeScript compilation in strict mode:

```bash
pnpm tsc --noEmit
```

Review the output for any errors in `src/lib/services/proposal-retrieval.ts` or its test file.
Specific checks:

1. No `any` types — use `unknown` with type guards if needed, or derive types from Drizzle inference.
2. All four exported function signatures match the types in `contracts/proposal-retrieval-api.yaml`.
3. `CustomerContext` type resolves correctly to `NonNullable<Customer['settings']> | null`.
4. `KnowledgeEntryWithSimilarity` is re-exported (not redefined) from `vector-search.ts`.
5. `Learning` type is re-exported from the learnings schema (not redefined).

**Acceptance Criteria:**
- [ ] `pnpm tsc --noEmit` exits with code 0 (no errors)
- [ ] Zero `any` types in `src/lib/services/proposal-retrieval.ts`
- [ ] Zero `any` types in `tests/unit/services/proposal-retrieval.test.ts`

---

### Task 4.3: Security and Logging Audit (NFR-005 / OWASP)

**Status:** 🔴 Blocked by Tasks 3.1, 3.2, 3.3, 3.4
**Effort:** 0.25 h
**Dependencies:** Tasks 3.1, 3.2, 3.3, 3.4
**Parallel with:** Tasks 4.1, 4.2

**Description:**

Review `src/lib/services/proposal-retrieval.ts` against the security requirements in plan.md
and NFR-005:

**OWASP A01 — Broken Access Control:**
- [ ] Every DB query has `AND organization_id = $orgId` in its WHERE clause
- [ ] No query allows cross-tenant data access even if `orgId` is wrong
- [ ] Tenant isolation verified by dedicated tests (Tasks 2.3 test 4, 2.4 test 4)

**OWASP A03 — Injection:**
- [ ] All `industryTags` values are bound as Drizzle `sql` parameters (not string-concatenated)
- [ ] No raw string interpolation into SQL anywhere in the module
- [ ] `?|` operator uses `sql.join(...map(t => sql\`${t}\`))` pattern (parameterised)

**NFR-005 — No Sensitive Content in Logs:**
- [ ] No `console.log` anywhere in `src/lib/services/proposal-retrieval.ts`
- [ ] No customer settings values, learning content, or knowledge entry content emitted at any
  log level (only non-sensitive structural messages like "cap exceeded" at `console.debug`)

Run a quick grep to confirm:
```bash
grep -n "console.log" src/lib/services/proposal-retrieval.ts
```
Expected: no matches.

**Acceptance Criteria:**
- [ ] All OWASP checks pass
- [ ] Zero `console.log` in module file
- [ ] No sensitive payload content logged at any level

---

### Task 4.4: Contract Compliance Verification

**Status:** 🔴 Blocked by Tasks 4.1, 4.2, 4.3
**Effort:** 0.25 h
**Dependencies:** Tasks 4.1, 4.2, 4.3
**Parallel with:** Nothing (final verification before sign-off)

**Description:**

Verify all four exported function signatures in `src/lib/services/proposal-retrieval.ts` match
the contracts documented in `.specify/specs/007-requirement-driven-retrieval/contracts/proposal-retrieval-api.yaml`:

| Function | Expected Signature |
|----------|--------------------|
| `searchByRequirements` | `(fields: RequirementField[], orgId: string, openaiApiKey?: string): Promise<KnowledgeEntryWithSimilarity[]>` |
| `fetchTypedSupplierContext` | `(orgId: string, industryTags?: string[] \| null, rfpType?: string \| null, openaiApiKey?: string): Promise<TypedSupplierContext>` |
| `fetchCustomerContext` | `(customerId: string, orgId: string): Promise<CustomerContext>` |
| `fetchLearnings` | `(orgId: string, customerId?: string): Promise<Learning[]>` |

Also verify the following exports are present:
- `RequirementField` interface
- `TypedSupplierContext` interface
- `CustomerContext` type alias
- `KnowledgeEntryWithSimilarity` re-export
- `Learning` re-export

**Acceptance Criteria:**
- [ ] All four function signatures match contracts exactly (parameter names, types, optionality)
- [ ] All five type exports are present and correctly typed
- [ ] Module exports exactly four functions and the documented types — no extra public exports

---

### Task 4.5: Final Integration Smoke Check

**Status:** 🔴 Blocked by Task 4.4
**Effort:** 0.5 h
**Dependencies:** Task 4.4

**Description:**

Run the full project test suite (not just the new test file) to verify no regressions were
introduced:

```bash
pnpm test
```

Also run the TypeScript build one final time:

```bash
pnpm tsc --noEmit
```

If any pre-existing test failures exist that are unrelated to F7 (e.g., the CSS class assertion
failures in `ResponseCard` or upload integration test failures noted in MEMORY.md), confirm they
were pre-existing and document them. Do not attempt to fix pre-existing failures as part of F7.

**Acceptance Criteria:**
- [ ] `pnpm tsc --noEmit` passes (exit code 0)
- [ ] All F7 tests pass (zero failures in `proposal-retrieval.test.ts`)
- [ ] No new test failures introduced by F7 (pre-existing failures are unchanged)
- [ ] F7 deliverables checklist from `plan.md` is complete:
  - [ ] `src/lib/services/proposal-retrieval.ts` exists with four exported functions and types
  - [ ] `tests/unit/services/proposal-retrieval.test.ts` exists with full test suite
  - [ ] TypeScript strict mode passes
  - [ ] All unit tests pass
  - [ ] Coverage ≥ 80% for the module
  - [ ] No `any` types
  - [ ] No `console.log` in module or test file
  - [ ] All four function signatures match `contracts/proposal-retrieval-api.yaml`

---

## Parallelization Summary

```
Phase 1:   [1.1]
                 ↓ (all of Phase 2 unblocked)
Phase 2:   [2.1] [2.2] [2.3] [2.4]   ← parallel, independent
                 ↓      ↓      ↓      ↓ (each unblocks its own Phase 3 task)
Phase 3:   [3.1] [3.2] [3.3] [3.4]   ← parallel once respective test task done
                 ↓ (all of Phase 3 must complete)
Phase 4:   [4.1] [4.2] [4.3]         ← parallel, independent
                 ↓ (all Phase 4.1–4.3 must complete)
           [4.4]
                 ↓
           [4.5]
```

Maximum parallelism: 4 tasks simultaneously in Phase 2, 4 tasks simultaneously in Phase 3.

---

## User Story Coverage

| User Story | Tasks |
|------------|-------|
| US-001: Per-requirement retrieval | 2.1, 3.1 |
| US-002: Typed supplier context | 2.2, 3.2 |
| US-003: Customer context loading | 2.3, 3.3 |
| US-004: Learnings retrieval | 2.4, 3.4 |
| US-005: Graceful degradation | 2.1 (tests 7–8), 2.2 (test 8), 2.4 (test 3), 3.1–3.4 |

---

## Functional Requirement Coverage

| FR ID | Covered by Tasks |
|-------|-----------------|
| FR-001 | 1.1 (signature), 2.1, 3.1 |
| FR-002 | 2.1, 3.1 |
| FR-003 | 2.1 (test 4), 3.1 |
| FR-004 | 2.1 (test 5–6), 3.1 |
| FR-005 | 2.1, 3.1 |
| FR-006 | 2.2, 3.2 |
| FR-007 | 2.2 (test 2–4), 3.2 |
| FR-008 | 2.2 (test 6), 3.2 |
| FR-009 | 2.2 (test 7), 3.2 |
| FR-010 | 1.1 (type), 2.2, 3.2 |
| FR-011 | 2.3, 3.3 |
| FR-012 | 2.3 (test 4), 3.3 |
| FR-013 | 2.4, 3.4 |
| FR-014 | 2.4 (test 1), 3.4 |
| FR-015 | 2.4 (test 2), 3.4 |
| FR-016 | 1.1 (async stubs), 3.1–3.4 |
| FR-017 | 3.1–3.4 (read-only — no writes) |
| FR-018 | 1.1, 4.4 |
| FR-019 | 2.1 (tests 7–8), 3.1 |
| FR-020 | 1.1 (constant), 2.1 (test 4), 3.1 |

---

## Next Steps

After all 14 tasks are complete and Task 4.5 passes:

1. Feature F7 is ready for F8 to consume. Import the four functions and exported types from
   `@/lib/services/proposal-retrieval` in the F8 pipeline implementation.
2. Run `/speckit-implement` or begin F8 task breakdown with `/speckit-tasks` for
   `008-revised-proposal-pipeline`.
3. Commit with: `git commit -m "feat: add requirement-driven retrieval service (F7)"`
