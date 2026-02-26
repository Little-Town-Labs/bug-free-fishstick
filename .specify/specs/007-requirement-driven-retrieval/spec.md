# Feature Specification: Requirement-Driven Retrieval

**Feature ID:** F7
**Branch:** `007-requirement-driven-retrieval`
**PRD Source:** §5 US6 (retrieval portion), §6.4 Steps 2–4
**Depends on:** F1 (`001-data-model-foundation`)
**Blocks:** F8 (`008-revised-proposal-pipeline`)
**Priority:** P1 — High
**Status:** Draft

---

## Overview

The current proposal generation pipeline retrieves knowledge base content using a single vector search against the RFP's name field. This produces generic, poorly-targeted context: a single query cannot simultaneously capture evidence relevant to a compliance requirement, a technical capability requirement, and a past-performance requirement. The pipeline also has no concept of typed context — it retrieves knowledge entries indiscriminately regardless of whether they are certifications, case studies, or company identity documents. Customer tone and instruction preferences are not loaded. Learnings accumulated from previous proposal approvals and corrections are not surfaced.

This feature delivers a dedicated retrieval module that replaces the single broad search with four focused retrieval strategies:

1. **Per-requirement semantic search** — each RFP requirement question generates its own embedding query, producing targeted knowledge snippets for each requirement. Duplicate entries surfaced by multiple requirement queries are deduplicated before the results are assembled.
2. **Typed supplier context queries** — the knowledge base is queried once per entry type so the pipeline receives clearly-labelled context blocks: company identity documents, certifications, case studies, and winning past RFPs filtered by industry tag overlap.
3. **Customer context loading** — the customer's preferred tone, industry context, and custom proposal instructions are loaded as a structured context object.
4. **Learnings retrieval** — organisation-wide learnings and customer-specific learnings are loaded, with customer-specific entries ordered first.

This module is a standalone, independently testable service. It has no UI. It produces no stored data. It is called by the pipeline (F8) but can be developed, tested, and verified before the pipeline rebuild begins.

**What this feature is NOT:** It does not generate proposal content. It does not change what is stored in the knowledge base. It does not modify customer records. It does not write to any database.

---

## User Stories

### US-001: Retrieval Targets Each RFP Requirement Individually

**As a** Proposal Preparer
**I want** the proposal generation system to search the knowledge base using the actual text of each RFP requirement, not just the RFP title
**So that** the retrieved evidence for each proposal section is specifically relevant to the requirement being answered, rather than generically related to the RFP subject

**Acceptance Criteria:**
- [ ] When an RFP has N requirement questions, N separate knowledge base queries are executed (one per question text)
- [ ] Each query uses the requirement's question text as the semantic search input
- [ ] Results from all N queries are merged into a single deduplicated collection before being returned
- [ ] A knowledge entry that is retrieved by multiple requirement queries appears only once in the returned collection
- [ ] When the OpenAI API key is absent or unavailable, the function returns an empty collection without throwing an error
- [ ] When the RFP has no parsed requirements, the function returns an empty collection without throwing

**Priority:** High

---

### US-002: Supplier Context Is Typed and Labelled

**As a** Proposal Preparer
**I want** the system to separately retrieve and label our company identity documents, certifications, case studies, and winning past proposals
**So that** the proposal writer has clearly-typed evidence blocks and can place each type of content in the most appropriate section of the proposal

**Acceptance Criteria:**
- [ ] Company identity documents (type `company_doc`) are retrieved as a distinct group
- [ ] Certifications (type `certification`) are retrieved as a distinct group
- [ ] Case studies (type `case_study`) are retrieved as a distinct group
- [ ] Past RFPs with `outcome = 'won'` are retrieved as a distinct group and filtered by industry tag overlap with the current RFP's industry tags
- [ ] Each group is returned as a separate, labelled field in the result — groups are not merged together
- [ ] Past RFP entries with `outcome` values other than `'won'` (e.g. `'lost'` or null) are never included in the winning past RFPs group
- [ ] When industry tags are provided but no past RFP entries share any tag, the winning past RFPs group is empty (not an error)
- [ ] When no industry tags are provided, no past RFP filtering by tag is applied and all won past RFPs for the organisation are included
- [ ] When the OpenAI API key is absent or unavailable for any typed query, that group returns an empty array without failing the other groups

**Priority:** High

---

### US-003: Customer Preferences Are Available to the Proposal Writer

**As a** Proposal Preparer
**I want** the proposal generation system to load the customer's preferred tone, industry context, and any custom proposal instructions configured for that customer
**So that** the generated proposal is written in the voice and style appropriate for that specific customer

**Acceptance Criteria:**
- [ ] The customer context object contains the customer's preferred tone (formal/casual/technical) when configured
- [ ] The customer context object contains the customer's industry context when configured
- [ ] The customer context object contains the customer's custom proposal instructions when configured
- [ ] When a customer record has no configured settings, the customer context object is returned with all optional fields absent (not an error)
- [ ] When the customer ID does not exist in the organisation's customer records, the function returns null to indicate no context is available
- [ ] The customer context is always scoped to the organisation — a customer from one organisation is never accessible by another organisation

**Priority:** High

---

### US-004: Learnings Are Available and Customer-Specific Entries Come First

**As a** Proposal Preparer
**I want** proposal generation to draw on lessons learned from previous proposal cycles, with lessons specific to this customer surfaced before general organisational lessons
**So that** proposals to repeat customers benefit from accumulated feedback and corrections without losing general institutional knowledge

**Acceptance Criteria:**
- [ ] All learnings for the organisation are included in the returned collection
- [ ] Learnings with a matching `customerId` appear before learnings with no `customerId` (organisation-wide learnings)
- [ ] Learnings are scoped to the organisation — learnings from other organisations are never returned
- [ ] When no customer ID is provided, only organisation-wide learnings (those with no customerId) are returned
- [ ] When no learnings exist for the organisation or customer, an empty array is returned without error

**Priority:** Medium

---

### US-005: Retrieval Degrades Gracefully Under All Failure Conditions

**As a** Proposal Preparer
**I want** proposal generation to proceed even when retrieval queries encounter partial failures (missing API key, empty knowledge base, network timeout on a single query)
**So that** a configuration gap or transient infrastructure issue does not prevent me from getting a draft

**Acceptance Criteria:**
- [ ] If the OpenAI API key is absent, all embedding-dependent functions return empty results; no exception propagates to the pipeline caller
- [ ] If a single per-requirement embedding query fails, the remaining queries continue and their results are returned; the failed query contributes no results
- [ ] If a typed context query returns zero results, that group is returned as an empty array; the other groups are unaffected
- [ ] If the customer ID is valid but the customer has no knowledge base entries, an empty group is returned; proposal generation is not blocked
- [ ] All four retrieval functions return defined, usable values (empty arrays or null as documented) even when the database has no matching rows

**Priority:** High

---

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-001 | `searchByRequirements(fields, orgId, openaiKey)` accepts an array of requirement field objects (each containing at least a `question` string), an organisation ID, and an optional OpenAI API key |
| FR-002 | For each element in `fields`, `searchByRequirements` generates one embedding using the element's `question` text and executes one semantic similarity query against the knowledge base scoped to `orgId` |
| FR-003 | The per-requirement query limit is capped at 5 results per requirement (to control total result volume); after merging, deduplication ensures each unique knowledge entry ID appears at most once in the output |
| FR-004 | Deduplication is performed by knowledge entry ID; when the same entry is retrieved by multiple requirement queries, the instance with the highest similarity score is retained |
| FR-005 | `searchByRequirements` returns a flat array of deduplicated `KnowledgeEntryWithSimilarity` objects, or an empty array if the API key is absent or all queries fail |
| FR-006 | `fetchTypedSupplierContext(orgId, industryTags, rfpType, openaiKey)` performs four separate database queries, each filtered to one knowledge entry type: `company_doc`, `certification`, `case_study`, `past_rfp` |
| FR-007 | The `past_rfp` query additionally filters to entries where `outcome = 'won'`; entries without a `'won'` outcome are excluded |
| FR-008 | When `industryTags` is a non-empty array, the `past_rfp` query applies an additional filter requiring at least one tag in the entry's `tags` field to match at least one tag in the provided `industryTags` array |
| FR-009 | When `industryTags` is null, undefined, or an empty array, no tag-based filter is applied to the `past_rfp` query |
| FR-010 | `fetchTypedSupplierContext` returns an object with four named fields: `companyDocs`, `certifications`, `caseStudies`, `wonPastRfps`; each is an array (possibly empty) of knowledge entries |
| FR-011 | `fetchCustomerContext(customerId, orgId)` queries the customers table for the record matching both `customerId` and `orgId`; if found, returns the customer's settings object; if not found, returns null |
| FR-012 | `fetchCustomerContext` never returns a customer whose `organizationId` does not match the provided `orgId`; tenant isolation is enforced at the query level |
| FR-013 | `fetchLearnings(orgId, customerId?)` queries the learnings table for all entries scoped to `orgId` |
| FR-014 | When `customerId` is provided to `fetchLearnings`, results are ordered so that entries with `customerId` matching the provided value appear before entries with a null `customerId`; all entries are included |
| FR-015 | When `customerId` is not provided to `fetchLearnings`, only entries with a null `customerId` are returned |
| FR-016 | All four functions are fully async; none block the event loop during database or embedding API calls |
| FR-017 | All four functions are stateless with respect to the database: they perform reads only, never writes or mutations |
| FR-018 | The module exports exactly four public functions: `searchByRequirements`, `fetchTypedSupplierContext`, `fetchCustomerContext`, `fetchLearnings` |
| FR-019 | When the OpenAI API key is absent or a single embedding call throws, the affected requirement's results are treated as empty; no error is propagated to the caller |
| FR-020 | The per-requirement search cap of 5 results per query is a configurable constant (not a magic number) defined at the top of the module |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-001 | Each individual database query (typed context, customer context, learnings) must return in under 500ms with proper index usage; this aligns with Constitution Principle XV |
| NFR-002 | The total number of embedding API calls is bounded by the number of requirement fields (capped at 10 per invocation to limit API cost; fields beyond the cap are silently skipped) |
| NFR-003 | All function signatures are fully typed with no `any`; input and output types are exported from the module for use by F8 |
| NFR-004 | Unit test coverage for the module must meet or exceed the project's 80% threshold; all four functions must have dedicated tests |
| NFR-005 | The module must not log any customer settings values, learning content, or knowledge entry content at log levels visible outside the process |
| NFR-006 | All database queries enforce `organizationId` as a required WHERE clause predicate; this is verified by tests |

---

## Edge Cases & Error Handling

### RFP with Zero Parsed Requirements
- `searchByRequirements` is called with an empty `fields` array; no embedding calls are made; an empty array is returned immediately.

### RFP with More Than 10 Requirements
- Only the first 10 requirement fields (by array order) are used for embedding queries. Fields beyond index 9 are silently skipped. The cap is documented in the return type or via a log at debug level.
- **Documented resolution:** The 10-requirement cap is established in the roadmap risk assessment (F7 risk: "Cap at 10 requirements per search pass"). This is the best-practice default adopted without clarification needed.

### Same Knowledge Entry Retrieved by Multiple Requirements
- After all per-requirement queries complete, results are merged into a Map keyed by entry ID. If an entry appears in multiple query results, the copy with the highest `similarity` score is kept. The deduplicated flat array is returned.

### OpenAI API Key Absent
- `searchByRequirements` skips all embedding calls and returns `[]`.
- `fetchTypedSupplierContext` does not use embeddings (it uses direct type-filtered queries, not semantic search); it proceeds normally and returns typed results.
- **Documented resolution:** Typed supplier context queries are direct DB queries filtered by entry type, not vector similarity queries. They do not require an embedding API key. This is consistent with the existing `searchSimilar` function's pattern of skipping gracefully when no key is present.

### Customer Not Found
- `fetchCustomerContext` returns `null` when no customer record matches the provided `customerId` + `orgId` combination. The pipeline (F8) must handle a null return gracefully.

### Knowledge Base Completely Empty
- All retrieval functions that query `knowledge_entries` return empty arrays when no entries exist for the organisation. No error is thrown.

### `tags` Field on knowledge_entries Is Null
- When the `tags` JSONB field on a knowledge entry is null, it does not overlap with any industry tag array. The entry is excluded from the `wonPastRfps` group when an industry tag filter is active. When no tag filter is active, the entry is included regardless of null tags.

### Learnings Table Has No Rows for Organisation
- `fetchLearnings` returns an empty array. Proposal generation proceeds without learnings context.

### Industry Tag Comparison
- Tag overlap is determined by case-sensitive exact string match between the RFP's `industryTags` array and the knowledge entry's `tags` array. No normalisation is applied at the retrieval layer.
- **Documented resolution:** Case-sensitive matching is the simplest correct behaviour and consistent with how tags are stored. Normalisation (if needed) should be enforced at ingestion time, not at query time.

---

## Test Coverage Requirements

The following test scenarios are explicitly required to meet NFR-004 and the Phase 3 gate:

### `searchByRequirements` Tests
- [ ] Empty fields array → returns empty array, no embedding calls made
- [ ] Single requirement field → one embedding call, results returned
- [ ] Multiple requirement fields → one embedding call per field, up to the cap
- [ ] Fields exceeding the 10-field cap → only first 10 fields queried
- [ ] Duplicate entry IDs across multiple queries → deduplicated; highest similarity retained
- [ ] Same entry returned by two queries with different similarity scores → higher similarity score entry is kept
- [ ] OpenAI key absent → returns empty array without throwing
- [ ] Single embedding call fails → remaining queries continue; failed query contributes no results

### `fetchTypedSupplierContext` Tests
- [ ] Returns distinct groups: companyDocs, certifications, caseStudies, wonPastRfps each populated from correctly-typed entries
- [ ] `past_rfp` entries with `outcome = 'won'` are included in wonPastRfps
- [ ] `past_rfp` entries without `outcome = 'won'` (null or 'lost') are excluded from wonPastRfps
- [ ] `company_doc` entries never appear in the certifications, caseStudies, or wonPastRfps groups
- [ ] Tag filter active (non-empty industryTags) → only won past_rfp entries with at least one matching tag are returned
- [ ] Tag filter absent (empty/null industryTags) → all won past_rfp entries returned regardless of tags
- [ ] Empty knowledge base → all four groups return empty arrays, no error thrown

### `fetchCustomerContext` Tests
- [ ] Customer exists with settings → returns settings object
- [ ] Customer exists with no settings → returns object with no settings fields (or null settings)
- [ ] Customer ID not found → returns null
- [ ] Customer ID exists but belongs to different organisation → returns null (tenant isolation enforced)

### `fetchLearnings` Tests
- [ ] Customer-specific learnings appear before organisation-wide learnings when customerId provided
- [ ] Only organisation-wide learnings returned when customerId not provided
- [ ] No learnings for organisation → empty array returned
- [ ] Learnings from other organisations never included (tenant isolation verified)

---

## Out of Scope

- Writing, updating, or deleting any database records
- Modifying knowledge base entries or their embeddings
- Generating proposal content or sections
- Displaying retrieved context in the UI
- Caching retrieved results across proposal generation runs
- Ranking or scoring retrieved results beyond the similarity score provided by pgvector
- Filtering knowledge entries by chunk index or `processingStatus` (assume all entries with embeddings are query-eligible)
- Semantic search for learnings (learnings are loaded by direct DB query, not embedding similarity)
- The `rfpType` parameter in `fetchTypedSupplierContext` is accepted by the function signature for forward compatibility (F8 may use it) but no filtering based on `rfpType` is implemented in this feature

---

## Success Metrics

- `searchByRequirements` returns a larger and more varied set of knowledge entries than the single-query approach for a test RFP with 5+ requirements (verified in Phase 3 gate)
- Typed knowledge groups contain zero cross-type leakage: no `certification` entries appear in `companyDocs`, no `company_doc` entries appear in `wonPastRfps` (verified by unit tests)
- `outcome = 'won'` filter on past_rfp group is verified by unit tests with both matching and non-matching fixtures
- All unit tests pass with 0 failures
- No errors thrown under any of the documented graceful-degradation scenarios

---

## Acceptance Criteria Summary

| Story | Done When |
|---|---|
| US-001 | N requirement fields produce N embedding queries; results merged and deduplicated; empty return when no API key |
| US-002 | Four distinct groups returned; `past_rfp` group contains only `outcome='won'` entries; tag filter applied when tags provided |
| US-003 | Customer settings returned when found; null returned when customer not found; tenant isolation enforced |
| US-004 | Customer-specific learnings ordered before org-wide; org-wide only returned when no customerId; empty array when no learnings |
| US-005 | All functions return empty/null (not errors) under: absent API key, failed individual query, empty DB, missing customer |
