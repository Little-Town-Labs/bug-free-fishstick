# Feature Specification: Fixed Content Library Sections

**Feature Branch**: `013-fixed-content-library-sections`
**Created**: 2026-03-28
**Status**: Clarified
**Input**: Partner testing (Austin, 2026-03-28) — Content Library entries for "Company Contact" and "Company Overview" categories were not matched during proposal generation because the retrieval code uses hardcoded category names that don't match user-chosen names. Freeform categories create a fragile contract between data entry and retrieval.

## Overview

The Content Library currently treats every entry as freeform — users pick any category name and any entry name. The proposal retrieval code then tries to find relevant entries via semantic search and a hardcoded list of "vendor" category names. When user-chosen category names don't match the hardcoded list (e.g., "Company Contact" vs. "Contact Information"), retrieval silently fails and the proposal emits PLACEHOLDERs for data the user already entered.

This feature introduces **fixed (system-defined) Content Library sections** that are always present for every organization. Each fixed section has a known purpose (company info, contacts, services, certifications, etc.), a system-controlled category identifier, and structured guidance telling users exactly what to put in each section. The retrieval code can then look up fixed sections by their stable identifiers — no keyword guessing, no semantic search needed for core company data.

Users retain the ability to create additional freeform ("custom") entries as they do today. Fixed sections simply guarantee that the most commonly needed proposal data has a reliable, deterministic retrieval path.

**Business Value**: Eliminates the most common source of PLACEHOLDERs in generated proposals — basic company identity, contacts, and certifications. Reduces post-generation editing time. Provides clear onboarding guidance for new organizations ("fill in these sections to get started"). Directly addresses the accuracy gap Austin identified in testing.

---

## User Stories

### User Story 1: Pre-Defined Content Library Sections on First Visit

**As a** new organization administrator
**I want** to see a set of clearly labeled, pre-defined sections in the Content Library when I first open it
**So that** I know exactly what company information the system needs to generate complete proposals

**Acceptance Criteria:**
- [ ] When an organization has no Content Library entries, the UI displays a set of fixed sections with empty content and guidance text
- [ ] Fixed sections include at minimum: Company Information, Company Contacts, Services, Specialties, Certifications, Past Performance
- [ ] Each fixed section displays a description/prompt explaining what information to enter (e.g., "Enter your company's legal name, year founded, headquarters address, website, and a brief company overview")
- [ ] Fixed sections are visually distinct from custom entries (e.g., labeled as "Required" or grouped separately)
- [ ] Fixed sections cannot be deleted by the user
- [ ] The user can edit the content of any fixed section

**Priority:** High

---

### User Story 2: Deterministic Retrieval of Fixed Sections During Proposal Generation

**As a** proposal preparer
**I want** my fixed Content Library sections to reliably appear in the generated proposal
**So that** basic company information, contacts, and certifications are never PLACEHOLDERs when I've already entered the data

**Acceptance Criteria:**
- [ ] The proposal generation pipeline retrieves fixed sections by their stable system-defined identifiers — not by semantic search or keyword matching
- [ ] Fixed section content is injected into the proposal writer prompt as labeled, deterministic context blocks (e.g., "Company Information:", "Company Contacts:")
- [ ] When a fixed section has no content (user hasn't filled it in yet), it is omitted from the prompt — no empty blocks
- [ ] The proposal writer prompt instructs the LLM which fixed section to use for which type of RFP question (e.g., use "Company Information" for legal name, HQ address, years in business questions)
- [ ] Proposals generated after filling in fixed sections contain zero PLACEHOLDERs for data present in those sections

**Priority:** High

---

### User Story 3: Custom Entries Alongside Fixed Sections

**As a** Content Library manager
**I want** to create additional custom entries beyond the fixed sections
**So that** I can store industry-specific boilerplate, specialized technical capabilities, or client-specific content that doesn't fit the predefined categories

**Acceptance Criteria:**
- [ ] Users can create, edit, and delete custom Content Library entries exactly as they do today
- [ ] Custom entries appear separately from (or visually grouped below) fixed sections
- [ ] Custom entries continue to be matched via semantic search during proposal generation (existing behavior preserved)
- [ ] The category field for custom entries remains freeform
- [ ] Deleting a custom entry does not affect fixed sections

**Priority:** Medium

---

### User Story 4: Editing Fixed Section Content

**As an** organization administrator
**I want** to update the content of fixed sections at any time
**So that** my proposals always reflect current company information (new address, updated certifications, changed contacts)

**Acceptance Criteria:**
- [ ] Each fixed section has an Edit action that opens the content for editing
- [ ] The fixed section's category and name are read-only (system-controlled) — only the content is editable
- [ ] After saving, the updated content is used in all subsequent proposal generations
- [ ] The fixed section's embedding is regenerated after content changes (to support semantic search as a secondary path)

**Priority:** High

---

### User Story 5: Fixed Sections for Existing Organizations

**As an** existing organization with content already in the Content Library
**I want** the system to introduce fixed sections without losing my existing entries
**So that** my current content remains available and I can gradually migrate it into the appropriate fixed sections

**Acceptance Criteria:**
- [ ] When the feature is deployed, existing organizations see the new fixed sections alongside their existing custom entries
- [ ] Existing entries are NOT automatically moved or deleted
- [ ] Fixed sections start empty for existing organizations — no data is assumed or copied automatically
- [ ] No automatic migration suggestion UI in v1 — users manually copy content from existing entries into fixed sections if desired

**Priority:** Medium

---

## Functional Requirements

### FR-1: Fixed Section Definitions

The system must define a set of fixed Content Library sections. Each fixed section has:
- A **stable identifier** (machine-readable key, e.g., `company_info`, `company_contacts`)
- A **display name** (human-readable, e.g., "Company Information", "Company Contacts")
- A **description/prompt** explaining what data belongs in this section
- A **sort order** (fixed sections always appear before custom entries, in a consistent order)

The initial fixed sections are:

| Identifier | Display Name | Description |
|---|---|---|
| `company_info` | Company Information | Company legal name, year founded, headquarters address, website URL, brief company overview, number of employees |
| `company_contacts` | Company Contacts | Primary point of contact (name, title, email, phone), secondary contacts, mailing address if different from HQ |
| `services` | Services | Core service offerings, service descriptions, engagement models, delivery methodology |
| `specialties` | Specialties | Industry verticals, technical specializations, differentiators, areas of expertise |
| `certifications` | Certifications | Corporate certifications (ISO, SOC, etc.), staff certifications (AWS, PMP, etc.), compliance attestations with holder names and expiration dates |
| `past_performance` | Past Performance | Case studies, notable client engagements (anonymized if needed), project outcomes, references |

**Resolved (2026-03-28):** "Insurance & Bonding" deferred — start with 6 core sections, add more based on user feedback. Users can create a custom entry for insurance/bonding in the meantime.

### FR-2: Fixed Section Persistence

Fixed sections must be stored in the same `proposal_content_library` table as custom entries, with an additional marker distinguishing them from custom entries. Each organization gets its own set of fixed section rows.

**Initialization strategy (clarified 2026-03-28):** Lazy initialization. When the Content Library page loads and fewer than 6 fixed sections exist for the organization, the missing ones are created automatically with empty content. This applies to both new organizations and existing ones encountering the feature for the first time. No database migration script is required.

### FR-3: Deterministic Retrieval Path

During proposal generation, the retrieval step must:
1. Fetch ALL fixed sections for the organization by their stable identifiers (direct lookup — no embedding search)
2. Filter out any fixed sections with empty/null content
3. Inject populated fixed sections as individually labeled context blocks in the proposal writer prompt
4. THEN perform semantic search across ALL entries (fixed + custom) for additional matches (existing behavior)
5. Deduplicate: if a fixed section was already injected deterministically, exclude it from semantic search results

### FR-4: Prompt Mapping Rules

The proposal writer prompt must include explicit mapping guidance so the LLM knows which fixed section answers which type of RFP question:
- Company legal name, HQ address, website, years in business, company overview → `company_info`
- Point of contact, email, phone, contact details → `company_contacts`
- Core services, capabilities, methodology, engagement models → `services`
- Specializations, industry expertise, differentiators → `specialties`
- Certifications, compliance, attestations → `certifications`
- Case studies, references, past projects → `past_performance`

### FR-5: Fixed Section UI Behavior

- Fixed sections are always visible in the Content Library page, even when empty
- Empty fixed sections display guidance text and a prominent "Add Content" action
- Populated fixed sections display the content with Edit action
- Fixed sections cannot be deleted (no delete button shown)
- Fixed sections are grouped at the top of the Content Library, above custom entries
- A visual separator or heading distinguishes "Standard Sections" from "Custom Entries"

### FR-6: Backward Compatibility

- Existing custom entries remain unchanged in storage and behavior
- Semantic search continues to work across all entries (fixed + custom)
- Organizations that don't fill in fixed sections see identical behavior to today
- The existing Content Library form for custom entries is unchanged
- Category suggestions in the custom entry form should not duplicate fixed section names

---

## Non-Functional Requirements

### NFR-1: Performance
- Fixed section retrieval must complete in < 100ms (direct identifier lookup, no embedding computation)
- Total pipeline impact: fixed section retrieval should reduce overall latency compared to current approach (replaces speculative semantic search for vendor profile fields)

### NFR-2: Tenant Isolation
- Each organization has its own independent set of fixed section rows
- Fixed section queries are always scoped by `organizationId` (Constitutional Principle I)

### NFR-3: Migration Safety
- Deploying this feature must not alter or delete any existing Content Library entries
- Fixed sections are additive — new rows only
- If the migration/initialization fails partway through, the system operates normally with whatever fixed sections exist (or none)

### NFR-4: Accessibility
- Fixed sections meet WCAG 2.1 AA (Constitutional Principle XII)
- Screen readers can distinguish fixed sections from custom entries
- Empty-state guidance text is accessible

---

## Edge Cases & Error Handling

### EC-1: Fixed Section With Empty Content
When a fixed section exists but has empty/blank content, it is treated as "not yet filled in." The retrieval step skips it. The UI shows guidance text and the "Add Content" action.

### EC-2: Organization Created Before Feature Deployment
Existing organizations get fixed section rows created on first Content Library page visit (lazy initialization) or via a background migration. No data is copied from existing entries — fixed sections start empty.

### EC-3: Multiple Entries in Same Fixed Section
Each fixed section corresponds to exactly one Content Library row per organization. The content field is a single plain text block (same format as existing custom entries — no markdown editor). Users put all relevant information in that one block (guided by the description). There is no "add another entry" for fixed sections.

### EC-4: User Manually Creates Entry With Same Category as Fixed Section
If a user creates a custom entry with category "Company Information" (matching a fixed section display name), both the fixed section and the custom entry exist independently. The retrieval code uses the stable identifier for fixed sections, not the display name, so there is no collision. The UI may suggest the user edit the fixed section instead.

### EC-5: Future Addition of New Fixed Sections
When a new fixed section type is added in a future release, existing organizations need the new fixed section row created. The same lazy-init or migration mechanism handles this.

### EC-6: Content Library Search API
The existing search endpoints (semantic search, category search) continue to include fixed section entries in their results. Fixed sections are normal rows in the table — they just have an additional marker.

---

## Out of Scope

- Structured/field-level data within fixed sections (e.g., separate fields for company name, address, phone). Content is a single text block per section. Structured fields may be a future enhancement.
- Auto-populating fixed sections from existing entries during migration. Users manually fill them in.
- Changes to the Knowledge Base (`knowledge_entries` table). This feature only affects `proposal_content_library`.
- Per-RFP section mapping configuration (admin choosing which fixed section maps to which RFP field). The mapping is system-defined via prompt rules.
- Internationalization of fixed section names or descriptions.

---

## Success Metrics

- Proposals generated after populating all 6 fixed sections should have **zero PLACEHOLDERs** for company name, address, contacts, certifications, and services when the RFP requests that information
- Fixed section retrieval adds **< 100ms** to pipeline execution time
- Existing organizations see **zero data loss** after deployment
- New organizations can fill in all fixed sections and generate a complete proposal **without needing custom entries**
- Reduction in post-generation manual edits for vendor profile fields (qualitative — measured by Austin's testing)
