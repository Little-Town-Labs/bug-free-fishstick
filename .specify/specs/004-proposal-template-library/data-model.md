# Data Model — 004-proposal-template-library

## Status

The `proposal_templates` table was **already created by Feature 1** (data model migration `drizzle/0008_proposal_bid_engine.sql`). No migration is required for this feature.

---

## Existing Table: `proposal_templates`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique template identifier |
| `organization_id` | `text` | NOT NULL, indexed | Tenant key — all queries must filter by this |
| `section` | `text` enum | NOT NULL | One of the 8 fixed section types |
| `title` | `text` | NOT NULL | Display name for the clause |
| `content` | `text` | NOT NULL | Markdown body; stored verbatim; max 50,000 chars |
| `is_required` | `boolean` | NOT NULL, default `false` | If true: appended to every proposal unconditionally |
| `trigger_rfp_types` | `jsonb` | nullable | `string[] \| null` — RFP type tags that trigger inclusion |
| `trigger_industry_tags` | `jsonb` | nullable | `string[] \| null` — industry tags that trigger inclusion |
| `evaluate_coverage` | `boolean` | NOT NULL, default `false` | If true: coverage checker evaluates this template's clause |
| `sort_order` | `integer` | NOT NULL, default `0` | Position within section; used for output ordering |
| `created_by` | `text` | NOT NULL | User ID of the creating admin |
| `created_at` | `timestamp` | NOT NULL, default `NOW()` | Record creation time |
| `updated_at` | `timestamp` | NOT NULL, default `NOW()` | Last modification time (updated manually on writes) |

### Section Enum Values

```
assumptions | exclusions | payment_terms | change_management |
ip_ownership | liability | force_majeure | warranty
```

### Indexes

| Index Name | Columns | Purpose |
|---|---|---|
| `proposal_templates_org_idx` | `organization_id` | All-templates list query |
| `proposal_templates_org_section_idx` | `organization_id, section` | Per-section list / pipeline fetch |
| `proposal_templates_org_required_idx` | `organization_id, is_required` | Required-templates fetch by pipeline (Feature 8) |

---

## Business Constraint

**`is_required = true` implies `evaluate_coverage = false`.**

This is enforced at two levels:
1. **Zod schema** (`createProposalTemplateSchema`) — `.refine()` rejects payloads where both are true
2. **Update logic** — service layer reads current row state, merges patch, then validates the merged result before writing

This constraint is NOT enforced by a DB CHECK constraint in the current migration. If the check is ever removed from application code, data integrity must be re-established by migration.

---

## TypeScript Types (exported from F1)

```typescript
// src/lib/db/schema/proposal-templates.ts
export type ProposalTemplate = typeof proposalTemplates.$inferSelect
export type NewProposalTemplate = typeof proposalTemplates.$inferInsert
export type ProposalTemplateSection = (typeof proposalTemplateSections)[number]
```

---

## Service Layer Types (new in this feature)

```typescript
// src/lib/services/proposalTemplates.ts

interface CreateProposalTemplateInput {
  section: ProposalTemplateSection
  title: string
  content: string
  isRequired?: boolean
  triggerRfpTypes?: string[] | null
  triggerIndustryTags?: string[] | null
  evaluateCoverage?: boolean
  // sortOrder: auto-assigned (max+1 within org+section)
  // createdBy: injected from auth.userId
}

interface UpdateProposalTemplateInput {
  title?: string
  content?: string
  isRequired?: boolean
  triggerRfpTypes?: string[] | null
  triggerIndustryTags?: string[] | null
  evaluateCoverage?: boolean
  sortOrder?: number
  // section: immutable — reject section changes at API level
}

interface ReorderItem {
  id: string
  sortOrder: number
}

type GroupedTemplates = Record<ProposalTemplateSection, ProposalTemplate[]>
```

---

## Query Patterns

### List (flat, for API response)
```sql
SELECT * FROM proposal_templates
WHERE organization_id = $1
ORDER BY section ASC, sort_order ASC
```

### Create (with auto sortOrder)
Transaction:
1. `SELECT COALESCE(MAX(sort_order), -1) + 1 FROM proposal_templates WHERE organization_id = $1 AND section = $2 FOR UPDATE`
2. `INSERT INTO proposal_templates (..., sort_order) VALUES (..., $next) RETURNING *`

### Update
```sql
UPDATE proposal_templates
SET <fields>, updated_at = NOW()
WHERE id = $1 AND organization_id = $2
RETURNING *
```
Returns empty array → not found/not owned → caller returns 404.

### Delete
```sql
DELETE FROM proposal_templates
WHERE id = $1 AND organization_id = $2
```
No rows affected → caller returns 404.

### Reorder (atomic transaction)
1. Validate all IDs belong to org + section in one SELECT
2. Loop: UPDATE sort_order per item (all inside single transaction)

### Pipeline Fetch (Feature 8, designed now for stability)
```sql
SELECT * FROM proposal_templates
WHERE organization_id = $1
  AND (
    is_required = true
    OR trigger_rfp_types @> $rfpTypeArray::jsonb
    OR trigger_industry_tags && $industryTagsArray::jsonb
  )
ORDER BY section ASC, sort_order ASC
```

---

## Notes on sort_order Gaps

After deletion, gaps in `sort_order` within a section are **acceptable**. The ORDER BY ensures stable rendering. No compaction step is needed. The UI renders items in list order, not by the raw integer value.
