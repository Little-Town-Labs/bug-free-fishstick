# Task Breakdown — Data Model Foundation

**Feature**: `001-data-model-foundation`
**Branch**: `001-data-model-foundation`
**Generated**: 2026-02-25
**Plan Source**: `plan.md`

---

## Status Legend

- 🟢 Ready (no blockers)
- 🔴 Blocked (dependencies not met)
- 🟡 In Progress
- ✅ Complete

---

## Implementation State at Task Generation

Phases 1–3 are **already complete** — all code artifacts were written by specialist agents during the `/speckit-plan` phase:

| Artifact | File | State |
|----------|------|-------|
| Schema: tenant-settings | `src/lib/db/schema/tenant-settings.ts` | ✅ |
| Schema: proposal-templates | `src/lib/db/schema/proposal-templates.ts` | ✅ |
| Schema: proposal-drafts | `src/lib/db/schema/proposal-drafts.ts` | ✅ |
| Schema index export | `src/lib/db/schema/index.ts` | ✅ |
| Migration SQL | `drizzle/0008_proposal_bid_engine.sql` | ✅ |
| Zod schemas | `src/lib/utils/validation.ts` | ✅ |
| API contract | `contracts/settings-api.yaml` | ✅ |

Remaining work: **verification, tests, and quality gates.**

---

## Phase 1: Verification (Pre-Test Gate)

Tasks that confirm the existing artifacts are correct before writing tests against them.

---

### Task 1.1: TypeScript Type Check
**Status**: 🟢 Ready
**Effort**: 0.25h
**Dependencies**: None
**Parallel with**: —

**Description**:
Run `tsc --noEmit` to confirm all new TypeScript types, interfaces, and schema definitions compile cleanly in strict mode with zero errors. This is a prerequisite for writing meaningful tests.

**Acceptance Criteria**:
- [ ] `npx tsc --noEmit` exits with code 0
- [ ] No `any` type usage in new schema files
- [ ] No implicit `any` warnings in new Zod schema exports
- [ ] `RateCard`, `ProposalDefaults`, `CoverageReport`, `CoverageRequirement`, `ProposalTemplate`, `NewProposalTemplate` are all importable from `@/lib/db/schema`

**Command**:
```bash
npx tsc --noEmit
```

---

### Task 1.2: Apply Database Migration (Dev Environment)
**Status**: 🟢 Ready
**Effort**: 0.25h
**Dependencies**: None
**Parallel with**: Task 1.1

**Description**:
Apply `drizzle/0008_proposal_bid_engine.sql` to the local development database to confirm the migration runs cleanly without errors. Verify all new columns and tables exist after migration.

**Acceptance Criteria**:
- [ ] Migration runs without SQL errors
- [ ] `tenant_settings` table has columns `rate_card`, `proposal_defaults`, `company_profile`
- [ ] `proposal_templates` table exists with 7 non-system columns and 3 indexes
- [ ] `proposal_drafts` table has column `coverage_report`
- [ ] All pre-existing rows in `tenant_settings`, `proposal_drafts` have NULL in new nullable columns (no corruption)
- [ ] Row counts in existing tables are unchanged before and after migration

**Command**:
```bash
npx drizzle-kit migrate
# or: npx drizzle-kit push (if using push workflow)
```

---

## Phase 2: Zod Schema Unit Tests

Write unit tests for all 8 new Zod validation schemas. These tests validate the data-layer contract — what inputs are accepted and rejected — before any API routes are built.

**Test file**: `src/lib/utils/validation.test.ts`

---

### Task 2.1: Zod Tests — RateCard Schemas (US1)
**Status**: 🔴 Blocked by Task 1.1
**Effort**: 1.5h
**Dependencies**: Task 1.1
**Parallel with**: Task 2.3 (after 1.1 passes)
**Maps to**: User Story 1 (Rate card persists)

**Description**:
Write Vitest unit tests for `rateCardRoleSchema`, `rateCardDiscountSchema`, and `rateCardSchema`. Each test must confirm a specific validation rule. Tests must FAIL initially if schemas have bugs; they confirm correctness of existing schemas.

**Test Cases to Cover**:

_rateCardRoleSchema_:
- [ ] Accepts valid role with unit=`hour`
- [ ] Accepts valid role with unit=`day`
- [ ] Accepts valid role with unit=`fixed`
- [ ] Rejects negative rate
- [ ] Rejects rate=0 (zero rate is not valid — must be positive)
- [ ] Rejects empty name
- [ ] Rejects unknown unit value
- [ ] Rejects extra keys (strict mode)

_rateCardDiscountSchema_:
- [ ] Accepts type=`percentage` with appliesTo=`subtotal`
- [ ] Accepts type=`fixed` with appliesTo=`total`
- [ ] Accepts null customerIds (all-customer discount)
- [ ] Accepts non-null customerIds array
- [ ] Rejects negative value
- [ ] Rejects unknown `type` value
- [ ] Rejects unknown `appliesTo` value

_rateCardSchema_:
- [ ] Accepts valid by_role config with two roles and a discount
- [ ] Accepts valid blended config (blendedRate set, roles empty)
- [ ] Rejects mode=`blended` with null blendedRate (blendedRate is required when mode=blended)
- [ ] Rejects mode=`by_role` with empty roles array (at least one role required)
- [ ] Rejects negative defaultMarginPct
- [ ] Rejects defaultMarginPct > 1
- [ ] Rejects currency length != 3
- [ ] Rejects extra keys (strict mode)
- [ ] Rejects unknown mode value

**Acceptance Criteria**:
- [ ] All tests written
- [ ] All tests pass (green)
- [ ] No `any` types in test file

---

### Task 2.2: Zod Tests — ProposalDefaults Schema
**Status**: 🔴 Blocked by Task 1.1
**Effort**: 0.5h
**Dependencies**: Task 1.1
**Parallel with**: Task 2.1, 2.3, 2.4

**Description**:
Write Vitest unit tests for `proposalDefaultsSchema`.

**Test Cases to Cover**:
- [ ] Accepts pricing model `time_and_materials`
- [ ] Accepts pricing model `fixed_price`
- [ ] Accepts pricing model `cost_plus`
- [ ] Accepts paymentTermsDays=0 (immediate payment is valid)
- [ ] Accepts warrantyPeriodDays=0
- [ ] Rejects negative paymentTermsDays
- [ ] Rejects float paymentTermsDays (must be integer)
- [ ] Rejects unknown pricing model value
- [ ] Rejects extra keys (strict mode)

**Acceptance Criteria**:
- [ ] All tests written and passing
- [ ] Edge case paymentTermsDays=0 explicitly tested

---

### Task 2.3: Zod Tests — CoverageReport Schemas (US4)
**Status**: 🔴 Blocked by Task 1.1
**Effort**: 1h
**Dependencies**: Task 1.1
**Parallel with**: Task 2.1, 2.2, 2.4
**Maps to**: User Story 4 (Coverage report persists)

**Description**:
Write Vitest unit tests for `coverageRequirementSchema` and `coverageReportSchema`.

**Test Cases to Cover**:

_coverageRequirementSchema_:
- [ ] Accepts addressed=true with evidence, gap=null
- [ ] Accepts addressed=false with gap, evidence=null
- [ ] Accepts both evidence and gap as null
- [ ] Rejects empty requirementId
- [ ] Rejects empty question
- [ ] Rejects extra keys (strict mode)

_coverageReportSchema_:
- [ ] Accepts score=0 (lower bound)
- [ ] Accepts score=1 (upper bound)
- [ ] Accepts score=0.85 (typical value)
- [ ] Rejects score < 0
- [ ] Rejects score > 1
- [ ] Accepts valid ISO 8601 datetime string for evaluatedAt
- [ ] Rejects non-datetime string for evaluatedAt
- [ ] Accepts empty requirements array (edge case: RFP with no parsed fields)
- [ ] Accepts requirements array with two entries
- [ ] Rejects extra keys (strict mode)

**Acceptance Criteria**:
- [ ] All tests written and passing
- [ ] Both boundary values (0 and 1) explicitly tested for coverageScore

---

### Task 2.4: Zod Tests — ProposalTemplate Schemas (US2)
**Status**: 🔴 Blocked by Task 1.1
**Effort**: 1h
**Dependencies**: Task 1.1
**Parallel with**: Task 2.1, 2.2, 2.3
**Maps to**: User Story 2 (Template library persists)

**Description**:
Write Vitest unit tests for `createProposalTemplateSchema` and `updateProposalTemplateSchema`.

**Test Cases to Cover**:

_createProposalTemplateSchema_:
- [ ] Accepts all 8 valid section values individually
- [ ] Rejects unknown section value
- [ ] Accepts isRequired=true with evaluateCoverage=false
- [ ] Accepts isRequired=false with evaluateCoverage=true
- [ ] Accepts null triggerRfpTypes
- [ ] Accepts null triggerIndustryTags
- [ ] Accepts string array for triggerRfpTypes
- [ ] Accepts string array for triggerIndustryTags
- [ ] Rejects empty title
- [ ] Rejects title exceeding 255 chars
- [ ] Rejects empty content
- [ ] Accepts sortOrder=0 (default)
- [ ] Rejects negative sortOrder (nonnegative constraint)

_updateProposalTemplateSchema_:
- [ ] Accepts empty object (all fields optional via `.partial()`)
- [ ] Accepts partial update with only `title`
- [ ] Accepts partial update with only `content`
- [ ] Applies same validations as create for fields that are provided
- [ ] Rejects unknown section on partial update

**Acceptance Criteria**:
- [ ] All 8 section values tested individually
- [ ] `.partial()` behavior explicitly verified
- [ ] All tests passing

---

## Phase 3: Schema Structure Tests

Verify the Drizzle schema files define the correct tables, columns, and metadata. These are fast unit tests with no database connection required (following the pattern in `customers.test.ts`).

---

### Task 3.1: Schema Tests — tenant-settings New Columns (US1, US3)
**Status**: 🔴 Blocked by Task 1.2
**Effort**: 0.5h
**Dependencies**: Task 1.2
**Parallel with**: Task 3.2, 3.3
**Maps to**: User Story 1 (rate card), User Story 3 (company profile)
**Test file**: `src/lib/db/schema/tenant-settings.test.ts` (extend existing if present, else create)

**Description**:
Write Vitest unit tests confirming the three new columns are present in the `tenantSettings` Drizzle table object. No database connection needed.

**Test Cases to Cover**:
- [ ] `tenantSettings` table object contains column `rateCard`
- [ ] `tenantSettings` table object contains column `proposalDefaults`
- [ ] `tenantSettings` table object contains column `companyProfile`
- [ ] `RateCard` interface is importable from `@/lib/db/schema`
- [ ] `ProposalDefaults` interface is importable from `@/lib/db/schema`

**Acceptance Criteria**:
- [ ] All assertions pass without a live DB connection
- [ ] Follows pattern from `customers.test.ts`

---

### Task 3.2: Schema Tests — proposal-templates Table (US2)
**Status**: 🔴 Blocked by Task 1.2
**Effort**: 0.75h
**Dependencies**: Task 1.2
**Parallel with**: Task 3.1, 3.3
**Maps to**: User Story 2 (Template library persists)
**Test file**: `src/lib/db/schema/proposal-templates.test.ts`

**Description**:
Write Vitest unit tests for the `proposalTemplates` Drizzle table definition.

**Test Cases to Cover**:
- [ ] Table name is `proposal_templates`
- [ ] Table contains columns: `id`, `organizationId`, `section`, `title`, `content`, `isRequired`, `triggerRfpTypes`, `triggerIndustryTags`, `evaluateCoverage`, `sortOrder`, `createdBy`, `createdAt`, `updatedAt`
- [ ] `ProposalTemplate` type is importable from `@/lib/db/schema`
- [ ] `NewProposalTemplate` type is importable from `@/lib/db/schema`
- [ ] `proposalTemplateSections` const array contains all 8 expected values
- [ ] `ProposalTemplateSection` type is importable

**Acceptance Criteria**:
- [ ] All 8 section values verified in `proposalTemplateSections`
- [ ] All 13 columns verified
- [ ] No DB connection needed

---

### Task 3.3: Schema Tests — proposal-drafts Coverage Column (US4)
**Status**: 🔴 Blocked by Task 1.2
**Effort**: 0.5h
**Dependencies**: Task 1.2
**Parallel with**: Task 3.1, 3.2
**Maps to**: User Story 4 (Coverage report persists)
**Test file**: `src/lib/db/schema/proposal-drafts.test.ts` (create new)

**Description**:
Write Vitest unit tests for the `proposalDrafts` table confirming the new `coverageReport` column and associated types.

**Test Cases to Cover**:
- [ ] `proposalDrafts` table contains column `coverageReport`
- [ ] `CoverageReport` interface is importable from `@/lib/db/schema`
- [ ] `CoverageRequirement` interface is importable from `@/lib/db/schema`
- [ ] Table still contains all original columns (regression: id, rfpId, organizationId, status, etc.)

**Acceptance Criteria**:
- [ ] Regression check confirms no existing columns were removed
- [ ] New column and types verified

---

## Phase 4: Integration Tests

Round-trip database tests verifying all acceptance scenarios from `spec.md`. These tests require a real PostgreSQL connection. Use a dedicated test database and clean up after each test.

**Test file**: `src/lib/db/__tests__/bid-engine-data-model.integration.test.ts`

**Note**: Integration tests may be skipped in CI if no test DB is configured. Add `@integration` tag and conditional skip logic.

---

### Task 4.0: Configure Test Database Environment
**Status**: 🟢 Ready
**Effort**: 0.5h
**Dependencies**: None
**Parallel with**: Phase 2 and Phase 3 tasks

**Description**:
Integration tests require a live PostgreSQL connection. Set up a test database environment so Phase 4 tasks can run. Options in preference order:

1. **Neon branch** (recommended): Create a separate branch of the production Neon database for testing via the Neon console. Set `TEST_DATABASE_URL` to the branch connection string.
2. **Local PostgreSQL**: Run `docker run -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:15` and set `TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/rfp_test`.

Add a skip guard to the integration test file so tests are silently skipped in environments without `TEST_DATABASE_URL`:
```typescript
const TEST_DB_URL = process.env.TEST_DATABASE_URL
if (!TEST_DB_URL) {
  describe.skip('bid-engine integration (no TEST_DATABASE_URL)', () => {})
} else {
  // actual tests
}
```

Apply the migration to the test database before running:
```bash
TEST_DATABASE_URL=<url> npx drizzle-kit migrate
```

**Acceptance Criteria**:
- [ ] `TEST_DATABASE_URL` environment variable documented in `.env.example`
- [ ] Skip guard implemented in integration test file
- [ ] Migration successfully applied to test database
- [ ] `npx vitest run src/lib/db/__tests__/` exits with 0 (either passes or skips cleanly)

---

### Task 4.1: Integration Tests — Rate Card Round-Trip (US1)
**Status**: 🔴 Blocked by Tasks 3.1, 2.1
**Effort**: 2h
**Dependencies**: Task 3.1 (schema verified), Task 2.1 (Zod schemas verified)
**Parallel with**: Task 4.2
**Maps to**: User Story 1 — Acceptance Scenarios 1–4

**Description**:
Write integration tests for rate card persistence. Each test writes to the DB and reads back, asserting exact fidelity.

**Test Cases to Cover** (from spec.md AS1–AS4):
- [ ] **AS1.1**: New org returns null rate card without error
- [ ] **AS1.2**: by_role mode with two roles + discount rule → saved and retrieved with all fields intact
- [ ] **AS1.3**: Blended mode with blendedRate=$150 → saved and retrieved with mode and blendedRate correct
- [ ] **AS1.4**: Org isolation — Org A's rate card not readable by Org B's identifier (returns null)
- [ ] Rate card replacement — saving a second rate card fully overwrites the first

**Setup/Teardown**:
- Use unique org IDs per test (UUIDs) to avoid cross-test contamination
- Clean up test rows in `afterEach` or `afterAll`

**Acceptance Criteria**:
- [ ] All 5 test cases pass
- [ ] Org isolation is a hard assertion (not just "different value", but specifically null/empty)

---

### Task 4.2: Integration Tests — Company Profile Round-Trip (US3)
**Status**: 🔴 Blocked by Tasks 3.1, 2.1
**Effort**: 1h
**Dependencies**: Task 3.1
**Parallel with**: Task 4.1
**Maps to**: User Story 3 — Acceptance Scenarios 1–3

**Description**:
Write integration tests for company profile persistence.

**Test Cases to Cover** (from spec.md US3 AS1–AS3):
- [ ] **US3.AS1**: New org returns null profile without error
- [ ] **US3.AS2**: Markdown content (headers, bullets, bold) saved and retrieved byte-for-byte identical
- [ ] **US3.AS3**: Org isolation — Org A's profile not readable by Org B
- [ ] Unicode round-trip: 10,000-char string with accented characters, em-dashes, smart quotes — byte-for-byte fidelity
- [ ] Large content: 50,000-char string stored without truncation

**Acceptance Criteria**:
- [ ] Unicode test uses a real 10,000-char multi-byte string, not ASCII
- [ ] Large content test confirms no truncation at 50,000 chars

---

### Task 4.3: Integration Tests — Proposal Templates CRUD and Filters (US2)
**Status**: 🔴 Blocked by Tasks 3.2, 2.4
**Effort**: 2.5h
**Dependencies**: Task 3.2, Task 2.4
**Parallel with**: Task 4.4
**Maps to**: User Story 2 — Acceptance Scenarios 1–6

**Description**:
Write integration tests for the full lifecycle and filter behavior of proposal templates.

**Test Cases to Cover** (from spec.md US2 AS1–AS6):
- [ ] **US2.AS1**: Create template with all fields; retrieve exact content fidelity (character-for-character)
- [ ] **US2.AS2**: Two templates with sortOrder 1 and 2 — retrieved in sortOrder ascending
- [ ] **US2.AS3**: Template with triggerRfpTypes=['technical','compliance'] — appears in filter for rfpType='technical'
- [ ] **US2.AS4**: Template with triggerRfpTypes=['technical'] — NOT in results when filtering for rfpType='commercial'
- [ ] **US2.AS5**: Template with isRequired=true → evaluateCoverage stored as false (enforcement test)
- [ ] **US2.AS6**: Org isolation — Org B receives only its own templates
- [ ] Sort order gaps: templates with sortOrders 1, 3, 5 returned in correct relative order
- [ ] Null trigger arrays: template with null triggers matches universal filter
- [ ] isRequired=true filter returns only required templates

**Acceptance Criteria**:
- [ ] US2.AS5 (evaluateCoverage enforcement) is explicitly tested at DB write level
- [ ] Filter tests use non-trivial data sets (at least 3 templates per org)
- [ ] Sort gap test explicitly uses non-sequential sort orders

---

### Task 4.4: Integration Tests — Coverage Report Round-Trip (US4)
**Status**: 🔴 Blocked by Tasks 3.3, 2.3
**Effort**: 1.5h
**Dependencies**: Task 3.3, Task 2.3
**Parallel with**: Task 4.3
**Maps to**: User Story 4 — Acceptance Scenarios 1–4

**Description**:
Write integration tests for coverage report persistence on proposal drafts.

**Test Cases to Cover** (from spec.md US4 AS1–AS4):
- [ ] **US4.AS1**: Draft with no coverage report — coverageReport is null, no error
- [ ] **US4.AS2**: Write full coverage report (score=0.85, timestamp, 3 requirements including addressed+evidence and gap) → read back exact fidelity for all nested fields
- [ ] **US4.AS3**: Write new report to draft that already has one → new report fully replaces previous (old fields gone)
- [ ] **US4.AS4**: Isolation — writing report to Draft A does not affect Draft B's coverageReport
- [ ] Edge: empty requirements array — stored and retrieved as `[]` not null
- [ ] Edge: coverageScore at boundary values 0 and 1 — stored correctly

**Setup**:
- Requires an existing `rfp` row and a `proposal_draft` row (need `rfpId` foreign key)
- Helper: create minimal RFP + draft in `beforeEach`

**Acceptance Criteria**:
- [ ] Nested `requirements[]` contents verified field-by-field, not just array length
- [ ] Replacement test explicitly asserts old fields are absent in replacement

---

## Phase 5: Quality Gates

---

### Task 5.1: Full Test Suite Run with Coverage
**Status**: 🔴 Blocked by Tasks 2.1–2.4, 3.1–3.3
**Effort**: 0.25h
**Dependencies**: All Phase 2 and Phase 3 tasks
**Parallel with**: Task 5.2 (after Phase 2+3 complete)

**Description**:
Run the full Vitest suite and confirm coverage thresholds pass for the new files.

**Commands**:
```bash
npx vitest run --coverage
```

**Acceptance Criteria**:
- [ ] All unit tests pass (zero failures)
- [ ] Coverage for `src/lib/utils/validation.ts` ≥ 80%
- [ ] Coverage for `src/lib/db/schema/tenant-settings.ts` ≥ 80%
- [ ] Coverage for `src/lib/db/schema/proposal-templates.ts` ≥ 80%
- [ ] Coverage for `src/lib/db/schema/proposal-drafts.ts` ≥ 80%
- [ ] Global coverage thresholds from `vitest.config.ts` still satisfied

---

### Task 5.2: Code Review
**Status**: 🔴 Blocked by Phase 2 + Phase 3 tasks
**Effort**: 0.5h
**Dependencies**: Tasks 2.1–2.4, 3.1–3.3
**Parallel with**: Task 5.1

**Description**:
Run `/code-review` on all modified and new files. Address any CRITICAL or HIGH issues before the feature is considered done.

**Files to Review**:
- `src/lib/db/schema/tenant-settings.ts`
- `src/lib/db/schema/proposal-templates.ts`
- `src/lib/db/schema/proposal-drafts.ts`
- `src/lib/utils/validation.ts`
- `drizzle/0008_proposal_bid_engine.sql`

**Acceptance Criteria**:
- [ ] No CRITICAL issues open
- [ ] No HIGH issues open
- [ ] MEDIUM issues documented (may be deferred if low risk)

---

### Task 5.3: Security Review — Org Isolation Verification
**Status**: 🔴 Blocked by Task 4.1, 4.2, 4.3, 4.4
**Effort**: 0.5h
**Dependencies**: All Phase 4 integration tests
**Parallel with**: —

**Description**:
Verify that the org isolation assertions in integration tests are sufficient. Run `/security-review` focused on the data access pattern: every DB query for new entities must include an `organizationId` WHERE clause.

**Acceptance Criteria**:
- [ ] Every integration test that reads data from a new entity asserts org isolation
- [ ] No query in any new service function omits the `organizationId` filter
- [ ] Security review returns no CRITICAL or HIGH findings

---

### Task 5.4: Integration Test Run (with Test DB)
**Status**: 🔴 Blocked by Tasks 4.1–4.4, 5.3
**Effort**: 0.5h
**Dependencies**: All Phase 4 tasks, Task 5.3

**Description**:
Run the full integration test suite against the development database. Confirm all round-trip tests pass.

**Commands**:
```bash
TEST_DB_URL=<test-db-url> npx vitest run --reporter=verbose src/lib/db/__tests__/
```

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] No test data left in DB after run (cleanup verified)
- [ ] Test execution time < 30 seconds

---

### Task 5.5: Feature Commit
**Status**: 🔴 Blocked by Tasks 5.1, 5.2, 5.3, 5.4
**Effort**: 0.25h
**Dependencies**: All quality gate tasks

**Description**:
Stage all feature files and create a conventional commit.

**Files to Stage**:
```bash
src/lib/db/schema/tenant-settings.ts
src/lib/db/schema/proposal-templates.ts
src/lib/db/schema/proposal-drafts.ts
src/lib/db/schema/index.ts
src/lib/utils/validation.ts
drizzle/0008_proposal_bid_engine.sql
src/lib/db/schema/tenant-settings.test.ts
src/lib/db/schema/proposal-templates.test.ts
src/lib/db/schema/proposal-drafts.test.ts
src/lib/utils/validation.test.ts
src/lib/db/__tests__/bid-engine-data-model.integration.test.ts
.specify/specs/001-data-model-foundation/
```

**Commit Message**:
```
feat: add data model foundation for structured proposal bid engine

- Add RateCard, ProposalDefaults JSONB columns to tenant_settings
- Add company_profile text column to tenant_settings
- Create proposal_templates table with section/trigger/sort support
- Add coverage_report JSONB column to proposal_drafts
- Add Zod validation schemas for all new structured types
- Add migration 0008_proposal_bid_engine.sql (additive, safe)
- Add unit and integration tests for all new entities
```

**Acceptance Criteria**:
- [ ] Commit created on `001-data-model-foundation` branch
- [ ] No unintended files staged (no `.env`, no generated files)
- [ ] Commit message follows Conventional Commits format

---

## Task Summary

| Phase | Tasks | Effort | Parallelizable |
|-------|-------|--------|----------------|
| 1: Verification | 2 | 0.5h | Yes (1.1 ∥ 1.2) |
| 2: Zod Unit Tests | 4 | 4h | Yes (2.1 ∥ 2.2 ∥ 2.3 ∥ 2.4) |
| 3: Schema Tests | 3 | 1.75h | Yes (3.1 ∥ 3.2 ∥ 3.3) |
| 4: Integration Tests | 4 | 7h | Yes (4.1 ∥ 4.2, 4.3 ∥ 4.4) |
| 5: Quality Gates | 5 | 2h | Partial |
| **Total** | **18** | **~15.25h** | |

---

## Dependency Graph

```
Task 1.1 (tsc) ──────► Tasks 2.1, 2.2, 2.3, 2.4 (Zod tests, parallel)
Task 1.2 (migrate) ──► Tasks 3.1, 3.2, 3.3 (schema tests, parallel)

Task 2.1 + 3.1 ──► Task 4.1 (rate card integration)
Task 3.1 ─────────► Task 4.2 (company profile integration)
Task 2.4 + 3.2 ──► Task 4.3 (template integration)
Task 2.3 + 3.3 ──► Task 4.4 (coverage integration)

Tasks 2.1–2.4 + 3.1–3.3 ─► Task 5.1 (coverage check)
Tasks 2.1–2.4 + 3.1–3.3 ─► Task 5.2 (code review)
Tasks 4.1–4.4 ────────────► Task 5.3 (security review)
Tasks 4.1–4.4 + 5.3 ──────► Task 5.4 (integration run)
Tasks 5.1 + 5.2 + 5.4 ────► Task 5.5 (commit)
```

---

## Critical Path

```
1.1 → 2.1 → 4.1 → 5.3 → 5.4 → 5.5
```

Estimated critical path duration: **~9h** (with parallel execution of independent tasks)

---

## User Story Coverage

| User Story | Tasks Covering |
|-----------|----------------|
| US1: Rate Card Persists (P1) | 2.1, 3.1, 4.1 |
| US2: Template Library Persists (P1) | 2.4, 3.2, 4.3 |
| US3: Company Profile Persists (P2) | 3.1, 4.2 |
| US4: Coverage Report Persists (P1) | 2.3, 3.3, 4.4 |
| All Stories | 1.1, 1.2, 5.1, 5.2, 5.3, 5.4, 5.5 |

---

## Notes for Implementation

1. **No new code needed** for Phases 1–3 artifacts — all schema, migration, and Zod files are already written. Tasks in Phases 2 and 3 are purely test-writing.

2. **Integration test DB**: The Vitest config uses `jsdom` environment. Integration tests will need either:
   - A separate Vitest project config with `environment: 'node'`, or
   - Conditional skip logic with `process.env.TEST_DB_URL` guard

3. **Delegate to `tdd-guide` agent** for Phases 2–4 if you want test scaffolding generated automatically.

4. **After this feature**: Proceed to Feature F2 (Rate Card UI) — it depends on the API contract defined in `contracts/settings-api.yaml` and the Zod schemas from `validation.ts`.
