# Task Breakdown: 013-fixed-content-library-sections

**Plan:** `.specify/specs/013-fixed-content-library-sections/plan.md`
**Created:** 2026-03-28
**Total Tasks:** 20
**Phases:** 4 + Quality Gate

---

## User Story → Task Mapping

| User Story | Tasks |
|---|---|
| US1: Pre-defined sections on first visit | A.1–A.4, B.1–B.4, C.1–C.6 |
| US2: Deterministic retrieval | D.1–D.6 |
| US3: Custom entries alongside fixed | B.3, C.3, C.5 |
| US4: Editing fixed section content | B.3, C.1–C.2 |
| US5: Fixed sections for existing orgs | B.1–B.2 (lazy init handles this) |

---

## Phase A: Schema & Constants (foundation)

### Task A.1: Fixed sections constant — Tests
**Status:** 🟡 Ready
**Dependencies:** None

Write tests for the `FIXED_SECTIONS` constant definition.

**Acceptance Criteria:**
- [ ] Test: exactly 6 sections defined
- [ ] Test: all identifiers are unique strings
- [ ] Test: sort orders are sequential (1–6)
- [ ] Test: all sections have non-empty displayName and description
- [ ] Test: `FixedSectionType` union type is exported and matches identifiers
- [ ] Tests confirmed to FAIL (constant does not exist yet)

---

### Task A.2: Fixed sections constant — Implementation
**Status:** 🔴 Blocked by A.1
**Dependencies:** A.1

Create `src/lib/constants/fixed-sections.ts` with the `FIXED_SECTIONS` array and `FixedSectionType` union type.

**Acceptance Criteria:**
- [ ] All 6 sections defined with sectionType, displayName, description, sortOrder
- [ ] `FixedSectionType` exported as union of literal identifier strings
- [ ] Helper `getFixedSectionDef(sectionType)` exported for lookups
- [ ] All tests from A.1 pass

---

### Task A.3: Schema migration — Tests
**Status:** 🟡 Ready
**Dependencies:** None
**Parallel with:** A.1

Write tests verifying the `sectionType` column exists in the schema.

**Acceptance Criteria:**
- [ ] Test: `proposalContentLibrary` table has `sectionType` column
- [ ] Test: `sectionType` is nullable (custom entries have NULL)
- [ ] Test: schema types include `sectionType: string | null`
- [ ] Tests confirmed to FAIL (column does not exist yet)

---

### Task A.4: Schema migration — Implementation
**Status:** 🔴 Blocked by A.3
**Dependencies:** A.3

Add `sectionType` column to schema and create migration.

**Acceptance Criteria:**
- [ ] `sectionType` text column added to `proposal-content-library.ts` schema (nullable)
- [ ] Migration `drizzle/0009_fixed_content_sections.sql` generated
- [ ] Migration includes composite index on `(organization_id, section_type)`
- [ ] Migration includes partial unique constraint `(organization_id, section_type) WHERE section_type IS NOT NULL`
- [ ] TypeScript types updated: `ProposalContentLibraryEntry` includes `sectionType`
- [ ] All tests from A.3 pass
- [ ] Existing tests still pass (no regressions)

---

## Phase B: Service Layer & API Guards

### Task B.1: Lazy init service — Tests
**Status:** 🔴 Blocked by A.2, A.4
**Dependencies:** A.2, A.4

Write tests for `ensureFixedSections()`.

**Acceptance Criteria:**
- [ ] Test: creates all 6 fixed sections when none exist for org
- [ ] Test: creates only missing sections when some exist
- [ ] Test: idempotent — calling twice produces same result (no duplicates)
- [ ] Test: sets `createdBy` to `'system'`, content to `''`, category/name to displayName
- [ ] Test: does NOT trigger embedding generation for empty entries
- [ ] Test: tenant-isolated — does not affect other orgs
- [ ] Tests confirmed to FAIL

---

### Task B.2: Lazy init service — Implementation
**Status:** 🔴 Blocked by B.1
**Dependencies:** B.1

Implement `ensureFixedSections()` in `src/lib/services/proposal-content-library.ts`.

**Acceptance Criteria:**
- [ ] Queries existing `section_type IS NOT NULL` rows for the org
- [ ] Compares against `FIXED_SECTIONS` constant
- [ ] Inserts missing sections with `ON CONFLICT DO NOTHING` (race condition safe)
- [ ] Empty content, no embedding trigger
- [ ] All tests from B.1 pass

---

### Task B.3: CRUD guards — Tests
**Status:** 🔴 Blocked by A.2, A.4
**Dependencies:** A.2, A.4
**Parallel with:** B.1

Write tests for fixed section update/delete guards and list filtering.

**Acceptance Criteria:**
- [ ] Test: `updateEntry()` on fixed section rejects `category` changes (throws error)
- [ ] Test: `updateEntry()` on fixed section rejects `name` changes (throws error)
- [ ] Test: `updateEntry()` on fixed section allows `content` changes
- [ ] Test: `updateEntry()` on custom entry allows all field changes (unchanged behavior)
- [ ] Test: `deleteEntry()` on fixed section throws 403-type error
- [ ] Test: `deleteEntry()` on custom entry works normally (unchanged behavior)
- [ ] Test: `listEntries()` with `type='fixed'` returns only fixed sections
- [ ] Test: `listEntries()` with `type='custom'` returns only custom entries
- [ ] Test: `listEntries()` with no type filter returns all entries
- [ ] Tests confirmed to FAIL

---

### Task B.4: CRUD guards — Implementation
**Status:** 🔴 Blocked by B.3
**Dependencies:** B.3

Update service functions with fixed section guards and list filtering.

**Acceptance Criteria:**
- [ ] `updateEntry()` checks `sectionType` — rejects category/name changes for fixed sections
- [ ] `deleteEntry()` checks `sectionType` — returns 403 for fixed sections
- [ ] `listEntries()` accepts optional `type` parameter to filter
- [ ] API route `GET /api/content-library` calls `ensureFixedSections()` then `listEntries()`
- [ ] API route `PATCH` guards fixed section field changes (400 response)
- [ ] API route `DELETE` guards fixed section deletion (403 response)
- [ ] All tests from B.3 pass
- [ ] All existing Content Library tests still pass

---

## Phase C: UI — Fixed Section Display & Editing

### Task C.1: FixedSectionCard component — Tests
**Status:** 🔴 Blocked by B.4
**Dependencies:** B.4

Write component tests for `FixedSectionCard`.

**Acceptance Criteria:**
- [ ] Test: renders display name as heading
- [ ] Test: renders guidance text and "Add Content" button when content is empty
- [ ] Test: renders content preview and "Edit" button when content is populated
- [ ] Test: no delete button is rendered
- [ ] Test: clicking "Add Content" / "Edit" triggers edit callback
- [ ] Test: WCAG — heading has correct role, buttons have aria-labels
- [ ] Tests confirmed to FAIL

---

### Task C.2: FixedSectionCard + Editor — Implementation
**Status:** 🔴 Blocked by C.1
**Dependencies:** C.1

Create `FixedSectionCard.tsx` and `FixedSectionEditor.tsx`.

**Acceptance Criteria:**
- [ ] FixedSectionCard shows empty/populated states correctly
- [ ] FixedSectionEditor renders textarea for content, read-only display of category/name
- [ ] Save calls `PATCH /api/content-library/[id]` with `{ content }` only
- [ ] Cancel closes editor without changes
- [ ] All tests from C.1 pass

---

### Task C.3: ContentLibraryList grouping — Tests
**Status:** 🔴 Blocked by B.4
**Dependencies:** B.4
**Parallel with:** C.1

Write tests for updated `ContentLibraryList` grouping behavior.

**Acceptance Criteria:**
- [ ] Test: fixed sections appear above custom entries
- [ ] Test: "Standard Sections" heading rendered above fixed sections
- [ ] Test: "Custom Entries" heading rendered above custom entries
- [ ] Test: when only fixed sections exist (no custom), custom section heading is hidden
- [ ] Test: when only custom entries exist (no fixed), standard section heading is hidden
- [ ] Tests confirmed to FAIL

---

### Task C.4: ContentLibraryList grouping — Implementation
**Status:** 🔴 Blocked by C.3
**Dependencies:** C.3

Update `ContentLibraryList.tsx` and `page.tsx` to group entries.

**Acceptance Criteria:**
- [ ] Entries split into fixed (sectionType != null) and custom (sectionType == null) groups
- [ ] Fixed sections rendered via FixedSectionCard, sorted by sortOrder from constant
- [ ] Custom entries rendered via existing list UI (unchanged)
- [ ] Visual separator between groups
- [ ] All tests from C.3 pass

---

### Task C.5: Category suggestion filter — Tests & Implementation
**Status:** 🔴 Blocked by A.2
**Dependencies:** A.2

Update `ContentLibraryForm` to exclude fixed section names from suggestions.

**Acceptance Criteria:**
- [ ] Test: `CATEGORY_SUGGESTIONS` does not include any fixed section display names
- [ ] Test: custom entry form still shows non-conflicting category suggestions
- [ ] Filter implemented by comparing against `FIXED_SECTIONS` constant
- [ ] Tests pass

---

### Task C.6: Content Library page integration — Verification
**Status:** 🔴 Blocked by C.2, C.4
**Dependencies:** C.2, C.4

Verify full page renders correctly with both fixed and custom entries.

**Acceptance Criteria:**
- [ ] Page loads without errors when org has no entries (lazy init creates fixed sections)
- [ ] Fixed sections display at top with guidance text
- [ ] Custom entries display below
- [ ] Add Entry button creates custom entries (not fixed sections)
- [ ] TypeScript compilation passes with zero errors

---

## Phase D: Retrieval & Prompt — Deterministic Pipeline Integration

### Task D.1: Fixed section retrieval — Tests
**Status:** 🔴 Blocked by A.2, A.4
**Dependencies:** A.2, A.4
**Parallel with:** C.1

Write tests for `fetchFixedSectionsForProposal()`.

**Acceptance Criteria:**
- [ ] Test: returns populated fixed sections as `Map<sectionType, content>`
- [ ] Test: skips fixed sections with empty/blank content
- [ ] Test: tenant-isolated — only returns sections for the given org
- [ ] Test: returns empty map when no fixed sections exist
- [ ] Tests confirmed to FAIL

---

### Task D.2: Fixed section retrieval — Implementation
**Status:** 🔴 Blocked by D.1
**Dependencies:** D.1

Add `fetchFixedSectionsForProposal()` to `content-library-retrieval.ts`. Update `fetchContentLibraryForProposal()` to remove vendor-keyword logic and filter semantic search to custom entries only.

**Acceptance Criteria:**
- [ ] `fetchFixedSectionsForProposal()` queries by `section_type IS NOT NULL AND content != ''`
- [ ] `VENDOR_PROFILE_KEYWORDS`, `VENDOR_CATEGORIES`, `isVendorProfileField()` removed
- [ ] Semantic search in `fetchContentLibraryForProposal()` filters to `section_type IS NULL`
- [ ] All tests from D.1 pass
- [ ] Existing retrieval tests updated to reflect removed vendor-keyword logic

---

### Task D.3: Proposal writer prompt — Tests
**Status:** 🔴 Blocked by A.2
**Dependencies:** A.2
**Parallel with:** D.1

Write tests for fixed section prompt block construction in the proposal writer.

**Acceptance Criteria:**
- [ ] Test: when fixedSections map has entries, each appears as a labeled prompt block
- [ ] Test: block format includes display name and mapping hint (e.g., "use for company name, HQ address...")
- [ ] Test: empty fixedSections map produces no fixed section blocks
- [ ] Test: system prompt includes mapping rules for all 6 section types
- [ ] Test: system prompt includes rule "Do NOT use PLACEHOLDER for fields covered by a populated fixed section"
- [ ] Test: custom entries still appear in separate Content Library block (coexistence)
- [ ] Tests confirmed to FAIL

---

### Task D.4: Proposal writer prompt — Implementation
**Status:** 🔴 Blocked by D.3
**Dependencies:** D.3

Update `proposal-writer.ts` to accept `fixedSections` and build deterministic prompt blocks.

**Acceptance Criteria:**
- [ ] `WriteProposalInput` interface includes `fixedSections?: Record<string, string>`
- [ ] Each populated fixed section gets its own `## [Display Name]` prompt block with mapping hint
- [ ] System prompt updated with FR-4 mapping rules
- [ ] System prompt includes "prefer fixed section data over PLACEHOLDER" rule
- [ ] All tests from D.3 pass

---

### Task D.5: Pipeline wiring — Tests
**Status:** 🔴 Blocked by D.2, D.4
**Dependencies:** D.2, D.4

Write/update integration tests for the generate-proposal pipeline.

**Acceptance Criteria:**
- [ ] Test: `fetch-content-library` step returns both fixedSections and customEntries
- [ ] Test: fixedSections passed to `writeProposal()` input
- [ ] Test: pipeline completes successfully when no fixed sections exist (graceful degradation)
- [ ] Test: pipeline step count and names match updated implementation
- [ ] Tests confirmed to FAIL

---

### Task D.6: Pipeline wiring — Implementation
**Status:** 🔴 Blocked by D.5
**Dependencies:** D.5

Update `generate-proposal.ts` to fetch and pass fixed sections through the pipeline.

**Acceptance Criteria:**
- [ ] `fetch-content-library` step calls both `fetchFixedSectionsForProposal()` and `fetchContentLibraryForProposal()`
- [ ] Fixed sections passed to `writeProposal()` as `fixedSections` parameter
- [ ] Custom entries passed as `contentLibraryEntries` (existing parameter)
- [ ] All tests from D.5 pass
- [ ] All existing pipeline tests pass (no regressions)
- [ ] TypeScript compiles with zero errors

---

## Quality Gate: Final Verification

### Task QG.1: Full Test Suite
**Status:** 🔴 Blocked by all implementation tasks
**Dependencies:** A.4, B.4, C.6, D.6

Run complete test suite and verify.

**Acceptance Criteria:**
- [ ] All new tests pass
- [ ] All existing tests pass (zero regressions)
- [ ] Coverage on new files meets 80% threshold
- [ ] TypeScript compilation: zero errors

---

### Task QG.2: Code Review
**Status:** 🔴 Blocked by QG.1
**Dependencies:** QG.1

Run `/code-review` on all changed files.

**Acceptance Criteria:**
- [ ] No CRITICAL or HIGH severity issues
- [ ] Tenant isolation verified in all new queries
- [ ] No hardcoded secrets
- [ ] Fixed section deletion protection verified
- [ ] MEDIUM issues addressed or documented

---

### Task QG.3: Security Review
**Status:** 🔴 Blocked by QG.1
**Dependencies:** QG.1
**Parallel with:** QG.2

Run `/security-review` focusing on API guard changes.

**Acceptance Criteria:**
- [ ] PATCH endpoint rejects category/name changes on fixed sections
- [ ] DELETE endpoint rejects fixed section deletion
- [ ] POST endpoint does not accept sectionType from client
- [ ] No tenant isolation leakage in new queries
- [ ] No OWASP Top 10 vulnerabilities introduced

---

## Critical Path

```
A.1 → A.2 → B.1 → B.2 → D.1 → D.2 → D.5 → D.6 → QG.1 → QG.2
```

**Parallel opportunities:**
- A.1 and A.3 run in parallel (independent)
- B.1 and B.3 run in parallel (independent test suites)
- C.1, C.3, D.1, D.3 can all start once A.2 + A.4 complete
- C track and D track run in parallel after Phase B
- QG.2 and QG.3 run in parallel

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| A: Schema & Constants | 4 | Foundation — column + constant definitions |
| B: Service Layer | 4 | Lazy init, CRUD guards, API updates |
| C: UI | 6 | Fixed section cards, grouping, editor |
| D: Retrieval & Prompt | 6 | Deterministic fetch, prompt blocks, pipeline |
| QG: Quality Gate | 3 | Full test suite, code review, security review |
| **Total** | **20** | |
