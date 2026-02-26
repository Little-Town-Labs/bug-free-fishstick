# Feature Specification: Proposal Template Library

**Feature:** `004-proposal-template-library`
**PRD Source:** §5 US2, §5 US7, §6.2
**Created:** 2026-02-26
**Status:** Draft
**Priority:** P1 — High
**Phase:** 2 (Commercial Engine)
**Depends on:** Feature 1 (data model — `proposal_templates` table)
**Blocks:** Feature 8 (pipeline fetches templates for injection)

---

## Overview

Supplier Admins need a library of standard contract clauses and boilerplate text that can be automatically appended to every proposal. This library is critical to commercial protection: standard assumptions, exclusions, payment terms, liability limits, and other legal language must appear verbatim in every bid — they cannot be paraphrased or omitted.

This feature provides the full settings UI and API for managing that library. Templates are categorized by section type, and can be designated as required (always included) or situational (triggered by RFP type or industry tag matching). Sort order controls the output sequence within each section type.

**What this feature does NOT do:** Actually inject templates into proposals — that is Feature 8. This feature only manages the library data.

---

## User Stories

### User Story 1: Create a Template
**As a** Supplier Admin
**I want** to create a new template entry with a section type, title, body text, and settings
**So that** I have a reusable clause that can be automatically appended to proposals

**Acceptance Criteria:**
- [ ] Admin can open a form/modal to create a new template
- [ ] Form requires: section type (from fixed list), title (non-empty), body text (markdown)
- [ ] Form includes: required toggle, trigger RFP type tags, trigger industry tags, evaluateCoverage toggle
- [ ] When required is toggled on, the evaluateCoverage toggle is automatically disabled and hidden (or shown as disabled)
- [ ] On save, the template appears in the list under the correct section heading
- [ ] Template body text is stored exactly as entered (no transformation)
- [ ] A newly created template defaults to: required=false, evaluateCoverage=false, empty trigger tags

**Priority:** High

---

### User Story 2: View and Browse the Template Library
**As a** Supplier Admin
**I want** to see all templates organized by section type
**So that** I can quickly understand what standard clauses are configured and identify gaps

**Acceptance Criteria:**
- [ ] Templates are displayed grouped by section type (Assumptions, Exclusions, Payment Terms, Change Management, IP Ownership, Liability, Force Majeure, Warranty)
- [ ] Each template entry shows: section type, title, required/situational indicator, and trigger tag summary
- [ ] Required templates are visually distinguished from situational templates
- [ ] Templates within a section type are shown in their sort order
- [ ] An empty library state (no templates) renders a helpful empty state message
- [ ] The list is accessible from the Settings page

**Priority:** High

---

### User Story 3: Edit a Template
**As a** Supplier Admin
**I want** to edit an existing template's content and settings
**So that** I can keep our standard clauses current as our commercial policies evolve

**Acceptance Criteria:**
- [ ] Admin can open an edit form pre-populated with the template's current values
- [ ] All fields are editable: section type, title, body text, required, trigger tags, evaluateCoverage
- [ ] The required → evaluateCoverage enforcement rule applies in edit mode (required=true disables evaluateCoverage)
- [ ] Saving updates the template immediately; the list reflects the change without page reload
- [ ] No other templates are affected by editing one template

**Priority:** High

---

### User Story 4: Delete a Template
**As a** Supplier Admin
**I want** to remove a template that is no longer needed
**So that** outdated clauses are not appended to future proposals

**Acceptance Criteria:**
- [ ] Admin can delete a template from the list or edit form
- [ ] A confirmation step is presented before deletion (prevents accidental removal)
- [ ] After deletion, the template disappears from the list and will not appear in future proposals
- [ ] Deletion does not affect already-generated proposals (past drafts retain their content)

**Priority:** Medium

---

### User Story 5: Reorder Templates Within a Section
**As a** Supplier Admin
**I want** to control the order in which templates of the same section type appear in proposals
**So that** our standard clauses read in a logical sequence

**Acceptance Criteria:**
- [ ] Admin can reorder templates within a section type via drag-and-drop or up/down controls
- [ ] Sort order persists after page reload
- [ ] Reordering one template does not affect templates in other section types
- [ ] The order displayed in the settings list matches the order templates appear in generated proposals

**Priority:** Medium

---

### User Story 6: Configure Situational Templates
**As a** Supplier Admin
**I want** to define trigger conditions (RFP type and/or industry tags) for situational templates
**So that** clauses like a "Government Compliance" assumption only appear in relevant proposals

**Acceptance Criteria:**
- [ ] Admin can specify zero or more RFP types as trigger conditions (e.g. "compliance", "technical")
- [ ] Admin can specify zero or more industry tags as trigger conditions (free-text entry)
- [ ] A template with no trigger tags is treated as required (if required=true) or never situationally triggered (if required=false with no triggers)
- [ ] A template with trigger tags is appended only when the RFP's rfpType or industryTags overlaps with the template's trigger conditions (OR logic: either rfpType or any industryTag matching is sufficient)
- [ ] Trigger tag configuration is visible in the template list summary

**Priority:** Medium

---

## Functional Requirements

**FR-1:** The template library is scoped per organization. One organization cannot read or modify another's templates.

**FR-2:** Templates are assigned to one of eight fixed section types: `assumptions`, `exclusions`, `payment_terms`, `change_management`, `ip_ownership`, `liability`, `force_majeure`, `warranty`. No custom section types are supported.

**FR-3:** Each template has a title (required, non-empty) and body text (required, non-empty markdown content).

**FR-4:** A template may be flagged as `isRequired: true`, meaning it is appended to every proposal for the organization unconditionally.

**FR-5:** A template may have `triggerRfpTypes` (array of strings) and `triggerIndustryTags` (array of strings) defining when it is situationally included. Null or empty arrays mean no situational trigger (the template is either required or excluded).

**FR-6:** `evaluateCoverage` is a boolean per template (default false). When `isRequired` is true, `evaluateCoverage` must be false — the system enforces this constraint.

**FR-7:** Templates are ordered within their section type by `sortOrder` (integer). The API accepts reorder operations that update `sortOrder` values.

**FR-8:** Body text is stored as entered. No sanitization or transformation occurs at the API level.

**FR-9:** CRUD operations on templates require admin role. Read-only listing requires authentication (any org member).

**FR-10:** The following API endpoints are provided:
- `GET /api/settings/proposal-templates` — list all templates for the org, grouped or flat
- `POST /api/settings/proposal-templates` — create a new template (admin)
- `PATCH /api/settings/proposal-templates/[id]` — update a template (admin)
- `DELETE /api/settings/proposal-templates/[id]` — delete a template (admin)
- `POST /api/settings/proposal-templates/reorder` — update sort order for multiple templates atomically (admin)

**FR-11:** Invalid or missing required fields return HTTP 400 with a descriptive error. Unauthorized access returns HTTP 401 or 403.

**FR-12:** The settings page lists the template library under a "Proposal Templates" section alongside Rate Card and Company Profile.

---

## Non-Functional Requirements

**NFR-1 — Tenant Isolation:** All database queries are filtered by `organizationId` derived from the authenticated session. No template data is readable or writable across organizations.

**NFR-2 — Data Integrity:** The constraint that `isRequired=true` implies `evaluateCoverage=false` is enforced at the API validation layer (Zod schema), not only in the UI.

**NFR-3 — Performance:** List endpoint returns all templates for an organization within 200ms under typical load (expected: tens to low hundreds of templates per org).

**NFR-4 — Security:** All write operations require admin role. The body text field is not executed or rendered server-side; it is stored as plain text and returned as plain text.

**NFR-5 — Usability:** The template form must be usable for multi-paragraph markdown bodies (multi-line textarea, not single-line input).

**NFR-6 — Reliability:** Deleting a template does not modify or cascade to any `proposal_drafts` records. Past proposals retain their content.

---

## Edge Cases & Error Handling

**EC-1: Empty template library** — The list view renders an informative empty state ("No templates yet. Add your first clause below.") rather than an empty blank page.

**EC-2: Required template with evaluateCoverage=true submitted via API** — API returns HTTP 400 with error message explaining the constraint. The UI pre-enforces this, but API validation is independent.

**EC-3: Reorder request with missing or invalid template IDs** — API returns HTTP 400; no partial updates are applied (atomic reorder).

**EC-4: Delete a template that is referenced in future proposals** — Not applicable. Templates are resolved at proposal generation time; no foreign key references from proposals to templates. Deletion is unconditional.

**EC-5: Template body text with special characters, large content** — Body text is treated as opaque text. Maximum body size is 50,000 characters (enforced by Zod schema, matching PRD data model from F1). Content exceeding this limit returns HTTP 400.

**EC-6: Section type not in allowed enum** — API returns HTTP 400 with "Invalid section type" error.

**EC-7: Concurrent edits** — Last write wins. No optimistic locking required for template management (low concurrency, admin-only).

**EC-8: Sort order gaps after deletion** — Gaps in `sortOrder` are acceptable. Templates are sorted by `sortOrder ASC`; rendering is stable even with non-contiguous integers.

---

## Success Metrics

- Admin can create, read, update, delete, and reorder proposal templates entirely through the settings UI
- All templates respect tenant isolation (zero cross-tenant data leakage, verifiable by tests)
- The `evaluateCoverage` constraint is enforced at the API level (verifiable by unit test)
- Situational trigger matching logic is tested with known RFP type and tag combinations
- The library CRUD operations are covered at ≥ 80% branch coverage
