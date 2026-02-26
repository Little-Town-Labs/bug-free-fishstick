# Tasks — Feature 9: Coverage Checker Agent

## Phase 1: Coverage Checker Agent

### Task 1.1: Coverage checker agent — Tests
**Status:** 🟡 Ready
**Effort:** 2 hours
**Dependencies:** None

**Description:** Write unit tests for `src/lib/ai/agents/proposal-coverage-checker.ts`.

**Acceptance Criteria:**
- [ ] Test: returns addressed=true with evidence for matched requirements
- [ ] Test: returns addressed=false with gap for unaddressed requirements
- [ ] Test: mixed proposal (some addressed, some gaps)
- [ ] Test: empty requirements array returns score 0
- [ ] Test: empty/null proposal markdown returns all gaps, score 0
- [ ] Test: evaluateCoverage templates included as additional requirements
- [ ] Test: score computed as Math.round((addressed/total)*100)
- [ ] Test: score is 0 when total evaluated is 0
- [ ] Test: LLM failure throws (caller handles graceful degradation)
- [ ] Tests confirmed to FAIL

### Task 1.2: Coverage checker agent — Implementation
**Status:** 🔴 Blocked by 1.1
**Effort:** 2 hours
**Dependencies:** Task 1.1

**Description:** Implement `checkCoverage()` in `src/lib/ai/agents/proposal-coverage-checker.ts`.

**Acceptance Criteria:**
- [ ] Uses `generateObject` with Zod schema
- [ ] Uses `getLanguageModelForOrg` for model selection
- [ ] Score computed in app code (not by LLM)
- [ ] All tests from 1.1 pass

## Phase 2: Pipeline Integration

### Task 2.1: Pipeline integration — Tests
**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2

**Description:** Update integration tests in `generate-proposal.test.ts` to verify step 9 calls `checkCoverage` instead of stub.

**Acceptance Criteria:**
- [ ] Test: step 9 calls checkCoverage with correct args
- [ ] Test: pipeline gracefully degrades if checkCoverage throws
- [ ] Test: evaluateCoverage templates passed to checkCoverage
- [ ] Tests confirmed to FAIL

### Task 2.2: Pipeline integration — Implementation
**Status:** 🔴 Blocked by 2.1
**Effort:** 1 hour
**Dependencies:** Task 2.1

**Description:** Replace stub in `generate-proposal.ts` step 9 with real `checkCoverage` call.

**Acceptance Criteria:**
- [ ] `generateCoverageReportStub` removed
- [ ] `checkCoverage` imported and called in step 9
- [ ] Try-catch wraps agent call with fallback to stub-like report
- [ ] evaluateCoverage templates from steps 5+6 passed through
- [ ] All tests from 2.1 pass

## Phase 3: On-Demand API Endpoint

### Task 3.1: Coverage API endpoint — Tests
**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2
**Parallel with:** Task 2.1

**Description:** Write integration tests for `POST /api/rfps/[rfpId]/proposals/[draftId]/coverage`.

**Acceptance Criteria:**
- [ ] Test: returns coverage report on success
- [ ] Test: returns 404 when draft not found
- [ ] Test: returns 404 when draft belongs to different org
- [ ] Test: returns 401/403 when unauthenticated
- [ ] Test: saves updated coverage report to database
- [ ] Tests confirmed to FAIL

### Task 3.2: Coverage API endpoint — Implementation
**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5 hours
**Dependencies:** Task 3.1

**Description:** Implement `POST /api/rfps/[rfpId]/proposals/[draftId]/coverage/route.ts`.

**Acceptance Criteria:**
- [ ] Auth check (requireAuth)
- [ ] Reads draft + RFP from DB (tenant-scoped)
- [ ] Calls checkCoverage
- [ ] Saves coverage report to draft
- [ ] Returns coverage report in response
- [ ] All tests from 3.1 pass

## Critical Path

Task 1.1 → 1.2 → 2.1 → 2.2 (pipeline integration)
Task 1.1 → 1.2 → 3.1 → 3.2 (API endpoint, parallel with phase 2)

**Total Effort:** ~8.5 hours
