# Feature Specification: Data Model Foundation — Structured Proposal Bid Engine

**Feature Branch**: `001-data-model-foundation`
**Created**: 2026-02-25
**Status**: Draft
**PRD Source**: `docs/prd-proposal-bid-engine.md` §6.1, §6.2, §6.6, §7
**Roadmap**: `.specify/roadmap.md` Feature 1

---

## Overview

This feature establishes all persistent data structures required by the Structured Proposal Bid Engine. It is a pure data-layer feature — no UI, no business logic — that all downstream features (rate card UI, pricing engine, template library, pipeline rebuild, coverage checker) depend on.

The feature adds four new data capabilities to the system:
1. Organizations can persist a **rate card** (roles, rates, margin, discounts, pricing mode)
2. Organizations can persist **proposal templates** (verbatim contract clauses, scoped and ordered)
3. Organizations can persist a **company profile** (free-text description of the supplier)
4. Proposal drafts can persist a **coverage report** (requirement-by-requirement validation result)

None of these capabilities are wired into the application yet — they are data-layer contracts that downstream features will build against.

---

## User Scenarios & Testing

### User Story 1 — Rate Card Configuration Persists (Priority: P1)

A Supplier Admin saves their organization's rate card settings. When they return later — or when the proposal pipeline reads it — the data is there exactly as saved.

**Why this priority**: Every other pricing-related feature depends on being able to read rate card data. Without persistent storage, no pricing feature can function.

**Independent Test**: Save a rate card with two roles and a discount rule. Retrieve it. Verify the retrieved data exactly matches what was saved, including margin, pricing model, and discount fields.

**Acceptance Scenarios**:

1. **Given** an organization has no rate card saved, **When** the system reads rate card configuration for that organization, **Then** it returns a null or empty result without error.

2. **Given** a rate card with mode `by_role`, two roles, a 20% margin, and one discount rule, **When** it is saved and then retrieved, **Then** all fields — mode, roles (names, units, rates), margin, pricing model, payment terms, and discount rules — are returned exactly as stored.

3. **Given** a rate card with mode `blended` and a blended rate of $150/hour, **When** it is saved and then retrieved, **Then** the blended rate and mode are returned correctly and the roles array is not required to be populated.

4. **Given** a rate card has been saved by Organization A, **When** Organization B reads its rate card configuration, **Then** Organization B receives its own (empty) rate card, not Organization A's data.

---

### User Story 2 — Proposal Template Library Persists (Priority: P1)

A Supplier Admin creates and manages contract clause templates. The template content, ordering, required flag, and trigger conditions are all preserved exactly as entered.

**Why this priority**: Template injection in the pipeline depends on being able to retrieve templates by organization, required flag, and trigger tags. Without reliable storage, template verbatim injection cannot function.

**Independent Test**: Create three templates for the same organization — one required, one situational (triggered by rfpType=technical), one optional. Retrieve all templates for the organization, filtered by required=true. Verify only the required template is returned. Retrieve by rfpType=technical. Verify only the situational template is returned.

**Acceptance Scenarios**:

1. **Given** a template with section=`assumptions`, title, content, `isRequired=true`, and `sortOrder=1`, **When** it is saved and then retrieved, **Then** all fields including content text are returned character-for-character identical to what was saved.

2. **Given** two templates for the same organization with `sortOrder` 1 and 2, **When** all templates for the organization are retrieved, **Then** they are returned in `sortOrder` ascending order.

3. **Given** a template with `triggerRfpTypes=['technical','compliance']`, **When** templates are retrieved filtered for `rfpType='technical'`, **Then** this template is included in the results.

4. **Given** a template with `triggerRfpTypes=['technical']`, **When** templates are retrieved filtered for `rfpType='commercial'`, **Then** this template is NOT included in the results.

5. **Given** a template with `isRequired=true`, **When** it is retrieved, **Then** its `evaluateCoverage` value is `false` regardless of what was submitted (the data layer enforces this constraint).

6. **Given** templates exist for Organization A, **When** Organization B retrieves templates, **Then** Organization B receives only its own templates (empty if none exist).

---

### User Story 3 — Company Profile Persists (Priority: P2)

A Supplier Admin writes a company description. The system stores it and makes it available to the proposal pipeline.

**Why this priority**: Company profile enriches proposal quality but graceful degradation (empty profile = omitted section) means this can be built in parallel and does not block the pipeline.

**Independent Test**: Save a multi-paragraph markdown string as the company profile. Retrieve it. Verify the returned string is byte-for-byte identical to what was saved, including line breaks and markdown formatting.

**Acceptance Scenarios**:

1. **Given** no company profile has been saved for an organization, **When** the profile is read, **Then** a null or empty string is returned without error.

2. **Given** a company profile containing markdown (headers, bullets, bold text) has been saved, **When** it is retrieved, **Then** the markdown content is returned exactly as stored, with no modification to formatting or special characters.

3. **Given** Organization A has a company profile saved, **When** Organization B reads its profile, **Then** Organization B receives its own (null/empty) profile, not Organization A's.

---

### User Story 4 — Proposal Draft Stores Coverage Report (Priority: P1)

After a coverage check runs on a proposal draft, the report is stored alongside the draft and can be read back to display in the UI.

**Why this priority**: The on-demand coverage re-evaluation flow (US8/US9 in the PRD) requires the coverage report to be persisted with the draft. Without this, the coverage UI has nothing to display.

**Independent Test**: Create a proposal draft. Write a coverage report to it containing a score, a timestamp, and two requirement findings (one addressed, one gap). Read the draft back. Verify the coverage report fields are present and match exactly.

**Acceptance Scenarios**:

1. **Given** a proposal draft with no coverage report yet, **When** the draft is read, **Then** `coverageReport` is null and no error is raised.

2. **Given** a coverage report with `coverageScore=0.85`, `evaluatedAt` timestamp, and three requirement entries (two addressed=true with evidence, one addressed=false with gap description), **When** it is written to a draft and then read back, **Then** all fields including nested requirement entries are returned exactly as stored.

3. **Given** an existing draft with a coverage report, **When** a new coverage report is written to the same draft, **Then** the new report fully replaces the previous one.

4. **Given** a coverage report has been written to Draft A, **When** Draft B is read, **Then** Draft B's `coverageReport` is unaffected.

---

### Edge Cases

- **Org with no settings row**: If an organization has no row in the settings store yet, reading rate card, proposalDefaults, or company profile returns null/empty without error. Writing creates or upserts the row.
- **Null vs. empty discount array**: A rate card with an empty discounts array and a rate card with no discounts key at all are treated equivalently — both mean no discounts configured.
- **Template sort order gaps**: If templates have sort orders 1, 3, 5 (with 2 and 4 missing), they are returned in the correct relative order without error.
- **Template with null trigger arrays**: A template with `triggerRfpTypes=null` and `triggerIndustryTags=null` matches all RFPs (universal situational template).
- **Coverage report with zero requirements**: A coverage report with an empty requirements array is valid and storable (edge case for RFPs with no parsed fields).
- **Large content fields**: Template content and company profile fields must support at least 50,000 characters without truncation.
- **Unicode in content**: Template content and company profile containing Unicode characters (accented characters, em-dashes, smart quotes) must be stored and retrieved exactly.
- **Concurrent saves**: If two save operations occur simultaneously for the same organization's settings, the last write wins and no data corruption occurs.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST persist rate card configuration per organization, including: pricing mode (blended or by-role), blended rate, roles with names/units/rates, default margin percentage, currency, and an ordered list of discount rules. Standard proposal terms (pricing model, payment terms in days, and warranty period) are stored as a companion `ProposalDefaults` structure alongside the rate card — logically unified at the API level but physically separate JSONB columns.

- **FR-002**: Each discount rule MUST store: name, type (percentage or fixed), numeric value, application scope (subtotal or total), and an optional list of customer identifiers that restricts its application.

- **FR-003**: The system MUST persist a library of proposal templates per organization. Each template MUST store: section type (one of: assumptions, exclusions, payment_terms, change_management, ip_ownership, liability, force_majeure, warranty), title, full body content, required flag, trigger RFP type conditions, trigger industry tag conditions, coverage evaluation flag, sort order, and creator identifier.

- **FR-004**: When a template's required flag is true, the system MUST enforce that its coverage evaluation flag is false. This constraint is applied at the data layer, not only in the UI.

- **FR-005**: The system MUST persist a company profile text field per organization. The field has no maximum length restriction below 50,000 characters and supports all Unicode characters.

- **FR-006**: The system MUST persist a coverage report on a proposal draft. The coverage report MUST store: overall score (0.0–1.0 decimal range, e.g. 0.85 = 85%), evaluation timestamp, and an ordered list of per-requirement findings. Each finding MUST store: requirement identifier, requirement question text, addressed flag (boolean), evidence text (nullable), and gap description (nullable).

- **FR-007**: All new data entities MUST be strictly scoped to their owning organization. No query for one organization's data may return another organization's data under any circumstances.

- **FR-008**: All new structured data fields MUST be validated at the point of ingestion. Malformed structures (wrong types, missing required sub-fields) MUST be rejected with a descriptive error rather than silently stored.

- **FR-009**: The data migration MUST apply to an existing production database without modifying, deleting, or corrupting any existing records. All new columns MUST be nullable or have safe defaults so existing rows are unaffected.

- **FR-010**: All new data structures MUST have corresponding TypeScript type definitions that are fully typed (no `any`). These types are the contracts that downstream features import.

- **FR-011**: Numeric fields representing monetary values (rates, margin, discount values) MUST be stored with sufficient precision to represent USD amounts accurately to the cent.

### Key Entities

- **RateCard**: Represents a supplier organization's pricing configuration. Contains the pricing mode, all role definitions, default margin and pricing model preferences, and any discount rules. One per organization (upserted, not versioned).

- **ProposalDefaults**: Supplementary pricing preferences stored alongside the rate card. Contains the default pricing model selection, payment terms, and warranty period. One per organization.

- **ProposalTemplate**: A single contract clause or boilerplate block belonging to an organization's template library. Has a section classification, verbatim content, and conditions that control when it appears in proposals.

- **CompanyProfile**: Free-text description of the supplier organization. Used as foundational context in every proposal prompt. One per organization.

- **CoverageReport**: The result of validating a proposal draft against its RFP requirements. Stored embedded within a proposal draft record. Contains a score and a list of per-requirement findings.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All four data capabilities (rate card, templates, company profile, coverage report) can be written and read back with 100% fidelity — no data loss, truncation, or type coercion.

- **SC-002**: Cross-organization isolation is verified: a test suite assertion that reads Organization A's data using Organization B's identifier returns null/empty for every new data entity.

- **SC-003**: The data migration executes against a populated development database in under 5 seconds and leaves all pre-existing records unchanged (verified by record count and spot-check queries).

- **SC-004**: All new TypeScript types compile without errors in strict mode with zero `any` types.

- **SC-005**: The `isRequired=true → evaluateCoverage=false` constraint is enforced: attempting to store a template with both flags set to true returns a validation error.

- **SC-006**: Content fields handle a 10,000-character Unicode string (including multi-byte characters) with byte-for-byte retrieval fidelity.
