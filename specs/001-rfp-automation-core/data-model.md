# Data Model: RFP Automation Core Platform

**Feature**: 001-rfp-automation-core
**Date**: 2026-02-04
**ORM**: Drizzle ORM with PostgreSQL + pgvector

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLERK (External)                                │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  Organization   │     │      User       │     │   Membership    │       │
│  │  (= Tenant)     │────▶│                 │◀────│                 │       │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│         │ org_id              │ user_id                                     │
└─────────┼─────────────────────┼─────────────────────────────────────────────┘
          │                     │
          ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEON (PostgreSQL)                               │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │ tenant_settings │◀─────────────────────────────────────────┐             │
│  │                 │                                           │             │
│  │ organization_id │                                           │             │
│  │ llm_provider    │                                           │             │
│  │ confidence_thr  │                                           │             │
│  └─────────────────┘                                           │             │
│         │                                                      │             │
│         │ 1:N                                                  │             │
│         ▼                                                      │             │
│  ┌─────────────────┐     ┌─────────────────┐                  │             │
│  │   customers     │────▶│ knowledge_entries│                  │             │
│  │                 │ 1:N │                 │                   │             │
│  │ organization_id │     │ customer_id     │                   │             │
│  │ name            │     │ organization_id │                   │             │
│  │ settings        │     │ type            │                   │             │
│  └─────────────────┘     │ content         │                   │             │
│         │                │ embedding (vec) │                   │             │
│         │                └─────────────────┘                   │             │
│         │ 1:N                     │                            │             │
│         ▼                         │ used for                   │             │
│  ┌─────────────────┐              │ retrieval                  │             │
│  │      rfps       │              │                            │             │
│  │                 │◀─────────────┘                            │             │
│  │ organization_id │                                           │             │
│  │ customer_id     │                                           │             │
│  │ assigned_user_id│                                           │             │
│  │ status          │                                           │             │
│  │ original_file   │                                           │             │
│  │ completed_file  │                                           │             │
│  └─────────────────┘                                           │             │
│         │                                                      │             │
│         │ 1:N                                                  │             │
│         ▼                                                      │             │
│  ┌─────────────────┐     ┌─────────────────┐                  │             │
│  │  rfp_responses  │     │   rfp_versions  │                  │             │
│  │                 │     │                 │                   │             │
│  │ rfp_id          │     │ rfp_id          │                   │             │
│  │ field_id        │     │ version_number  │                   │             │
│  │ response_text   │     │ snapshot (JSON) │                   │             │
│  │ confidence      │     │ created_by      │                   │             │
│  │ status          │     └─────────────────┘                   │             │
│  │ position (JSON) │                                           │             │
│  └─────────────────┘                                           │             │
│         │                                                      │             │
│         │ generates                                            │             │
│         ▼                                                      │             │
│  ┌─────────────────┐                                           │             │
│  │    learnings    │───────────────────────────────────────────┘             │
│  │                 │                                                         │
│  │ organization_id │                                                         │
│  │ customer_id     │ (optional)                                              │
│  │ content         │                                                         │
│  │ source_type     │                                                         │
│  └─────────────────┘                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Schema Definitions (Drizzle)

### Tenant Settings

```typescript
// src/lib/db/schema/tenant-settings.ts
import { pgTable, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";

export const tenantSettings = pgTable("tenant_settings", {
  // Primary key is the Clerk organization ID
  organizationId: text("organization_id").primaryKey(),

  // LLM configuration
  llmProvider: text("llm_provider", {
    enum: ["claude", "openai", "azure"],
  })
    .notNull()
    .default("claude"),
  llmApiKeyEncrypted: text("llm_api_key_encrypted"), // Encrypted with org-specific key

  // AI behavior settings
  confidenceThreshold: real("confidence_threshold").notNull().default(0.7),
  autoLearnEnabled: boolean("auto_learn_enabled").notNull().default(true),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TenantSettings = typeof tenantSettings.$inferSelect;
export type NewTenantSettings = typeof tenantSettings.$inferInsert;
```

### Customers (End-Customers)

```typescript
// src/lib/db/schema/customers.ts
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const customers = pgTable(
  "customers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(),

    // Customer info
    name: text("name").notNull(),
    description: text("description"),

    // Customer-specific settings
    settings: jsonb("settings").$type<{
      preferredTone?: "formal" | "casual" | "technical";
      industryContext?: string;
      customInstructions?: string;
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("customers_org_idx").on(table.organizationId),
  })
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
```

### Knowledge Entries

```typescript
// src/lib/db/schema/knowledge-entries.ts
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { customers } from "./customers";

export const knowledgeEntryTypes = [
  "past_rfp",
  "case_study",
  "certification",
  "company_doc",
  "manual_entry",
] as const;

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    // Content
    type: text("type", { enum: knowledgeEntryTypes }).notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),

    // Vector embedding for semantic search (OpenAI ada-002: 1536 dimensions)
    embedding: vector("embedding", { dimensions: 1536 }),

    // Source metadata
    metadata: jsonb("metadata").$type<{
      sourceFile?: string;
      sourceUrl?: string;
      pageNumbers?: number[];
      tags?: string[];
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("knowledge_org_idx").on(table.organizationId),
    customerIdx: index("knowledge_customer_idx").on(table.customerId),
    // HNSW index for fast vector search (created via migration)
    // embeddingIdx: index("knowledge_embedding_idx").using("hnsw", table.embedding),
  })
);

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;
```

### RFPs

```typescript
// src/lib/db/schema/rfps.ts
import {
  pgTable,
  text,
  timestamp,
  date,
  real,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { customers } from "./customers";

export const rfpStatuses = [
  "draft",
  "processing",
  "submitted",
  "approved",
  "finalized",
] as const;

export const rfps = pgTable(
  "rfps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    assignedUserId: text("assigned_user_id").notNull(), // Clerk user ID

    // RFP metadata
    name: text("name").notNull(),
    status: text("status", { enum: rfpStatuses }).notNull().default("draft"),

    // Contact info
    customerCompanyName: text("customer_company_name"),
    customerContactName: text("customer_contact_name"),
    customerContactInfo: jsonb("customer_contact_info").$type<{
      email?: string;
      phone?: string;
      address?: string;
    }>(),

    // Dates
    receiveDate: date("receive_date"),
    dueDate: date("due_date"),
    completionDate: date("completion_date"),

    // Files (Vercel Blob URLs)
    originalFileUrl: text("original_file_url"),
    originalFileType: text("original_file_type", { enum: ["pdf", "docx"] }),
    completedFileUrl: text("completed_file_url"),

    // Processing state
    automationPercentage: real("automation_percentage").default(0),
    version: integer("version").notNull().default(1),

    // Parsed document structure (cached)
    parsedStructure: jsonb("parsed_structure").$type<{
      pages: number;
      fields: Array<{
        id: string;
        type: "text" | "paragraph" | "checkbox" | "table";
        question: string;
        position: { page: number; x: number; y: number; width: number; height: number };
      }>;
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("rfps_org_idx").on(table.organizationId),
    customerIdx: index("rfps_customer_idx").on(table.customerId),
    userIdx: index("rfps_user_idx").on(table.assignedUserId),
    statusIdx: index("rfps_status_idx").on(table.status),
  })
);

export type Rfp = typeof rfps.$inferSelect;
export type NewRfp = typeof rfps.$inferInsert;
export type RfpStatus = (typeof rfpStatuses)[number];
```

### RFP Responses

```typescript
// src/lib/db/schema/rfp-responses.ts
import {
  pgTable,
  text,
  timestamp,
  real,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { rfps } from "./rfps";

export const responseStatuses = [
  "auto_filled",
  "needs_input",
  "manually_filled",
  "approved",
] as const;

export const fieldTypes = [
  "text",
  "paragraph",
  "checkbox",
  "table",
  "date",
  "number",
] as const;

export const rfpResponses = pgTable(
  "rfp_responses",
  {
    id: text("id").primaryKey(),
    rfpId: text("rfp_id")
      .notNull()
      .references(() => rfps.id, { onDelete: "cascade" }),

    // Field identification
    fieldId: text("field_id").notNull(), // Unique within RFP
    fieldType: text("field_type", { enum: fieldTypes }).notNull(),
    question: text("question").notNull(), // Extracted question text

    // Response content
    responseText: text("response_text"),
    confidenceScore: real("confidence_score"), // 0-1
    status: text("status", { enum: responseStatuses })
      .notNull()
      .default("needs_input"),

    // Position for overlay output
    position: jsonb("position").$type<{
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize?: number;
    }>(),

    // AI generation metadata
    aiMetadata: jsonb("ai_metadata").$type<{
      originalResponse?: string; // Before user edits
      sources?: string[]; // Knowledge entry IDs used
      modelUsed?: string;
      generatedAt?: string;
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    rfpIdx: index("responses_rfp_idx").on(table.rfpId),
    statusIdx: index("responses_status_idx").on(table.status),
  })
);

export type RfpResponse = typeof rfpResponses.$inferSelect;
export type NewRfpResponse = typeof rfpResponses.$inferInsert;
export type ResponseStatus = (typeof responseStatuses)[number];
```

### RFP Versions

```typescript
// src/lib/db/schema/rfp-versions.ts
import { pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { rfps } from "./rfps";

export const rfpVersions = pgTable(
  "rfp_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    rfpId: text("rfp_id")
      .notNull()
      .references(() => rfps.id, { onDelete: "cascade" }),

    versionNumber: integer("version_number").notNull(),
    createdBy: text("created_by").notNull(), // Clerk user ID

    // Snapshot of all responses at this version
    snapshot: jsonb("snapshot").$type<{
      responses: Array<{
        fieldId: string;
        responseText: string;
        status: string;
      }>;
      automationPercentage: number;
    }>(),

    // Change summary
    changeSummary: text("change_summary"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    rfpIdx: index("versions_rfp_idx").on(table.rfpId),
    versionIdx: index("versions_number_idx").on(table.rfpId, table.versionNumber),
  })
);

export type RfpVersion = typeof rfpVersions.$inferSelect;
export type NewRfpVersion = typeof rfpVersions.$inferInsert;
```

### Learnings

```typescript
// src/lib/db/schema/learnings.ts
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { customers } from "./customers";

export const learningSourceTypes = [
  "rfp_approval",     // Auto-learned from approved RFP
  "user_correction",  // User edited AI response
  "manual_entry",     // User explicitly added feedback
] as const;

export const learnings = pgTable(
  "learnings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }), // Optional: can be org-wide

    // Learning content
    content: text("content").notNull(),
    sourceType: text("source_type", { enum: learningSourceTypes }).notNull(),
    createdBy: text("created_by").notNull(), // Clerk user ID

    // Source reference
    sourceMetadata: jsonb("source_metadata").$type<{
      rfpId?: string;
      fieldId?: string;
      originalText?: string;
      correctedText?: string;
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("learnings_org_idx").on(table.organizationId),
    customerIdx: index("learnings_customer_idx").on(table.customerId),
  })
);

export type Learning = typeof learnings.$inferSelect;
export type NewLearning = typeof learnings.$inferInsert;
```

## Index Strategy

### Primary Indexes (Created with Tables)

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| customers | customers_org_idx | organization_id | Tenant filtering |
| knowledge_entries | knowledge_org_idx | organization_id | Tenant filtering |
| knowledge_entries | knowledge_customer_idx | customer_id | Customer filtering |
| rfps | rfps_org_idx | organization_id | Tenant filtering |
| rfps | rfps_customer_idx | customer_id | Customer RFP list |
| rfps | rfps_user_idx | assigned_user_id | User's RFPs |
| rfps | rfps_status_idx | status | Status filtering |
| rfp_responses | responses_rfp_idx | rfp_id | RFP responses lookup |
| learnings | learnings_org_idx | organization_id | Tenant filtering |

### Vector Index (Created via Migration)

```sql
-- Migration: 0002_add_vector_index.sql
CREATE INDEX knowledge_embedding_idx
ON knowledge_entries
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

HNSW parameters:
- `m = 16`: Number of connections per node (balance speed/recall)
- `ef_construction = 64`: Build-time quality parameter

## Validation Rules

### Tenant Isolation

All queries MUST include organization_id filter:

```typescript
// ✅ Correct
const rfps = await db.query.rfps.findMany({
  where: eq(rfps.organizationId, orgId),
});

// ❌ Wrong - exposes cross-tenant data
const rfps = await db.query.rfps.findMany();
```

### State Transitions

RFP status transitions are enforced:

```
draft ──────────────────────────────────────────┐
  │                                              │
  ▼                                              │
processing ────▶ draft (on error/retry)         │
  │                                              │
  ▼                                              │
draft ──────────▶ submitted ──────────▶ draft   │
                       │          (return)       │
                       ▼                         │
                  approved ──────────▶ finalized │
                                          │      │
                                          ▼      │
                                     new version─┘
```

Valid transitions:
- `draft` → `processing` (start AI processing)
- `processing` → `draft` (processing complete or error)
- `draft` → `submitted` (user submits for review)
- `submitted` → `draft` (admin returns for revision)
- `submitted` → `approved` (admin approves)
- `approved` → `finalized` (admin finalizes)
- `finalized` → creates new version, back to `draft`

### Field Validation (Zod Schemas)

```typescript
// src/lib/utils/validation.ts
import { z } from "zod";

export const createRfpSchema = z.object({
  name: z.string().min(1).max(255),
  customerId: z.string().cuid2(),
  customerCompanyName: z.string().max(255).optional(),
  customerContactName: z.string().max(255).optional(),
  customerContactInfo: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(500).optional(),
    })
    .optional(),
  receiveDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
});

export const updateResponseSchema = z.object({
  responseText: z.string().max(50000), // 50KB max
  status: z.enum(["auto_filled", "needs_input", "manually_filled", "approved"]),
});

export const createKnowledgeEntrySchema = z.object({
  customerId: z.string().cuid2(),
  type: z.enum(["past_rfp", "case_study", "certification", "company_doc", "manual_entry"]),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(500000), // 500KB max
  metadata: z
    .object({
      tags: z.array(z.string().max(50)).max(20).optional(),
    })
    .optional(),
});
```

## Migration Strategy

1. **Initial migration**: Create all tables with indexes
2. **pgvector extension**: `CREATE EXTENSION IF NOT EXISTS vector;`
3. **HNSW index**: Add after data migration for efficiency
4. **Clerk webhook handler**: Sync organization creation to tenant_settings
