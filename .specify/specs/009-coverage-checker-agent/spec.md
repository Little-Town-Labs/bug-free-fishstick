# Feature 9: Coverage Checker Agent

## Overview

After a proposal is generated, users need to know which RFP requirements their proposal addresses and which have gaps. Feature 9 introduces a dedicated AI agent that evaluates the generated proposal markdown against the RFP's parsed requirements, producing a structured coverage report with per-requirement pass/fail status, evidence quotes, and gap descriptions. The agent also powers an on-demand re-evaluation endpoint so users can re-check coverage after manual edits.

**Business Value:** Eliminates manual requirement-by-requirement review, reduces submission risk by surfacing gaps before the proposal leaves the organization.

## User Stories

### US1: Automatic Coverage Evaluation During Generation

**As a** Proposal Preparer
**I want** the system to automatically evaluate requirement coverage when a proposal is generated
**So that** I immediately see which requirements are addressed and which have gaps

**Acceptance Criteria:**
- [ ] Step 9 of the pipeline calls the coverage checker agent instead of the stub
- [ ] The coverage report is stored in `proposal_drafts.coverageReport` alongside the draft
- [ ] The report includes an overall `coverageScore` (0–100)
- [ ] Each RFP requirement has `addressed`, `evidence`, and `gap` fields
- [ ] Templates with `evaluateCoverage: false` are excluded from scoring
- [ ] Templates with `evaluateCoverage: true` are included as addressed requirements
- [ ] If the coverage agent fails, the pipeline still completes with a fallback stub report

**Priority:** High

### US2: On-Demand Re-evaluation

**As a** Proposal Preparer
**I want** to trigger a coverage re-check after editing the proposal
**So that** I can verify my edits addressed the flagged gaps

**Acceptance Criteria:**
- [ ] A POST endpoint accepts `rfpId` and `draftId` and triggers coverage re-evaluation
- [ ] The endpoint reads the current `markdownContent` from the draft (not regenerates)
- [ ] The updated coverage report replaces the previous one in the database
- [ ] The response includes the new coverage report
- [ ] The endpoint is tenant-isolated (scoped by `organizationId`)
- [ ] Only authenticated users with access to the RFP can trigger re-evaluation

**Priority:** High

### US3: Coverage Score Calculation

**As a** Proposal Preparer
**I want** the coverage score to accurately reflect how many requirements are addressed
**So that** I can trust the metric as a submission-readiness indicator

**Acceptance Criteria:**
- [ ] Score = (addressed requirements / total evaluated requirements) * 100, rounded to nearest integer
- [ ] Requirements from templates with `evaluateCoverage: false` are excluded from the denominator
- [ ] A requirement is "addressed" if the proposal contains substantive content (not a placeholder)
- [ ] Requirements with `[PLACEHOLDER]` content are automatically marked as gaps
- [ ] Score of 0 means no requirements addressed; score of 100 means all addressed

**Priority:** Medium

## Functional Requirements

- **FR-001**: The coverage checker agent shall use `generateObject` (Vercel AI SDK) with a Zod-validated output schema
- **FR-002**: The agent shall receive as input: (a) the array of RFP requirements (id + question), (b) the full proposal markdown, (c) the list of template sections with their `evaluateCoverage` flags
- **FR-003**: For each requirement, the agent shall determine if it is addressed and provide either an evidence quote from the proposal or a gap description
- **FR-004**: The agent shall not modify the proposal content — it is read-only evaluation
- **FR-005**: The coverage score shall be computed in application code (not by the LLM) as `Math.round((addressedCount / evaluatedCount) * 100)`, with 0 when evaluatedCount is 0
- **FR-006**: Template sections with `evaluateCoverage: true` shall be treated as additional "requirements" — the agent checks if the template content appears in the proposal
- **FR-007**: The on-demand endpoint shall re-read the current draft markdown and re-run the agent
- **FR-008**: The pipeline step 9 shall gracefully degrade to a stub report if the agent call fails
- **FR-009**: The agent shall use the same tenant BYOK OpenAI key as the proposal writer

## Non-Functional Requirements

- **NFR-001**: Coverage evaluation shall complete within 30 seconds for proposals with up to 50 requirements
- **NFR-002**: The agent shall make exactly one LLM call per evaluation (no iterative calls)
- **NFR-003**: All database queries shall be scoped by `organizationId` for tenant isolation
- **NFR-004**: The endpoint shall require authentication and return 401/403 for unauthorized access

## Edge Cases

- **EC-001**: RFP has no parsed requirements (empty fields array) — return score 0, empty requirements array
- **EC-002**: Proposal markdown is empty or null — return score 0, all requirements marked as gaps
- **EC-003**: All templates have `evaluateCoverage: false` — only RFP requirements are evaluated
- **EC-004**: LLM returns malformed response — Zod validation rejects, falls back to stub
- **EC-005**: Draft not found or belongs to different org — return 404
- **EC-006**: RFP has requirements but proposal is all placeholders — score 0, all gaps
- **EC-007**: BYOK key is not configured — agent uses default provider key (existing pattern)

## Success Metrics

- Coverage reports generated for 100% of proposals without pipeline failures
- Re-evaluation endpoint responds within 30 seconds
- No cross-tenant data leakage in coverage reports
