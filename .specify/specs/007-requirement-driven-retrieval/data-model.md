# Data Model: F7 — Requirement-Driven Retrieval

## Overview

This feature introduces **no new database tables and no schema migrations**. It is a read-only
service layer that queries three existing tables: `knowledge_entries`, `customers`, and `learnings`.

All read patterns, indexes, and constraints are pre-existing from F1
(`001-data-model-foundation`).

---

## Existing Tables Used

### `knowledge_entries`

| Column           | Type                  | Usage in F7 |
|------------------|-----------------------|-------------|
| `id`             | `uuid` PK             | Deduplication key in `searchByRequirements` |
| `organization_id`| `text` NOT NULL       | Mandatory WHERE predicate on all queries |
| `type`           | `text` enum           | WHERE predicate in `fetchTypedSupplierContext` (one query per type) |
| `title`          | `text`                | Returned in all result objects |
| `content`        | `text`                | Returned in all result objects |
| `embedding`      | `vector(1536)`        | Used in `searchByRequirements` pgvector distance queries |
| `tags`           | `jsonb` (`string[]`)  | Industry tag overlap filter on `past_rfp` group |
| `metadata`       | `jsonb`               | `metadata->>'outcome'` filter for `wonPastRfps` group |
| `created_at`     | `timestamp`           | Returned in result objects |
| `updated_at`     | `timestamp`           | Returned in result objects |
| `customer_id`    | `uuid` FK nullable    | Present in result objects; not used as filter in F7 |
| `chunk_index`    | `integer`             | Present in result objects; not filtered in F7 |
| `processing_status` | `text` enum        | Not filtered in F7 (all entries assumed eligible per spec §Out of Scope) |

**Existing indexes used:**
- `knowledge_org_idx` on `organization_id` — used by all four type-filtered queries
- pgvector HNSW/IVFFlat index on `embedding` — used by per-requirement similarity queries

**Note on `outcome` for `past_rfp` entries:**
The `knowledge_entries` table has no dedicated `outcome` column. Past-proposal documents are
uploaded by users and stored with type `past_rfp`. A won past RFP is identified by the presence of
`metadata->>'outcome' = 'won'` in the JSONB `metadata` column. This convention must be enforced at
ingestion time (F8 or the knowledge upload flow). The F7 retrieval layer filters on this convention
but does not enforce or validate it.

**TypeScript type note:** The Drizzle `metadata` column is typed as
`{ sourceFile?: string; sourceUrl?: string; pageNumbers?: number[]; tags?: string[] }`.
The `outcome` key is not present in this TypeScript type definition, so accessing
`metadata?.outcome` at the application layer will require a type assertion or an explicit
type-narrowing cast (e.g., `(entry.metadata as { outcome?: string } | null)?.outcome`).
The raw SQL filter `metadata->>'outcome' = 'won'` operates at the Postgres JSONB level and is
unaffected by the TypeScript type definition — it will correctly filter entries where the key
exists at runtime. Implementors must be aware of this typed/runtime gap and use a cast when
reading `outcome` from the returned `KnowledgeEntry` object.

---

### `customers`

| Column          | Type                | Usage in F7 |
|-----------------|---------------------|-------------|
| `id`            | `uuid` PK           | Lookup key in `fetchCustomerContext` |
| `organization_id` | `text` NOT NULL   | Mandatory WHERE predicate (tenant isolation) |
| `settings`      | `jsonb`             | Returned as `CustomerContext`; contains `preferredTone`, `industryContext`, `customInstructions` |
| `name`          | `text`              | Available in result but not required by F7 output types |

**Existing indexes used:**
- `customers_org_idx` on `organization_id` — used in `fetchCustomerContext`

**Tenant isolation:** Query uses `AND id = $customerId AND organization_id = $orgId` so a customer
from a different organisation can never be returned even if the caller presents a valid UUID.

---

### `learnings`

| Column           | Type              | Usage in F7 |
|------------------|-------------------|-------------|
| `id`             | `uuid` PK         | Returned in result objects |
| `organization_id`| `text` NOT NULL   | Mandatory WHERE predicate |
| `customer_id`    | `uuid` FK nullable| ORDER BY predicate: customer-matching rows first |
| `content`        | `text`            | Returned in result objects |
| `source_type`    | `text` enum       | Available in result objects |
| `created_by`     | `text`            | Available in result objects |
| `field_id`       | `text` nullable   | Available in result objects |
| `confidence`     | `real` nullable`  | Available in result objects |
| `created_at`     | `timestamp`       | Available for ordering (secondary sort if needed) |

**Existing indexes used:**
- `learnings_org_idx` on `organization_id` — used in `fetchLearnings`
- `learnings_customer_idx` on `customer_id` — used for customer-scoped ordering

**Ordering strategy:**
Drizzle `sql` template used for conditional ordering:
```sql
ORDER BY
  CASE WHEN customer_id = $customerId THEN 0 ELSE 1 END ASC,
  created_at ASC
```
This places customer-specific learnings first without excluding org-wide entries (FR-014).

**Note on `questionType` and `sourceMetadata` columns:**
The `learnings` Drizzle schema also includes `questionType: text('question_type')` and
`sourceMetadata: jsonb('source_metadata')`. These columns are present in the Drizzle-inferred
`Learning` type returned by `fetchLearnings`. F7 does not filter or sort on these columns but
they will be present in the returned `Learning[]` array. F8 (the pipeline) may use them as needed.

---

## TypeScript Type Contracts

These are the types exported from `src/lib/services/proposal-retrieval.ts`.
No new Drizzle schema types are introduced — all types derive from existing schema inference.

```typescript
// Re-exported from vector-search.ts — no redefinition
export type { KnowledgeEntryWithSimilarity } from '@/lib/services/vector-search'

// Input type for searchByRequirements
export interface RequirementField {
  id: string
  question: string
  type?: string  // forward-compat; not used for filtering in F7
}

// Output type for fetchTypedSupplierContext
export interface TypedSupplierContext {
  companyDocs:    KnowledgeEntry[]
  certifications: KnowledgeEntry[]
  caseStudies:    KnowledgeEntry[]
  wonPastRfps:    KnowledgeEntry[]
}

// Output type for fetchCustomerContext
// null when customer not found; Customer['settings'] may have no fields if settings is null
export type CustomerContext = NonNullable<Customer['settings']> | null

// fetchLearnings returns native Drizzle type
export type { Learning } from '@/lib/db/schema/learnings'
```

**Note:** `KnowledgeEntry` (without similarity) is used for the typed supplier context groups
because those are direct DB queries with no vector distance computation.

---

## No Migration Required

All queried columns and indexes already exist. This feature is schema-stable. The `metadata->>'outcome'`
JSONB path access requires no migration — it uses PostgreSQL's native JSONB operator supported by
Drizzle's `sql` template.
