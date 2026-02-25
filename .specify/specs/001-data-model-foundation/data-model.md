# Data Model — Data Model Foundation

**Feature**: `001-data-model-foundation`
**Date**: 2026-02-25

---

## Entity Overview

Four new data capabilities are added. Two are embedded in the existing `tenant_settings` table (rate card, company profile), one as a new dedicated table (`proposal_templates`), and one as an embedded JSONB column on `proposal_drafts` (coverage report).

```
tenant_settings (existing)
  ├── rate_card (JSONB) ─────► RateCard
  │     ├── roles[]  ──────────► RateCardRole
  │     └── discounts[] ──────► RateCardDiscount
  ├── proposal_defaults (JSONB)► ProposalDefaults
  └── company_profile (text)

proposal_templates (new table)
  └── organizationId → tenant_settings.organization_id

proposal_drafts (existing)
  └── coverage_report (JSONB) ► CoverageReport
        └── requirements[] ──► CoverageRequirement
```

---

## Modified Table: `tenant_settings`

### New Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `rate_card` | `jsonb` | YES | NULL | Structured pricing configuration — see RateCard type |
| `proposal_defaults` | `jsonb` | YES | NULL | Standard proposal term preferences — see ProposalDefaults type |
| `company_profile` | `text` | YES | NULL | Free-text supplier description (markdown supported, ≤50k chars) |

### JSONB Type: RateCard

```typescript
interface RateCardRole {
  name: string         // e.g. "Senior Developer"
  unit: 'hour' | 'day' | 'fixed'
  rate: number         // non-negative, USD, e.g. 175.00
}

interface RateCardDiscount {
  name: string                                  // e.g. "Government Rate"
  type: 'percentage' | 'fixed'
  value: number                                 // non-negative; pct as decimal (0.10 = 10%) or fixed USD
  appliesTo: 'subtotal' | 'total'
  customerIds: string[] | null                  // null = applies to all customers
}

interface RateCard {
  mode: 'blended' | 'by_role'
  blendedRate: number | null                    // required when mode='blended'
  roles: RateCardRole[]                         // required when mode='by_role'
  defaultMarginPct: number                      // 0–1 range, e.g. 0.20 = 20%
  currency: string                              // ISO 4217, length 3, e.g. "USD"
  discounts: RateCardDiscount[]
}
```

### JSONB Type: ProposalDefaults

```typescript
interface ProposalDefaults {
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: number          // non-negative integer, e.g. 30
  warrantyPeriodDays: number        // non-negative integer, e.g. 90
}
```

---

## New Table: `proposal_templates`

### Table Definition

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique template ID |
| `organization_id` | `text` | NO | — | NOT NULL | Tenant scope (Clerk org ID) |
| `section` | `text` | NO | — | enum, NOT NULL | Section classification |
| `title` | `text` | NO | — | NOT NULL | Display title of the template |
| `content` | `text` | NO | — | NOT NULL | Verbatim template body text |
| `is_required` | `boolean` | NO | `false` | NOT NULL | Auto-include in every proposal |
| `trigger_rfp_types` | `jsonb` | YES | NULL | — | RFP types that activate this template |
| `trigger_industry_tags` | `jsonb` | YES | NULL | — | Industry tags that activate this template |
| `evaluate_coverage` | `boolean` | NO | `false` | NOT NULL | Whether to run coverage check on this template |
| `sort_order` | `integer` | NO | `0` | NOT NULL | Ascending sort position within a section |
| `created_by` | `text` | NO | — | NOT NULL | Clerk user ID of creator |
| `created_at` | `timestamp` | NO | `now()` | NOT NULL | Creation timestamp |
| `updated_at` | `timestamp` | NO | `now()` | NOT NULL | Last update timestamp |

### Section Enum Values

`assumptions` | `exclusions` | `payment_terms` | `change_management` | `ip_ownership` | `liability` | `force_majeure` | `warranty`

### Constraints (Application-Enforced)

- When `is_required = true`, `evaluate_coverage` MUST be `false`. Validated in the Zod schema and service layer before persistence.
- When `trigger_rfp_types = null` AND `trigger_industry_tags = null`, template is treated as universal (applied to all situational matches).

### Indexes

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `proposal_templates_org_idx` | `organization_id` | Fetch all templates for an org |
| `proposal_templates_org_section_idx` | `organization_id, section` | Filter by section within an org |
| `proposal_templates_org_required_idx` | `organization_id, is_required` | Fetch required-only templates |

### JSONB Type: trigger_rfp_types, trigger_industry_tags

Both columns are `string[]` — simple arrays of string identifiers. Example:

```json
["technical", "compliance"]
```

---

## Modified Table: `proposal_drafts`

### New Column

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `coverage_report` | `jsonb` | YES | NULL | Coverage evaluation result — see CoverageReport type |

### JSONB Type: CoverageReport

```typescript
interface CoverageRequirement {
  requirementId: string       // references rfp_responses.id or extracted field ID
  question: string            // the original requirement text
  addressed: boolean          // true if proposal covers this requirement
  evidence: string | null     // quoted passage from proposal supporting addressed=true
  gap: string | null          // description of what's missing when addressed=false
}

interface CoverageReport {
  coverageScore: number           // 0–1 range (e.g. 0.85 = 85%)
  evaluatedAt: string             // ISO 8601 datetime string
  requirements: CoverageRequirement[]
}
```

---

## Relationships Summary

```
tenant_settings.organization_id (text, 1)
    ├──< proposal_templates.organization_id (text, N)
    └── (inline) rate_card, proposal_defaults, company_profile

rfps.id (uuid, 1)
    └──< proposal_drafts.rfp_id (uuid, N)
              └── (inline) coverage_report
```

`proposal_templates` does not have a foreign key to `tenant_settings` because `tenant_settings.organization_id` is a Clerk-managed text identifier (not a UUID PK). Referential integrity is enforced at the application layer via organization-scoped queries.

---

## Migration SQL Summary

File: `drizzle/0008_proposal_bid_engine.sql`

```sql
-- tenant_settings: 3 new nullable columns
ALTER TABLE "tenant_settings" ADD COLUMN "rate_card" jsonb;
ALTER TABLE "tenant_settings" ADD COLUMN "proposal_defaults" jsonb;
ALTER TABLE "tenant_settings" ADD COLUMN "company_profile" text;

-- New table: proposal_templates (with 3 indexes)
CREATE TABLE "proposal_templates" (...);
CREATE INDEX "proposal_templates_org_idx" ON "proposal_templates" ("organization_id");
CREATE INDEX "proposal_templates_org_section_idx" ON "proposal_templates" ("organization_id", "section");
CREATE INDEX "proposal_templates_org_required_idx" ON "proposal_templates" ("organization_id", "is_required");

-- proposal_drafts: 1 new nullable column
ALTER TABLE "proposal_drafts" ADD COLUMN "coverage_report" jsonb;
```

All new columns are nullable or have safe defaults — existing rows in all tables are unaffected.

---

## Zod Validation Schemas (Summary)

All schemas live in `src/lib/utils/validation.ts`:

| Schema | Used For |
|--------|----------|
| `rateCardRoleSchema` | Validates a single role entry |
| `rateCardDiscountSchema` | Validates a single discount rule |
| `rateCardSchema` | Validates the full rate card on write |
| `proposalDefaultsSchema` | Validates proposal defaults on write |
| `coverageRequirementSchema` | Validates a single requirement finding |
| `coverageReportSchema` | Validates the full coverage report on write |
| `createProposalTemplateSchema` | Validates template creation payload |
| `updateProposalTemplateSchema` | All fields optional (`.partial()` of create) |

All schemas use `.strict()` mode — extra keys are rejected at runtime.
