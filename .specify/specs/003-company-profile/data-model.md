# Data Model — 003-company-profile

**Feature:** Company Profile
**Branch:** 003-company-profile

---

## Overview

No new schema changes are required. The `company_profile` column was added to `tenant_settings` in Feature 1 (migration `drizzle/0008_proposal_bid_engine.sql`).

---

## Existing Column

### `tenant_settings.company_profile`

| Attribute | Value |
|-----------|-------|
| Column name | `company_profile` |
| Drizzle field | `companyProfile` |
| Type | `text` (PostgreSQL `TEXT`) |
| Nullable | Yes (`null` when never set) |
| Default | `null` |
| Max length | Enforced at API layer (10,000 characters via Zod) — no DB-level `CHECK` constraint |
| Table | `tenant_settings` |
| Isolation key | `organization_id` (all reads/writes scoped to the authenticated org) |

**Drizzle schema declaration (Feature 1):**
```typescript
companyProfile: text('company_profile'),
```

**Zod validation (already in `updateTenantSettingsSchema`):**
```typescript
companyProfile: z.string().max(10000).nullable().optional(),
```

---

## New Dedicated Validation Schema

This feature adds a purpose-built patch schema for the `/api/settings/company-profile` endpoint (separate from `updateTenantSettingsSchema` which covers all settings):

```typescript
// In src/lib/utils/validation.ts
export const updateCompanyProfileSchema = z.object({
  companyProfile: z.string().max(10000).nullable(),
})
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>
```

Key decisions:
- `nullable()` — null explicitly clears the profile (distinct from the `optional()` on the general schema)
- No `.min(1)` — empty string is valid (clearing the profile)
- No `.strict()` — single top-level field, no extra-key risk

---

## Service Layer

Two new functions in `src/lib/services/company-profile.ts`:

### `getCompanyProfile(orgId: string)`
```
Returns: { companyProfile: string | null }
```
- Selects only the `companyProfile` column from `tenant_settings` filtered by `organizationId`
- Returns null when no row exists or when the column value is null

### `upsertCompanyProfile(orgId: string, companyProfile: string | null)`
```
Returns: void
```
- Drizzle `insert().values({ organizationId, companyProfile, createdAt, updatedAt }).onConflictDoUpdate({ target: organizationId, set: { companyProfile, updatedAt } })`
- Explicit `createdAt: new Date()` on insert path (consistent with F2 fix)

---

## No Migration Required

The `company_profile` column exists in the current schema. This feature adds only application-layer code (API route, service, UI). No new Drizzle migration file is needed.
