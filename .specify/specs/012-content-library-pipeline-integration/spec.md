# Feature Specification: Content Library Pipeline Integration

**Feature Branch**: `012-content-library-pipeline-integration`
**Created**: 2026-03-27
**Status**: Clarified
**Input**: Partner testing feedback (Austin) -- Content Library entries not flowing into generated proposals; per-role rate card rates showing as PLACEHOLDER in output

## Overview

When a user generates a proposal, the system should incorporate all relevant Content Library entries into the generated output. Currently, the `proposal_content_library` table stores categorized vendor information (company address, contact details, website, boilerplate descriptions, etc.) with vector embeddings for semantic search, but this data is **never queried during proposal generation**. The generation pipeline only reads from the `knowledge_entries` table.

Additionally, when the organization's rate card is configured in `by_role` mode with individual role rates, the proposal output should populate per-role rate tables requested by the RFP -- not leave them as PLACEHOLDERs.

**Business Value**: Proposals currently ship with 5+ PLACEHOLDERs for basic vendor information that the user has already entered in the Content Library. This forces manual post-editing and undermines the "upload once, use everywhere" promise. Fixing this directly improves proposal completeness and reduces time-to-submission.

---

## User Scenarios & Testing

### User Story 1: Content Library Data in Generated Proposals

**As a** proposal preparer
**I want** my Content Library entries (company address, website, contact info, years in business, etc.) to appear in generated proposals
**So that** I don't have to manually fill in vendor profile sections after every generation

**Acceptance Criteria:**
- [ ] When a proposal is generated, the system queries the `proposal_content_library` table for the organization
- [ ] Content Library entries are matched to RFP sections using semantic search (embeddings) when available, with category-based fallback
- [ ] Matched Content Library content appears in the generated proposal in the appropriate sections (e.g., vendor profile, company info, contact details)
- [ ] Content Library and Knowledge Base results are passed as separate labeled context blocks, with prompt instructions directing the LLM to prefer Content Library for vendor profile fields (prompt-based dedup per FR-5)
- [ ] When no Content Library entries exist, generation proceeds unchanged (backward compatible)

**Priority:** High

---

### User Story 2: Per-Role Rate Card in Proposal Output

**As a** proposal preparer
**I want** my configured per-role hourly rates (PM, Senior Dev, QA, etc.) to appear in the proposal when the RFP asks for a rate card table
**So that** I don't have to manually fill in rate card tables that the system already knows

**Acceptance Criteria:**
- [ ] When the rate card is in `by_role` mode, individual role names and rates are passed to the proposal writer
- [ ] The proposal writer's prompt includes per-role rate data as a structured reference block
- [ ] Generated proposals populate role-rate tables with actual configured rates instead of PLACEHOLDERs
- [ ] When the rate card is in `blended` mode, the system provides the blended rate (current behavior preserved)
- [ ] When no rate card is configured, the system uses PLACEHOLDERs (current degradation preserved)

**Priority:** High

---

### User Story 3: Content Library Source Attribution

**As a** proposal reviewer
**I want** to see which Content Library entries were used in the generated proposal
**So that** I can verify the information is current and trace it back to its source

**Acceptance Criteria:**
- [ ] Content Library-sourced sections include source attribution (consistent with existing KB source annotations)
- [ ] The attribution distinguishes Content Library entries from Knowledge Base entries
- [ ] The coverage report accounts for Content Library matches when computing coverage scores

**Priority:** Medium

---

### User Story 4: Content Library Category Matching

**As a** proposal preparer
**I want** Content Library entries categorized as "Vendor Profile" or "Contact Information" to be specifically matched to RFP sections requesting vendor details
**So that** structured vendor data reliably fills vendor profile sections regardless of semantic similarity scores

**Acceptance Criteria:**
- [ ] When an RFP section explicitly requests vendor profile information (company name, address, contact, etc.), the system performs a targeted category-based lookup in addition to semantic search
- [ ] Category-based matches are prioritized for vendor profile sections
- [ ] The system recognizes common vendor profile field patterns (address, contact name, phone, email, website, years in business)

**Priority:** High

---

## Functional Requirements

### FR-1: Content Library Retrieval Step (Parallel Merge Strategy)
The proposal generation pipeline must include a step that queries the `proposal_content_library` table for the organization. For each RFP section, run semantic search across all CL entries AND run a targeted category lookup for vendor-profile sections. Merge and deduplicate results. This ensures vendor profile data is found even when semantic similarity is low (e.g., a street address won't semantically match "Corporate Headquarters Address").

### FR-2: Dual-Source Context Assembly
The proposal writer must receive context from both `knowledge_entries` (existing) and `proposal_content_library` (new) as separate, labeled blocks so the LLM can draw from both sources with clear attribution.

### FR-3: Per-Role Rate Data Injection
When the organization's rate card mode is `by_role`, the proposal generation pipeline must format and pass the full role-rate table to the proposal writer alongside the existing pricing markdown.

### FR-4: Vendor Profile Field Detection (Keyword Pattern Matching)
The system must identify RFP sections requesting vendor administrative details by matching RFP section titles/questions against a deterministic list of known vendor-profile keywords (e.g., "company name", "headquarters", "address", "contact", "website", "years in business", "point of contact", "phone", "email"). This is fast, testable, and easy to extend. No LLM classification needed.

### FR-5: Deduplication (Prompt-Based)
Both Content Library and Knowledge Base results are passed to the proposal writer as separate, labeled context blocks. The prompt instructs the LLM to prefer Content Library entries for vendor profile fields and avoid repeating the same information from multiple sources. No programmatic content-level deduplication is performed -- the LLM handles merging naturally. This can be revisited if users report redundancy.

### FR-6: Graceful Degradation
If the Content Library is empty, has no embeddings, or the search fails, the pipeline must continue without error using existing data sources only. No new failure modes introduced.

---

## Non-Functional Requirements

### NFR-1: Performance
- Content Library search must complete within 2 seconds for up to 500 entries
- Adding the Content Library step must not increase total pipeline time by more than 5 seconds
- Rate card formatting adds negligible overhead (in-memory operation)

### NFR-2: Tenant Isolation
- Content Library queries must be scoped by `organizationId` (Constitutional Principle I)
- No cross-tenant data leakage through search results

### NFR-3: Backward Compatibility
- Organizations with no Content Library entries must see identical behavior to current system
- Organizations with `blended` rate cards must see no change in pricing output
- Existing tests must continue to pass without modification

---

## Edge Cases & Error Handling

### EC-1: Empty Content Library
When an organization has no Content Library entries, the new retrieval step returns an empty array and the pipeline continues with existing data sources only.

### EC-2: Content Library Entries Without Embeddings
When Content Library entries exist but lack embeddings (not yet processed), fall back to category-based matching rather than failing.

### EC-3: Duplicate Information Across Sources
When the same vendor contact info exists in both `knowledge_entries` (as a `company_doc`) and `proposal_content_library`, the prompt instructs the LLM to prefer Content Library entries for vendor profile fields. No programmatic dedup needed.

### EC-4: Rate Card Not Configured
When no rate card exists or it has zero roles, the rate card reference block is omitted from the prompt (existing placeholder behavior preserved).

### EC-5: RFP Without Vendor Profile Sections
When the RFP does not request vendor profile information, the Content Library is still searched semantically but no targeted category matching occurs.

### EC-6: Very Large Content Library
When an organization has hundreds of Content Library entries, results are capped (top N by relevance) to avoid overwhelming the LLM context window.

---

## Out of Scope

- Content Library CRUD UI changes (already exists and working)
- Changes to how Content Library entries are created or embedded
- Merging `proposal_content_library` and `knowledge_entries` tables
- Changes to the clarifying questions pre-fill flow (handled by spec 011)

---

## Success Metrics

- Proposals generated for RFPs requesting vendor profile info should have 0 PLACEHOLDERs for data that exists in the Content Library
- Per-role rate tables should be fully populated when rate card is in `by_role` mode
- No increase in generation error rate
- No regression in existing test suite
