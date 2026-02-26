# Implementation Plan — Feature 9: Coverage Checker Agent

## Executive Summary

Implement a coverage checker AI agent using `generateObject` that evaluates proposal markdown against RFP requirements, producing a structured coverage report. Wire it into pipeline step 9 (replacing the stub) and expose an on-demand re-evaluation API endpoint.

## Architecture Overview

```
Pipeline Step 9 ──► checkCoverage() ──► generateObject() ──► CoverageReport
                         │                                        │
                         └── computeScore() (app code) ───────────┘

POST /api/.../coverage ──► read draft ──► checkCoverage() ──► save report
```

## Implementation Phases

### Phase 1: Coverage Checker Agent (Core)
- Create `src/lib/ai/agents/proposal-coverage-checker.ts`
- Zod schema for LLM output (per-requirement addressed/evidence/gap)
- System prompt: evaluate each requirement against proposal sections
- `checkCoverage()` function: calls `generateObject`, computes score in app code
- Handle edge cases: empty requirements, empty proposal, LLM failure

### Phase 2: Pipeline Integration
- Remove `generateCoverageReportStub` from `generate-proposal.ts`
- Import and call `checkCoverage` in step 9
- Pass evaluateCoverage templates from steps 5+6
- Wrap in try-catch for graceful degradation (fallback to stub-like report)

### Phase 3: On-Demand API Endpoint
- Create `src/app/api/rfps/[rfpId]/proposals/[draftId]/coverage/route.ts`
- POST handler: auth check, read draft + RFP, call checkCoverage, save report
- Tenant isolation via organizationId scoping

### Phase 4: Tests
- Unit tests for coverage agent (mocked LLM)
- Unit tests for score computation edge cases
- Integration test for pipeline step 9 (verify stub replaced)
- Integration test for API endpoint

## Security Considerations
- Tenant isolation on all DB queries (organizationId)
- Auth required on API endpoint
- No proposal content leaked across tenants
- BYOK key handled via `getLanguageModelForOrg`

## Constitutional Compliance
- [x] Test-first imperative followed (tests in each phase)
- [x] Simplicity enforced (single agent, single LLM call)
- [x] Security standards met (tenant isolation, auth)
- [x] Performance requirements addressed (single LLM call, <30s)
