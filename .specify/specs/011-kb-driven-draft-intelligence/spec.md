# Feature Specification: KB-Driven Draft Intelligence

**Feature Branch**: `011-kb-driven-draft-intelligence`
**Created**: 2026-03-24
**Status**: Clarified
**Input**: Partner testing feedback — KB/CL docs not feeding into RFP drafts; output missing title/metadata from inbound RFP; clarifying questions asking for info already in KB

## Overview

When a user uploads an RFP and creates a proposal draft, the system should maximize use of existing Knowledge Base and Content Library data before asking the user clarifying questions. Customer-specific documents (contact info, capabilities, preferences) uploaded to a customer's Knowledge tab should flow directly into the draft without requiring the user to re-enter that information manually.

Additionally, the output draft should preserve the exact title, dates, issuing organization, and other fixed metadata from the inbound RFP document — ensuring the response clearly maps back to the original request.

**Business Value**: This is the core workflow differentiator. "Dumb" customers upload docs and get good outputs automatically. "Smart" customers curate detailed KB/CL content and get excellent outputs for complex RFPs. The less manual re-entry required, the faster the user gets to a quality draft.

---

## User Scenarios & Testing

### User Story 1 - Per-Field Knowledge Retrieval (Priority: P1)

When an RFP is uploaded and processed, the system searches the Knowledge Base individually for each extracted field/question — not just the RFP title. This surfaces relevant KB content that would otherwise be missed by a single broad query.

**Why this priority**: The current single-query search on RFP name misses most KB entries because the semantic overlap between an RFP title (e.g., "IT Services RFP") and specific KB content (e.g., a doc about certifications or contact info) is too weak. Per-field search is the foundation that makes all other improvements work.

**Independent Test**: Upload an RFP with 5+ distinct requirement types. Upload KB docs covering 3 of those requirements. Verify that the per-field search surfaces the relevant KB entries for those 3 fields and that the generated responses reference that KB content.

**Acceptance Scenarios**:

1. **Given** an RFP with 10 fields and KB entries relevant to 4 of those fields, **When** the RFP is processed, **Then** the response generator receives KB context matched per-field (not just by RFP name) and at least those 4 fields reference KB content in their generated responses.
2. **Given** an RFP with no matching KB content, **When** the RFP is processed, **Then** the system degrades gracefully — fields are generated with lower confidence scores and flagged for review, with no errors.
3. **Given** an RFP with 30+ fields, **When** the system performs per-field search, **Then** results are returned within acceptable time bounds (search completes in under 15 seconds total) by batching or capping searches.

---

### User Story 2 - Customer KB Prioritization (Priority: P1)

When an RFP is linked to a specific customer, knowledge documents uploaded to that customer's Knowledge tab are prioritized over org-wide KB entries during both RFP processing (Pipeline 1) and proposal generation (Pipeline 2).

**Why this priority**: Partner testing showed that customer-specific docs (contact name, contact info, specific capabilities) were not being pulled into drafts. Users uploaded this data to the Customers tab but the draft still asked them to manually provide it. This is the single biggest UX complaint.

**Independent Test**: Create a customer with uploaded KB docs containing contact info and specific capabilities. Create an RFP linked to that customer. Verify the draft uses customer-specific content and does not ask the user for information already in the customer's KB.

**Acceptance Scenarios**:

1. **Given** a customer with a KB doc containing "Primary Contact: Jane Smith, jane@acme.com", **When** an RFP linked to that customer asks for a point of contact, **Then** the generated response uses "Jane Smith" and the contact info from the KB doc.
2. **Given** both a customer-specific KB entry and an org-wide KB entry that match the same field, **When** the system ranks results, **Then** the customer-specific entry receives a similarity score multiplier (1.3x) so it ranks higher while preserving relevance-based ordering — a highly relevant org-wide entry can still outrank a weakly relevant customer entry.
3. **Given** an RFP with no linked customer, **When** the system searches KB, **Then** only org-wide entries are returned (no change from current behavior for unlinked RFPs).

---

### User Story 3 - Pre-Fill From KB Before Clarifying Questions (Priority: P1)

Before generating clarifying questions for a proposal draft, the system checks whether the Knowledge Base or Content Library already contains answers. Questions are only presented to the user when the KB genuinely lacks coverage.

**Why this priority**: This eliminates the "why is it asking me things I already uploaded?" problem. It's the most visible UX improvement — fewer questions means faster time-to-draft. Combined with US1 and US2, this makes the KB the primary driver of draft quality.

**Independent Test**: Upload KB docs that cover a subset of typical clarifying question topics (e.g., company certifications, team qualifications). Create a draft for an RFP that would normally generate those questions. Verify that questions already answerable from KB are either suppressed or pre-answered.

**Acceptance Scenarios**:

1. **Given** KB entries that clearly answer 3 of the 7 questions the LLM would normally generate, **When** the system generates clarifying questions, **Then** those 3 questions are still displayed but pre-populated with the KB answer, tagged "Auto-answered from Knowledge Base," and the user can accept, edit, or clear each pre-filled answer.
2. **Given** mandatory scope/pricing questions (deliverables, exclusions, timeline), **When** KB has no relevant content, **Then** mandatory questions are always presented regardless of KB coverage — they are never suppressed.
3. **Given** a KB entry with partial coverage of a question topic, **When** the system evaluates coverage, **Then** the question is still presented with the partial KB answer pre-filled and a note indicating which aspects are covered vs. missing, so the user can supplement rather than start from scratch.

---

### User Story 4 - RFP Metadata Preservation (Priority: P2)

The system extracts and preserves the exact title, dates, issuing organization, deadline, and other fixed metadata from the inbound RFP document. This metadata is stored as structured data and carried through to the output draft verbatim.

**Why this priority**: Partner noted the output title didn't match the inbound RFP title. While less impactful than KB integration, this is a quick win that improves output credibility — the response should clearly reference the exact RFP it's responding to.

**Independent Test**: Upload an RFP titled "City of Springfield — IT Managed Services RFP #2026-0042, Due: April 15, 2026". Verify the generated proposal uses this exact title and references the correct dates.

**Acceptance Scenarios**:

1. **Given** an RFP with title "Request for Proposal: Enterprise Cloud Migration Services — RFP-2026-089", **When** the proposal is generated, **Then** the output document title matches the inbound RFP title exactly.
2. **Given** an RFP mentioning submission deadline "May 1, 2026" and project start date "July 1, 2026", **When** the proposal is generated, **Then** these dates appear verbatim in the appropriate sections of the output.
3. **Given** an RFP from "Department of Transportation, State of Texas", **When** the proposal is generated, **Then** the issuing organization name is preserved exactly as stated in the original document.
4. **Given** an RFP with no clear title or dates, **When** the system extracts metadata, **Then** missing fields are left null rather than fabricated, and the proposal writer uses the RFP name from the upload form as a fallback title.

---

### User Story 5 - KB Match Transparency (Priority: P3)

Users can see which KB/CL entries were used to generate each section of the draft, and where gaps exist that they should fill with better KB content.

**Why this priority**: This creates the feedback loop that trains users to upload better KB content. When users see "this section was generated from your uploaded doc X" vs. "this section has no KB coverage — consider uploading relevant content," they learn to improve their KB over time.

**Independent Test**: Generate a proposal draft, then view the draft detail. Verify that each section shows source attribution (which KB entries contributed) and that sections without KB coverage show a gap indicator.

**Acceptance Scenarios**:

1. **Given** a generated proposal section that drew from 2 KB entries, **When** the user views the draft, **Then** inline source blockquotes (already present in the proposal writer output format) cite each contributing KB entry by title.
2. **Given** a generated proposal section with no KB coverage, **When** the user views the draft, **Then** the section's source blockquote indicates no KB match was found, serving as a visible gap indicator.
3. **Given** a proposal with mixed coverage, **When** the user views the draft summary, **Then** an overall "KB coverage" metric is displayed showing what percentage of sections had strong KB support.

---

### Edge Cases

- **Empty Knowledge Base**: System must generate proposals without KB content — all fields marked low-confidence, clarifying questions not suppressed, no errors thrown.
- **Very large KB (500+ entries)**: Per-field search must remain performant. Cap total embedding calls and deduplicate results to prevent runaway API costs.
- **KB entries with no embeddings**: Entries uploaded before embedding was enabled (or where embedding failed) must be silently skipped, not cause search errors.
- **Identical content in customer KB and org KB**: Deduplication must handle entries with the same content but different scopes — keep the customer-scoped version when both match.
- **RFP with no parseable text**: If document parsing returns empty text, metadata extraction returns null for all fields — no fabrication.
- **Non-English RFP metadata**: Titles and dates in non-English languages should be preserved as-is (no translation).
- **Clarifying question with mixed KB coverage**: A question about "team qualifications and availability" where KB covers qualifications but not availability — question should be presented with the qualifications pre-filled and a note about the gap.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST perform per-field knowledge retrieval — each extracted RFP field triggers its own semantic search against the KB, replacing the current single-query-on-RFP-name approach in Pipeline 1.
- **FR-002**: System MUST apply a 1.3x similarity score multiplier to customer-specific KB entries when the RFP is linked to a customer, in both Pipeline 1 (RFP processing) and Pipeline 2 (proposal generation), preserving relevance-based ranking.
- **FR-003**: System MUST evaluate KB coverage before generating clarifying questions and pre-fill (not suppress) questions that are already answerable from KB content. Pre-filled questions are displayed with their KB answer and tagged "Auto-answered from Knowledge Base" so the user can accept, edit, or clear.
- **FR-004**: Mandatory scope/pricing questions (deliverables, exclusions, timeline) MUST always be presented to the user regardless of KB coverage.
- **FR-005**: System MUST extract structured metadata from inbound RFP documents: title, issuing organization, submission deadline, project start date, RFP reference number.
- **FR-006**: Extracted RFP metadata MUST be stored as structured data on the RFP record and passed to the proposal writer for verbatim inclusion in the output.
- **FR-007**: The proposal output title MUST match the inbound RFP title exactly (or fall back to user-provided RFP name if no title is extractable).
- **FR-008**: Per-field search MUST cap the number of embedding API calls to prevent unbounded cost (maximum configurable, default 20 fields).
- **FR-009**: Search results from per-field queries MUST be deduplicated before being passed to the response generator or proposal writer.
- **FR-010**: System MUST provide source attribution for each generated proposal section via inline source blockquotes in the proposal markdown, identifying which KB entries contributed to the response. No additional data model changes required — the existing `> *Source: [source]*` format is sufficient.
- **FR-011**: System MUST display a KB coverage indicator for proposal sections lacking KB support, guiding users to upload better content.
- **FR-012**: The proposal writer prompt MUST include RFP metadata (title, dates, issuing org) with instructions to use them verbatim — never paraphrase or fabricate.

### Key Entities

- **RFP Metadata**: Structured data extracted from inbound RFP — title, issuing organization, submission deadline, project start date, reference number. Stored on the RFP record.
- **KB Match Result**: A knowledge entry paired with the field it matched against and its similarity score. Used for source attribution and gap detection.
- **Pre-Filled Answer**: A clarifying question that was auto-answered from KB content, displayed with its source and tagged "Auto-answered from Knowledge Base." User can accept, edit, or clear it. Always visible (never suppressed).

## Success Criteria

### Measurable Outcomes

- **SC-001**: For an RFP linked to a customer with 5+ KB docs, at least 60% of generated response fields reference KB content (up from current ~10% with single-query search).
- **SC-002**: The number of clarifying questions presented to the user decreases by 30-50% when relevant KB content exists, compared to the same RFP with an empty KB.
- **SC-003**: The output proposal title matches the inbound RFP title exactly in 95%+ of cases where the inbound RFP has a parseable title.
- **SC-004**: Per-field KB search for a 20-field RFP completes in under 15 seconds (including embedding generation and vector queries).
- **SC-005**: Users can identify KB source attribution on every section of a generated proposal.
