# Implementation Plan — Data Model Foundation

**Feature**: `001-data-model-foundation`
**Branch**: `001-data-model-foundation`
**Date**: 2026-02-25
**Status**: Plan Complete — Ready for `/speckit-tasks`

---

## Executive Summary

This plan delivers the persistent data layer for the Structured Proposal Bid Engine. It adds four new data capabilities — rate card, proposal templates, company profile, and coverage report — through database schema changes, TypeScript type definitions, Zod validation schemas, and an OpenAPI-defined API contract. No UI, no business logic, no pipeline changes. The goal is a clean data-layer contract that all downstream features (F2–F10) can build against.

**All implementation artifacts have been written** by specialist agents during the planning phase:
- Drizzle schema files updated/created ✅
- Migration SQL written ✅
- Zod validation schemas added ✅
- OpenAPI contract written ✅

The remaining work is tests and any service-layer stubs that downstream features will need.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  API Layer                          │
│  /api/settings (extended)                           │
│  /api/proposal-templates (new)                      │
│  Defined in: contracts/settings-api.yaml            │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│               Validation Layer                      │
│  src/lib/utils/validation.ts                        │
│  Zod schemas: rateCard, proposalDefaults,           │
│  coverageReport, createProposalTemplate             │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                 ORM Layer                           │
│  src/lib/db/schema/tenant-settings.ts               │
│  src/lib/db/schema/proposal-templates.ts (new)      │
│  src/lib/db/schema/proposal-drafts.ts               │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              Database Layer                         │
│  Neon PostgreSQL                                    │
│  drizzle/0008_proposal_bid_engine.sql               │
└─────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Database | Neon PostgreSQL | Existing project infrastructure |
| ORM | Drizzle ORM 0.45+ | Existing project ORM; `.$type<T>()` provides JSONB type safety |
| Validation | Zod v4 | Existing project validation library; strict mode enforced |
| API Contract | OpenAPI 3.0 | Language-agnostic contract; toolchain-compatible |
| Language | TypeScript 5 (strict) | Existing project standard |

See `research.md` for rationale behind each major technical decision.

---

## Files Changed / Created

### Schema Files (Drizzle ORM)

| File | Change | Status |
|------|--------|--------|
| `src/lib/db/schema/tenant-settings.ts` | Added `RateCard`, `ProposalDefaults` interfaces + 3 new columns | ✅ Done |
| `src/lib/db/schema/proposal-templates.ts` | New file — `proposalTemplates` table, 3 indexes | ✅ Done |
| `src/lib/db/schema/proposal-drafts.ts` | Added `CoverageReport`, `CoverageRequirement` interfaces + `coverageReport` column | ✅ Done |
| `src/lib/db/schema/index.ts` | Added `export * from './proposal-templates'` | ✅ Done |

### Migration

| File | Change | Status |
|------|--------|--------|
| `drizzle/0008_proposal_bid_engine.sql` | Full migration SQL for all schema changes | ✅ Done |

### Validation

| File | Change | Status |
|------|--------|--------|
| `src/lib/utils/validation.ts` | Added 8 new Zod schemas with exported types | ✅ Done |

### API Contract

| File | Change | Status |
|------|--------|--------|
| `.specify/specs/001-data-model-foundation/contracts/settings-api.yaml` | OpenAPI 3.0 spec for settings + template endpoints | ✅ Done |

### Tests (Remaining Work)

| File | Change | Status |
|------|--------|--------|
| `src/lib/db/schema/__tests__/tenant-settings.test.ts` | Unit tests for new schema columns and types | ⬜ TODO |
| `src/lib/db/schema/__tests__/proposal-templates.test.ts` | Unit tests for new table schema | ⬜ TODO |
| `src/lib/utils/__tests__/validation.test.ts` | Unit tests for all new Zod schemas | ⬜ TODO |
| `src/lib/db/__tests__/proposal-templates.integration.test.ts` | DB round-trip tests for all acceptance scenarios | ⬜ TODO |

---

## Implementation Phases

### Phase 1: Schema Foundation (COMPLETE)

All database schema changes have been written and are ready to apply.

- [x] Add `RateCard` and `ProposalDefaults` TypeScript interfaces to `tenant-settings.ts`
- [x] Add `rateCard`, `proposalDefaults`, `companyProfile` columns to `tenantSettings` table
- [x] Create `proposal-templates.ts` with full `ProposalTemplate` table and indexes
- [x] Add `CoverageReport`/`CoverageRequirement` interfaces to `proposal-drafts.ts`
- [x] Add `coverageReport` column to `proposalDrafts` table
- [x] Update `schema/index.ts` to export `proposal-templates`
- [x] Write `drizzle/0008_proposal_bid_engine.sql` migration

### Phase 2: Validation Layer (COMPLETE)

All Zod schemas written and exported.

- [x] `rateCardRoleSchema` — validates individual role entry
- [x] `rateCardDiscountSchema` — validates discount rule
- [x] `rateCardSchema` — validates full rate card (strict mode)
- [x] `proposalDefaultsSchema` — validates proposal defaults (strict mode)
- [x] `coverageRequirementSchema` — validates individual requirement finding
- [x] `coverageReportSchema` — validates full coverage report
- [x] `createProposalTemplateSchema` — validates template creation
- [x] `updateProposalTemplateSchema` — partial version of create schema

### Phase 3: API Contract (COMPLETE)

OpenAPI 3.0 contract defines all endpoints downstream features will implement.

- [x] `GET /api/settings/rate-card` — read current rate card
- [x] `PATCH /api/settings/rate-card` — upsert rate card
- [x] `GET /api/settings/company-profile` — read company profile
- [x] `PATCH /api/settings/company-profile` — upsert company profile
- [x] `GET /api/proposal-templates` — list templates (filterable)
- [x] `POST /api/proposal-templates` — create template
- [x] `PATCH /api/proposal-templates/reorder` — bulk reorder
- [x] `GET /api/proposal-templates/{id}` — get single template
- [x] `PATCH /api/proposal-templates/{id}` — update template
- [x] `DELETE /api/proposal-templates/{id}` — delete template

### Phase 4: Tests (REMAINING)

Write tests following TDD pattern for all acceptance scenarios in `spec.md`.

**Zod Schema Unit Tests** (`src/lib/utils/__tests__/validation.test.ts`):
- `rateCardSchema` accepts valid by_role and blended configs
- `rateCardSchema` rejects extra keys (strict mode)
- `rateCardSchema` rejects negative rates
- `rateCardDiscountSchema` validates all `appliesTo` and `type` combinations
- `proposalDefaultsSchema` validates all pricing models
- `coverageReportSchema` accepts score 0–1, rejects outside range
- `createProposalTemplateSchema` accepts all valid section values
- `createProposalTemplateSchema` rejects unknown section values

**DB Round-trip Integration Tests** (`src/lib/db/__tests__/proposal-templates.integration.test.ts`):
- Rate card: write and read back by_role with discount rule — verify fidelity
- Rate card: write and read back blended — verify mode and blendedRate
- Rate card: org isolation — org B cannot read org A's rate card
- Templates: create, retrieve ordered by sortOrder
- Templates: filter by isRequired=true
- Templates: filter by triggerRfpTypes
- Templates: org isolation
- Company profile: null default for new org
- Company profile: unicode round-trip (10,000 chars)
- Coverage report: null default on new draft
- Coverage report: full report write + read fidelity
- Coverage report: replacement (write new report over existing)
- Coverage report: isolation between drafts

---

## Key Technical Decisions

### isRequired → evaluateCoverage Constraint

The spec (FR-004) requires that `isRequired=true` templates must have `evaluateCoverage=false`. This is enforced in the **application layer** (Zod schema + service) rather than as a DB CHECK constraint. Rationale:

- CHECK constraints on JSONB are awkward and vary by PostgreSQL version
- Application-layer enforcement gives a clean validation error with a descriptive message
- The Zod schema's `.refine()` or the service layer will validate this before any INSERT/UPDATE

When implementing the template write service, add:
```typescript
if (data.isRequired && data.evaluateCoverage) {
  throw new ValidationError('Required templates cannot have evaluateCoverage enabled')
}
```

### Migration Safety

All new columns are nullable or have safe defaults:
- `rate_card` — nullable JSONB; existing rows get NULL
- `proposal_defaults` — nullable JSONB; existing rows get NULL
- `company_profile` — nullable text; existing rows get NULL
- `coverage_report` — nullable JSONB; existing rows get NULL

The `proposal_templates` table has no foreign keys to tables that might block creation.

### Blended Rate Semantics

When `mode = 'blended'`:
- `blendedRate` MUST be a non-negative number
- `roles` array MAY be empty

When `mode = 'by_role'`:
- `blendedRate` MAY be null
- `roles` array SHOULD be non-empty (enforced by downstream pricing engine, not this data layer)

The data layer stores whatever is provided (within type constraints). The pricing engine (Feature F5) enforces the business rules.

---

## Security Considerations

- All new API endpoints inherit the existing `requireAuth()` + organization-scope pattern
- Write operations (PATCH, POST, DELETE) require admin privileges (`isAdmin()` check)
- All JSONB input is validated by Zod schemas before persistence — no raw JSON stored without validation
- `organization_id` on `proposal_templates` is derived from the authenticated session, never from the request body
- Template content is stored verbatim; XSS sanitization is the responsibility of the rendering layer, not the storage layer

---

## Performance Strategy

- Three indexes on `proposal_templates` cover all primary query patterns (see `data-model.md`)
- Rate card and proposal defaults are read with the tenant settings row — no additional query
- Coverage report is read with the draft row — no JOIN required
- No additional caching needed at this layer; the settings row is already lightweight

---

## Testing Strategy

| Test Type | Target | Tool |
|-----------|--------|------|
| Unit | Zod schema validation | Vitest |
| Unit | TypeScript type correctness | `tsc --noEmit` |
| Integration | DB round-trip (write/read fidelity) | Vitest + test DB |
| Integration | Org isolation assertions | Vitest + test DB |

Minimum coverage target: **80%** across new files.

All integration tests should use a dedicated test database (not production) and clean up after themselves.

---

## Constitutional Compliance

**Article I — Specifications First**: Feature was specified in `spec.md` before any implementation artifact was created. ✅

**Article II — Test-First Imperative**: Tests are the remaining work before implementation is considered complete. Schemas were written during planning (research + artifact phase), not before tests, which is a limited exception given that schema files _are_ the artifact being tested. Tests must be written before the feature is marked done. ⚠️ (Tests pending)

**Article III — Simplicity**: No over-engineering. No separate rate_card or coverage_report tables where JSONB columns suffice. No abstraction layers beyond what's needed. ✅

**Article IV — Security**: Auth enforced at API layer. Zod validation at ingestion. Org-scoped queries throughout. ✅

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Migration breaks existing rows | Low | High | All new columns nullable; migration is additive only |
| Zod strict mode rejects valid inputs | Low | Medium | Test schemas against realistic data before route integration |
| `isRequired + evaluateCoverage` constraint bypassed | Low | Medium | Enforce in both Zod schema AND service layer |
| Template content size causes DB issues | Very Low | Low | PostgreSQL text columns support GB-scale; 50k chars is negligible |

---

## Next Steps

1. Run `/speckit-tasks` to generate ordered task breakdown
2. Apply migration: `npx drizzle-kit migrate` (or equivalent)
3. Write tests (Phase 4 above)
4. Run `/speckit-analyze` to validate spec/plan/tasks consistency
5. Proceed to Feature F2 (Rate Card UI) which builds on this data layer
