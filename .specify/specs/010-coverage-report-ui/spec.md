# Feature 10: Coverage Report UI

## Overview

Display the coverage report inline on the proposal view page so preparers can see which RFP requirements are addressed and which have gaps. Includes a score badge, expandable requirement list, re-check button, and visual distinction for supplier-controlled template sections.

**Business Value:** Enables preparers to quickly identify and fix coverage gaps before submission, reducing back-and-forth review cycles.

## User Stories

### US1: Coverage Score Display

**As a** Proposal Preparer
**I want** to see the overall coverage score prominently on the proposal page
**So that** I can quickly assess submission readiness

**Acceptance Criteria:**
- [ ] Score displayed as a colored badge (green >=80, amber 60-79, red <60)
- [ ] Score shows as percentage (e.g., "75%")
- [ ] Badge appears alongside the proposal header in the Review step
- [ ] When no coverage report exists, show "Not evaluated" state

**Priority:** High

### US2: Requirements List with Evidence/Gaps

**As a** Proposal Preparer
**I want** to see each requirement with pass/fail status and expandable details
**So that** I can identify and address specific gaps

**Acceptance Criteria:**
- [ ] Each requirement shows: question text, addressed icon (check/x), expandable detail
- [ ] Addressed requirements show evidence quote when expanded
- [ ] Unaddressed requirements show gap description when expanded
- [ ] Requirements with `[PLACEHOLDER]` in evidence are client-side marked as gaps
- [ ] Template-sourced requirements (id starts with "template:") are visually labelled "Supplier Terms"

**Priority:** High

### US3: Re-check Coverage

**As a** Proposal Preparer
**I want** to trigger a coverage re-evaluation after editing the proposal
**So that** I can verify my edits fixed the flagged gaps

**Acceptance Criteria:**
- [ ] "Re-check Coverage" button visible in the coverage panel
- [ ] Button calls POST /api/rfps/[rfpId]/proposals/[draftId]/coverage
- [ ] Panel refreshes with new results after successful re-check
- [ ] Loading state shown during re-check
- [ ] Error toast shown if re-check fails
- [ ] Last-checked timestamp displayed and updated after re-check

**Priority:** High

## Functional Requirements

- **FR-001**: CoverageReport component receives `coverageReport`, `rfpId`, `draftId` as props
- **FR-002**: Score badge uses color bands: green (>=80), amber (60-79), red (<60)
- **FR-003**: Requirements list is collapsible (default expanded)
- **FR-004**: Each requirement row is expandable to show evidence or gap
- **FR-005**: Re-check button calls the coverage API endpoint and updates local state
- **FR-006**: Timestamp shows relative time (e.g., "5 minutes ago") or absolute if >24h
- **FR-007**: Component handles null/undefined coverageReport gracefully

## Non-Functional Requirements

- **NFR-001**: Component renders without layout shift (skeleton during loading)
- **NFR-002**: Accessible: proper ARIA labels, keyboard navigation for expandable items
- **NFR-003**: Responsive: works on mobile viewports

## Edge Cases

- **EC-001**: No coverage report (null) — show "Not yet evaluated" with Re-check button
- **EC-002**: Coverage report with 0 requirements — show score 0, "No requirements found"
- **EC-003**: All requirements addressed (score 100) — green badge, all checkmarks
- **EC-004**: Re-check fails — toast error, keep previous report displayed
- **EC-005**: Very long evidence/gap text — truncate with "show more" or scroll
