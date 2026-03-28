# Implementation Plan: 013-fixed-content-library-sections

**Specification:** `.specify/specs/013-fixed-content-library-sections/spec.md`
**Status:** Clarified
**Created:** 2026-03-28

---

## Executive Summary

Add a `section_type` column to `proposal_content_library`, define 6 fixed sections as a TypeScript constant, lazy-initialize them per org on first Content Library page load, update the UI to display fixed sections with guidance text and edit-only behavior, and replace the fragile vendor-keyword retrieval logic with deterministic fixed-section lookup in the proposal generation pipeline.

**Key insight:** The root cause of Austin's test failure is that retrieval relies on user-chosen category names matching hardcoded strings. Fixed sections eliminate this by giving each section a stable, system-controlled identifier.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Content Library Page               │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │  Fixed Sections (6)  │  │  Custom Entries (N)   │ │
│  │  - Company Info      │  │  - SLA Terms          │ │
│  │  - Contacts          │  │  - Boilerplate        │ │
│  │  - Services          │  │  - (user-defined)     │ │
│  │  - Specialties       │  │                       │ │
│  │  - Certifications    │  │                       │ │
│  │  - Past Performance  │  │                       │ │
│  └──────────┬───────────┘  └──────────┬───────────┘ │
└─────────────┼──────────────────────────┼─────────────┘
              │                          │
    ┌─────────▼──────────┐     ┌─────────▼──────────┐
    │  Direct DB lookup  │     │  Semantic search    │
    │  by section_type   │     │  via embeddings     │
    └─────────┬──────────┘     └─────────┬──────────┘
              │                          │
    ┌─────────▼──────────────────────────▼──────────┐
    │          Proposal Writer Prompt                │
    │  [Fixed: Company Info] deterministic block     │
    │  [Fixed: Contacts] deterministic block         │
    │  [Semantic: custom matches] as today           │
    └───────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Schema | Drizzle ORM migration | Existing pattern — all prior migrations use Drizzle |
| Definitions | TypeScript constant array | Static data, type-safe, no DB table needed (research.md #3) |
| Lazy init | API-level in GET handler | One request, idempotent, transparent to UI (research.md #2) |
| Retrieval | Direct `WHERE section_type = ?` | Deterministic, < 1ms, replaces keyword matching (research.md #4) |
| UI | Existing React components + new FixedSectionCard | Minimal new components, extends existing patterns |

---

## Technical Decisions

See `research.md` for full analysis. Summary:

| # | Decision | Chosen | Key Tradeoff |
|---|----------|--------|-------------|
| 1 | How to mark fixed sections | `section_type` nullable text column | One migration, nullable in types |
| 2 | Init strategy | Lazy init in GET /api/content-library | Write-on-read (one-time, < 50ms) |
| 3 | Where definitions live | TypeScript constant | Requires deploy to add sections |
| 4 | Retrieval approach | Replace vendor-keyword logic with direct lookup | Removes semantic fallback for vendor data |

---

## Implementation Phases

### Phase A: Schema & Constants (foundation)

**Files touched:**
- `src/lib/db/schema/proposal-content-library.ts` — add `sectionType` column
- `drizzle/0009_fixed_content_sections.sql` — migration (additive)
- `src/lib/constants/fixed-sections.ts` — NEW: `FIXED_SECTIONS` constant with all 6 definitions

**What happens:**
1. Add nullable `section_type` text column to the schema
2. Create partial unique index `(organization_id, section_type) WHERE section_type IS NOT NULL`
3. Create composite index `(organization_id, section_type)` for fast lookups
4. Define `FIXED_SECTIONS` constant with identifier, displayName, description, sortOrder for all 6 sections
5. Export `FixedSectionType` union type from the constant
6. Run migration — all existing rows get `section_type = NULL` (no data changes)

**Tests:**
- Schema structure test: verify `sectionType` column exists
- Constants test: verify 6 sections defined, unique identifiers, sequential sort order

**Depends on:** Nothing
**Blocks:** All subsequent phases

---

### Phase B: Service Layer — Lazy Init + Fixed Section Queries

**Files touched:**
- `src/lib/services/proposal-content-library.ts` — add `ensureFixedSections()`, `getFixedSections()`, update `listEntries()`, guard `updateEntry()` and `deleteEntry()`
- `src/app/api/content-library/route.ts` — call `ensureFixedSections()` in GET
- `src/app/api/content-library/[entryId]/route.ts` — guard PATCH and DELETE for fixed sections

**What happens:**
1. `ensureFixedSections(orgId, userId)` — queries existing fixed sections, creates missing ones with empty content and `createdBy: 'system'`. Idempotent. Does NOT trigger embedding generation for empty entries.
2. `getFixedSections(orgId)` — returns all fixed sections, ordered by sort order from constant.
3. `listEntries()` — updated to accept optional `type` filter ('fixed' | 'custom'). Default returns all.
4. `updateEntry()` — when entry has `sectionType != null`, reject changes to `category` and `name` fields.
5. `deleteEntry()` — when entry has `sectionType != null`, throw 403 error.
6. GET handler calls `ensureFixedSections()` before `listEntries()`.
7. PATCH handler checks `sectionType` before applying patch.
8. DELETE handler checks `sectionType` before deleting.

**Tests (TDD):**
- `ensureFixedSections()`: creates all 6 when none exist, creates only missing ones, idempotent on re-call
- `getFixedSections()`: returns in sort order, filters by org
- `listEntries()` with type filter: fixed-only, custom-only, all
- `updateEntry()` on fixed section: rejects category/name changes, allows content changes
- `deleteEntry()` on fixed section: throws 403
- API route tests: GET returns fixed + custom, PATCH fixed section guards, DELETE fixed section guards

**Depends on:** Phase A
**Blocks:** Phases C and D

---

### Phase C: UI — Fixed Section Display & Editing

**Files touched:**
- `src/components/content-library/FixedSectionCard.tsx` — NEW: displays one fixed section (empty state with guidance, populated state with content preview, Edit action, no Delete)
- `src/components/content-library/FixedSectionEditor.tsx` — NEW: content-only textarea editor for fixed sections (category/name read-only)
- `src/components/content-library/ContentLibraryList.tsx` — updated to separate fixed sections from custom entries
- `src/app/(auth)/content-library/page.tsx` — updated to render fixed sections group above custom entries
- `src/components/content-library/ContentLibraryForm.tsx` — filter fixed section names from category suggestions

**What happens:**
1. Page renders two groups: "Standard Sections" (fixed) and "Custom Entries"
2. Fixed sections show as cards with:
   - Display name as heading
   - Description/guidance text when empty, with "Add Content" button
   - Content preview when populated, with "Edit" button
   - No delete button
3. Clicking Edit/Add Content opens `FixedSectionEditor` inline — textarea for content, category and name shown as read-only labels
4. Save calls existing PATCH endpoint (only `content` field)
5. Custom entries section is unchanged except:
   - Grouped below fixed sections with a visual separator
   - `CATEGORY_SUGGESTIONS` in ContentLibraryForm excludes fixed section display names

**Tests:**
- FixedSectionCard: renders guidance when empty, renders content preview when populated, no delete button, edit triggers editor
- FixedSectionEditor: content-only edit, category/name displayed read-only, save calls PATCH with content only
- ContentLibraryList: fixed sections appear above custom entries, visual separator present
- Page: fixed sections appear even when no custom entries exist
- ContentLibraryForm: category suggestions exclude fixed section names

**Depends on:** Phase B (API must support fixed sections)
**Blocks:** Nothing (can run in parallel with Phase D)

---

### Phase D: Retrieval & Prompt — Deterministic Pipeline Integration

**Files touched:**
- `src/lib/services/content-library-retrieval.ts` — add `fetchFixedSectionsForProposal()`, update `fetchContentLibraryForProposal()`, remove vendor-keyword logic
- `src/lib/ai/agents/proposal-writer.ts` — add fixed section prompt blocks, update system prompt with mapping rules
- `src/lib/inngest/functions/generate-proposal.ts` — wire fixed section fetch alongside existing content library fetch

**What happens:**
1. New `fetchFixedSectionsForProposal(orgId)` — direct DB query for all fixed sections with non-empty content. Returns `Map<sectionType, content>`. No embedding search, no keyword matching.
2. Update `fetchContentLibraryForProposal()`:
   - Remove `VENDOR_PROFILE_KEYWORDS`, `VENDOR_CATEGORIES`, `isVendorProfileField()`
   - Semantic search now filters to `section_type IS NULL` (custom entries only)
   - Fixed sections are fetched separately via `fetchFixedSectionsForProposal()`
3. Pipeline (`generate-proposal.ts`):
   - Existing `fetch-content-library` step updated to call both `fetchFixedSectionsForProposal()` and updated `fetchContentLibraryForProposal()`
   - Returns `{ fixedSections: Map<string, string>, customEntries: ContentLibraryEntryWithSimilarity[] }`
4. Proposal writer (`proposal-writer.ts`):
   - New interface fields: `fixedSections?: Map<string, string>`
   - Build deterministic prompt blocks for each populated fixed section:
     ```
     ## Company Information (use for company name, HQ address, website, years in business)
     [content from company_info section]
     ```
   - Custom entries continue to appear in the existing `## Content Library` block
   - System prompt updated with explicit mapping rules (FR-4 from spec):
     - Company legal name, address, website, overview → Company Information section
     - POC, email, phone → Company Contacts section
     - Services, methodology → Services section
     - etc.
   - Rule: "When a fixed section provides data for an RFP question, use it verbatim. Do NOT use PLACEHOLDER for any field covered by a populated fixed section."

**Tests (TDD):**
- `fetchFixedSectionsForProposal()`: returns only populated sections, skips empty, tenant-isolated
- `fetchContentLibraryForProposal()`: no longer returns fixed sections in semantic results
- Proposal writer prompt tests: fixed section blocks appear when data present, omitted when empty, mapping rules in system prompt
- Pipeline integration test: verify fixed sections flow from fetch → writer → output
- Regression: proposals without fixed sections (empty org) still generate correctly

**Depends on:** Phase A (schema), Phase B (service layer)
**Blocks:** Nothing

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Tenant isolation | All queries include `organization_id` filter. Partial unique index scoped per org. |
| Fixed section injection | `sectionType` values are system-controlled; users cannot set them via API. POST rejects `sectionType` in body. |
| Content size | Existing 10KB content limit applies to fixed sections (same Zod validation). |
| Delete protection | API returns 403 for fixed section deletion. UI hides delete button. |

---

## Performance Strategy

| Operation | Target | Approach |
|-----------|--------|----------|
| Lazy init | < 50ms (one-time) | 6 inserts in single transaction |
| Fixed section retrieval (pipeline) | < 10ms | Direct index lookup, no embedding computation |
| Semantic search (custom entries) | < 2s (unchanged) | Filtered to `section_type IS NULL` — smaller dataset |
| Page load | No regression | Fixed sections returned in same GET call |

**Net pipeline impact:** Faster — replaces embedding-based vendor search with direct lookup. Semantic search dataset is smaller (excludes fixed sections).

---

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | FIXED_SECTIONS constant validity | Check identifiers, sort order, descriptions |
| Unit | `ensureFixedSections()` idempotency | Mock DB, verify insert/skip logic |
| Unit | Fixed section CRUD guards | Verify 403 on delete, reject category/name on patch |
| Unit | `fetchFixedSectionsForProposal()` | Mock DB, verify content filtering |
| Unit | Prompt block construction | Verify fixed section blocks, mapping rules |
| Component | FixedSectionCard | Empty state, populated state, no delete |
| Component | FixedSectionEditor | Content-only editing |
| Component | ContentLibraryList | Grouping, separator |
| Integration | API route guards | PATCH/DELETE fixed section via HTTP |
| Integration | Lazy init via GET | Verify sections created on first call |
| Integration | Pipeline end-to-end | Fixed sections → writer → output |

**Coverage target:** 80%+ on all new code

---

## Deployment Strategy

1. **Migration first:** Apply `0009_fixed_content_sections.sql` — adds nullable column, zero downtime
2. **Deploy code:** All changes deploy together — lazy init handles existing orgs on next visit
3. **No backfill script needed:** Fixed sections created on demand per org
4. **Rollback:** Revert code, drop column (all existing custom entries unaffected)

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Lazy init race condition (two concurrent GETs) | Low | Partial unique index prevents duplicate fixed sections; `ON CONFLICT DO NOTHING` on insert |
| Existing tests break from new column | Low | Column is nullable with default NULL — no change to existing rows or queries |
| Prompt becomes too long with all 6 sections | Medium | Only inject populated (non-empty) sections. Cap individual section content at 10KB (existing limit). |
| Users confused by empty fixed sections | Low | Guidance text explains what to enter. Sections clearly labeled. |

---

## Constitutional Compliance

| Principle | How Plan Addresses It |
|-----------|----------------------|
| I. Tenant Isolation | All queries scoped by `organizationId`. Partial unique index per org. |
| II. Type Safety | `FixedSectionType` union type. `sectionType` column typed in Drizzle schema. |
| III. Explicit Over Implicit | Fixed sections fetched by explicit identifier, not inferred by keyword matching. |
| IV. Secure by Default | Users cannot create/modify `sectionType` via API. Fixed section deletion blocked. |
| V. 80% Coverage | TDD approach, tests at every layer. |
| VI. Test the Agents | Proposal writer prompt construction tested with mocked fixed section data. |
| VII. Integration Tests | Pipeline integration test verifies fixed sections flow end-to-end. |
| IX. Progressive Disclosure | Fixed sections guide new users; custom entries remain available for power users. |
| X. Human Always in Control | Users choose what content to put in each section. System never auto-fills. |
| XII. Accessible First | Fixed section cards meet WCAG 2.1 AA. Screen reader support for guidance text. |
| XVI. Graceful Degradation | Empty fixed sections are skipped. Org with no sections works as before. |

**Status:** All applicable constitutional principles addressed. No exceptions required.

---

## Phase Dependency Summary

```
Phase A (schema + constants)
    │
    ├── Phase B (service layer + API guards)
    │       │
    │       ├── Phase C (UI) ─── can run parallel with D
    │       │
    │       └── Phase D (retrieval + prompt)
    │
    └── [all phases complete] → Integration test → Deploy
```

**Parallel opportunity:** Phases C and D can be implemented simultaneously after Phase B completes.
