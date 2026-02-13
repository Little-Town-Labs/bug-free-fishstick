# Data Model: Proposal Draft Generator

**Branch**: `001-proposal-draft-generator` | **Date**: 2026-02-12

## New Tables

---

### `proposal_content_library`

Stores reusable company-specific content entries (standards, pricing, services, boilerplate) at the organization level. All org members can create, edit, and delete entries.

| Column          | Type        | Constraints                    | Description                                              |
|-----------------|-------------|--------------------------------|----------------------------------------------------------|
| `id`            | `uuid`      | PK, default `gen_random_uuid()`| Unique identifier                                        |
| `organization_id` | `text`    | NOT NULL                       | Tenant scope — all queries must filter by this           |
| `category`      | `text`      | NOT NULL                       | Free-text category (e.g., "Pricing", "Service", "Standard", "Boilerplate") |
| `name`          | `text`      | NOT NULL                       | Short display name (e.g., "Standard SLA Terms")          |
| `content`       | `text`      | NOT NULL                       | The reusable content body (markdown supported)           |
| `created_by`    | `text`      | NOT NULL                       | Clerk user ID of creator                                 |
| `created_at`    | `timestamp` | NOT NULL, default NOW          |                                                          |
| `updated_at`    | `timestamp` | NOT NULL, default NOW          |                                                          |

**Indexes**:
- `content_library_org_idx` on `organization_id` (required for Constitution Principle I)
- `content_library_category_idx` on `(organization_id, category)` (filter by category efficiently)

**Relationships**: None (org-scoped only, no FK to customers or RFPs).

**Validation rules**:
- `category` and `name` must be non-empty strings (max 100 chars)
- `content` must be non-empty (max 50,000 chars)

---

### `proposal_drafts`

Tracks each proposal generation session for an RFP. Stores the generated clarifying questions (and user answers) and the final markdown content.

| Column                  | Type        | Constraints                            | Description |
|-------------------------|-------------|----------------------------------------|-------------|
| `id`                    | `uuid`      | PK, default `gen_random_uuid()`        |             |
| `rfp_id`                | `uuid`      | NOT NULL, FK → `rfps.id` ON DELETE CASCADE |         |
| `organization_id`       | `text`      | NOT NULL                               | Denormalized for fast scoped queries |
| `created_by`            | `text`      | NOT NULL                               | Clerk user ID who initiated generation |
| `status`                | `text`      | NOT NULL, default `awaiting_answers`   | See status enum below |
| `clarifying_questions`  | `jsonb`     | nullable                               | Array of `ClarifyingQuestion` objects (see type below) |
| `markdown_content`      | `text`      | nullable                               | The generated proposal markdown; null until generation completes |
| `generation_error`      | `text`      | nullable                               | Error message if status is `error` |
| `version`               | `integer`   | NOT NULL, default `1`                  | Increments on each re-generation |
| `created_at`            | `timestamp` | NOT NULL, default NOW                  |             |
| `updated_at`            | `timestamp` | NOT NULL, default NOW                  |             |

**Status Enum**: `awaiting_answers` | `generating` | `draft` | `finalized` | `error`

**Status Transitions**:
```
awaiting_answers
  └─[user submits answers]──► generating
                                └─[Inngest completes]──► draft
                                └─[Inngest fails]──────► error
draft
  └─[user finalizes]──────────► finalized
```

**`ClarifyingQuestion` JSONB type**:
```typescript
{
  id: string           // e.g., "q1"
  question: string     // The question text shown to user
  rfpSection: string   // Which RFP section prompted this question
  answer: string | null // null until user submits
}
```

**Indexes**:
- `proposal_drafts_rfp_idx` on `rfp_id`
- `proposal_drafts_org_idx` on `organization_id`

---

## Modified Tables

### `rfps` — No schema changes required.

Proposal drafts are linked via `proposal_drafts.rfp_id`. No new columns needed on the `rfps` table.

---

## Drizzle Schema Code (reference)

### `proposal-content-library.ts`

```typescript
import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'

export const proposalContentLibrary = pgTable(
  'proposal_content_library',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('content_library_org_idx').on(table.organizationId),
    index('content_library_category_idx').on(table.organizationId, table.category),
  ]
)

export type ProposalContentLibraryEntry = typeof proposalContentLibrary.$inferSelect
export type NewProposalContentLibraryEntry = typeof proposalContentLibrary.$inferInsert
```

### `proposal-drafts.ts`

```typescript
import { pgTable, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { rfps } from './rfps'

export const proposalDraftStatuses = [
  'awaiting_answers',
  'generating',
  'draft',
  'finalized',
  'error',
] as const
export type ProposalDraftStatus = (typeof proposalDraftStatuses)[number]

export interface ClarifyingQuestion {
  id: string
  question: string
  rfpSection: string
  answer: string | null
}

export const proposalDrafts = pgTable(
  'proposal_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rfpId: uuid('rfp_id').notNull().references(() => rfps.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').notNull(),
    createdBy: text('created_by').notNull(),
    status: text('status', { enum: proposalDraftStatuses })
      .notNull()
      .default('awaiting_answers'),
    clarifyingQuestions: jsonb('clarifying_questions')
      .$type<ClarifyingQuestion[]>(),
    markdownContent: text('markdown_content'),
    generationError: text('generation_error'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('proposal_drafts_rfp_idx').on(table.rfpId),
    index('proposal_drafts_org_idx').on(table.organizationId),
  ]
)

export type ProposalDraft = typeof proposalDrafts.$inferSelect
export type NewProposalDraft = typeof proposalDrafts.$inferInsert
```

---

## Migration

One new migration file will be created by running `npx drizzle-kit generate` after adding the schema files. The migration adds both new tables. No changes to existing tables.
