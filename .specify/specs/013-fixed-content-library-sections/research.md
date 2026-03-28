# Technology Research: 013-fixed-content-library-sections

## Decision 1: How to Mark Fixed Sections in the Database

**Context:** Fixed sections must be distinguishable from custom entries in the same `proposal_content_library` table.

**Options Considered:**

1. **New `sectionType` column (text, nullable)** — `null` for custom entries, a stable identifier string (e.g., `company_info`) for fixed sections. Query fixed sections with `WHERE section_type IS NOT NULL`. Query by specific section with `WHERE section_type = 'company_info'`.
   - Pros: Simple, one column, queryable, extensible, no new table
   - Cons: Nullable column adds a tiny schema change

2. **New `isFixed` boolean column** — `true` for fixed, `false` for custom. Combined with `category` to identify which fixed section.
   - Pros: Simple boolean
   - Cons: Still need a way to identify WHICH fixed section — would overload `category` (the field we're trying to decouple from)

3. **Separate table `fixed_content_sections`** — New table for fixed sections, keep existing table for custom.
   - Pros: Clean separation
   - Cons: Duplicates schema, doubles query surface, complicates unified search

**Chosen:** Option 1 — `sectionType` column
**Rationale:** Single column serves as both the fixed/custom discriminator AND the stable identifier. No new table, minimal schema change. Query is trivial: `WHERE section_type = 'company_info' AND organization_id = ?`. Custom entries have `sectionType = null` and are completely unaffected.
**Tradeoffs:** One migration to add the column. Nullable column means we must handle `null` in TypeScript types.

---

## Decision 2: Lazy Initialization Strategy

**Context:** Fixed sections must be created for each org on first visit (clarified in spec). Need to decide where the init logic lives.

**Options Considered:**

1. **API-level init in GET /api/content-library** — When the endpoint is called, check if all 6 fixed sections exist. Create any missing ones. Return the full list.
   - Pros: Transparent to the UI, no extra endpoint, atomic with the list fetch
   - Cons: Write-on-read pattern, slightly slower first load (~50ms for 6 inserts)

2. **Dedicated POST /api/content-library/init endpoint** — UI calls init before fetching entries. Backend creates missing sections.
   - Pros: Explicit, no write-on-read
   - Cons: Extra round trip, UI must orchestrate, race conditions if called twice

3. **UI-level init** — Page detects missing sections and creates them via existing POST endpoint.
   - Pros: No backend changes
   - Cons: 6 sequential POST calls, race conditions, embedding triggers for empty content

**Chosen:** Option 1 — API-level init in GET endpoint
**Rationale:** Single request, no race conditions, transparent to UI. The write-on-read cost is < 50ms for 6 inserts and only happens once per org. After init, subsequent GETs are pure reads. The function is idempotent (skips sections that already exist).
**Tradeoffs:** First GET for a new org is slightly slower. Write-on-read is an unusual pattern, but justified by the one-time nature.

---

## Decision 3: Fixed Section Definitions Storage

**Context:** Need to store the 6 fixed section definitions (identifier, display name, description, sort order). Where does this live?

**Options Considered:**

1. **TypeScript constant (in-code)** — A `FIXED_SECTIONS` array defined in a shared module. Source of truth is code, not DB.
   - Pros: Type-safe, no DB lookup needed for definitions, easy to extend, versioned in git
   - Cons: Requires deploy to add new sections

2. **Database table `fixed_section_definitions`** — Admin-editable section definitions.
   - Pros: Runtime-editable
   - Cons: Over-engineered for 6 static entries, extra table, extra queries

**Chosen:** Option 1 — TypeScript constant
**Rationale:** The fixed section list changes with code releases, not at runtime. A TypeScript constant is type-safe, testable, and immediately available to both the API (for lazy init) and UI (for display names/descriptions). Six entries don't warrant a database table.
**Tradeoffs:** Adding a 7th section requires a code deploy. Acceptable — we explicitly designed for this (Insurance & Bonding deferred to future release).

---

## Decision 4: Retrieval Integration — Replace vs. Augment Current Logic

**Context:** Current retrieval (`fetchContentLibraryForProposal`) uses semantic search + keyword-based vendor field detection + category search. Fixed sections provide a deterministic alternative for the vendor-profile data that was failing.

**Options Considered:**

1. **Replace vendor-profile logic entirely** — Remove `VENDOR_PROFILE_KEYWORDS`, `VENDOR_CATEGORIES`, and `isVendorProfileField()`. Fixed sections handle all of that deterministically. Keep semantic search for custom entries only.
   - Pros: Eliminates fragile keyword matching, simpler code, deterministic
   - Cons: Removes semantic fallback for orgs that haven't migrated to fixed sections yet

2. **Augment — add fixed section fetch, keep existing logic** — New `fetchFixedSections()` runs first. Existing semantic + category search runs after, with dedup.
   - Pros: Backward compatible, gradual migration
   - Cons: More code paths, harder to reason about

3. **Replace vendor logic, keep semantic for custom entries** — Remove vendor keywords/categories. Fixed sections are deterministic. Semantic search only targets custom entries (by filtering out `sectionType IS NOT NULL` rows).
   - Pros: Clean separation, deterministic for fixed, semantic for custom
   - Cons: Slightly more complex query filter

**Chosen:** Option 3 — Replace vendor logic, keep semantic for custom
**Rationale:** The vendor keyword matching was the root cause of the bug Austin found. Keeping it alongside fixed sections just maintains two paths to the same data. Removing it and relying on fixed sections for vendor data is cleaner. Semantic search still picks up custom entries. The `sectionType IS NOT NULL` filter prevents double-injection of fixed sections.
**Tradeoffs:** If an org has vendor data in custom entries (not fixed sections), semantic search may or may not pick it up. This is acceptable — the UI will guide users to put vendor data in fixed sections.
