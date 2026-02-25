# Technology Research — Data Model Foundation

**Feature**: `001-data-model-foundation`
**Date**: 2026-02-25

---

## Decision 1: Storage Strategy for Rate Card and Proposal Defaults

**Context**: Rate card (pricing configuration) and proposal defaults are singleton per-organization records. They contain structured sub-objects (roles array, discount rules array) that need TypeScript type safety.

**Options Considered**:

1. **Dedicated tables** (`rate_cards`, `proposal_defaults`) — normalized relational approach
2. **JSONB columns in `tenant_settings`** — co-located with existing org-level config
3. **Separate JSONB document table** — generic key-value store per org

**Chosen**: JSONB columns in `tenant_settings`

**Rationale**:
- Rate card and proposal defaults are one-per-org, never queried individually across orgs; no benefit to normalization
- All org-level configuration is already in `tenant_settings`; colocation simplifies upsert logic and ensures atomic updates
- Drizzle's `.$type<T>()` on JSONB columns gives full TypeScript inference without a separate ORM model
- Existing `/api/settings` route already handles upsert-or-create pattern; extending it is lower risk than new tables

**Tradeoffs Accepted**:
- Cannot filter/index on sub-fields (e.g., "find all orgs with blended mode") — acceptable because this is per-org config, not aggregate analytics
- Entire rate card replaces on every update (no partial role updates) — acceptable given typical update frequency

---

## Decision 2: Storage Strategy for Proposal Templates

**Context**: Proposal templates are one-to-many per organization. They need filtering by section, required flag, and trigger conditions.

**Options Considered**:

1. **JSONB array in `tenant_settings`** — embed templates as an array alongside rate card
2. **Dedicated `proposal_templates` table** — first-class relational table with indexes

**Chosen**: Dedicated `proposal_templates` table

**Rationale**:
- One-to-many relationship requires individual row-level operations (create, update, delete, reorder)
- Filtering by `section`, `isRequired`, and trigger conditions requires indexed queries — not possible with embedded arrays
- Sorting by `sortOrder` is straightforward with SQL ORDER BY
- Template content can be large (up to 50,000 chars); embedding in a JSONB array creates update amplification on every template edit

**Tradeoffs Accepted**:
- Additional table and migration complexity vs. simpler embedded storage
- JOIN or second query needed to assemble all templates for a draft — acceptable given read patterns

---

## Decision 3: Storage Strategy for Coverage Report

**Context**: Coverage report is one-per-draft, written and read as a unit. It contains a score, timestamp, and N requirement entries.

**Options Considered**:

1. **Dedicated `coverage_reports` table** — normalized, one-to-one with `proposal_drafts`
2. **JSONB column on `proposal_drafts`** — embedded directly in the draft record

**Chosen**: JSONB column on `proposal_drafts`

**Rationale**:
- Coverage report is always read with its draft — never queried independently across drafts
- On-demand re-evaluation replaces the entire report; JSONB column update is atomic
- Avoids a JOIN on every draft fetch
- The `CoverageReport` TypeScript type provides full type safety via `.$type<CoverageReport>()`

**Tradeoffs Accepted**:
- Cannot query individual requirement findings with SQL (must deserialize in application code)
- Report size bounded by PostgreSQL JSONB limits (~256MB) — far beyond any realistic coverage report

---

## Decision 4: Zod Schema Placement

**Context**: Where to define runtime validation schemas for new structured inputs.

**Options Considered**:

1. **Co-located with API route handlers** — inline schemas in each route file
2. **Centralized in `src/lib/utils/validation.ts`** — shared across routes and services
3. **Separate `src/lib/schemas/` directory** — dedicated module

**Chosen**: Centralized in `src/lib/utils/validation.ts`

**Rationale**:
- Existing codebase already uses `validation.ts` for all Zod schemas (`createRfpSchema`, `createCustomerSchema`, etc.)
- Consistency with existing patterns is more important than theoretical purity
- Schemas are imported in multiple places (route handlers + service layer); centralization avoids duplication

**Tradeoffs Accepted**:
- Single file grows larger over time — mitigated by the existing precedent and clear section separators

---

## Decision 5: Migration Approach

**Context**: How to introduce schema changes to an existing production database.

**Options Considered**:

1. **Drizzle `push`** — direct schema sync, no migration files
2. **Drizzle `generate` + manual review** — auto-generate migration SQL, review before applying
3. **Hand-written migration SQL** — full manual control

**Chosen**: Hand-written migration SQL in `drizzle/0008_proposal_bid_engine.sql`

**Rationale**:
- Existing project uses numbered hand-written migrations (`0000_` through `0007_`); maintaining the pattern is mandatory
- `ALTER TABLE ... ADD COLUMN` with nullable columns is the safest migration — existing rows are unaffected
- Hand-written SQL enables explicit statement-breakpoint markers (`--> statement-breakpoint`) as required by Drizzle's migration runner

**Tradeoffs Accepted**:
- Must keep migration SQL and Drizzle schema files in sync manually — disciplined but manageable at this scale

---

## Decision 6: TypeScript Interface vs. Drizzle `$inferSelect`

**Context**: When to use raw TypeScript interfaces vs. Drizzle's inferred types for JSONB sub-structures.

**Options Considered**:

1. **All Drizzle inferred** — `typeof proposalTemplates.$inferSelect` everywhere
2. **Hybrid** — Drizzle inferred for table rows, explicit interfaces for JSONB sub-structures

**Chosen**: Hybrid

**Rationale**:
- Drizzle inference works well for table-level types (`ProposalTemplate`, `ProposalDraft`)
- JSONB sub-structures (`RateCard`, `RateCardRole`, `CoverageReport`, etc.) need explicit interfaces that can be imported independently by the pricing engine, pipeline, and UI without importing the entire schema module
- Explicit interfaces are self-documenting and enforce the contract at compile time even when data comes from non-ORM paths (e.g., Claude structured output)

**Tradeoffs Accepted**:
- Must manually keep interfaces in sync with Zod schemas — mitigated by keeping both in the same files
