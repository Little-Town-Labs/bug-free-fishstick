# Data Model: KB-Driven Draft Intelligence

## Schema Changes

### 1. New Column: `rfps.extractedMetadata` (Migration Required)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| extractedMetadata | JSONB | Nullable | AI-extracted metadata from inbound RFP document |

**JSONB Shape:**
```typescript
interface ExtractedRfpMetadata {
  title: string | null           // Exact title from document
  issuingOrganization: string | null  // Organization that issued the RFP
  referenceNumber: string | null      // RFP ID/number (e.g., "RFP-2026-089")
  submissionDeadline: string | null   // Deadline as stated in document (free text, not parsed date)
  projectStartDate: string | null     // Start date as stated in document
  contactName: string | null          // RFP contact person
  contactEmail: string | null         // RFP contact email
  contactPhone: string | null         // RFP contact phone
}
```

**Notes:**
- Dates stored as free text strings (preserving original formatting), not parsed timestamps
- All fields nullable — extraction is best-effort
- Existing columns (`dueDate`, `customerCompanyName`) are auto-populated from this metadata only when null (user data takes precedence)

### 2. Extended Interface: `ClarifyingQuestion` (No Migration)

**Current:**
```typescript
interface ClarifyingQuestion {
  id: string
  question: string
  rfpSection: string
  answer: string | null
}
```

**Extended:**
```typescript
interface ClarifyingQuestion {
  id: string
  question: string
  rfpSection: string
  answer: string | null
  // New fields (all optional for backward compatibility)
  suggestedAnswer?: string | null
  kbSourceId?: string | null
  kbSourceTitle?: string | null
  suggestionConfidence?: number | null
}
```

No migration needed — `clarifyingQuestions` is a JSONB column. Old rows without new fields remain valid. New fields are optional in TypeScript.

### 3. Extended Interface: `DocumentAnalysisResult` (No Migration)

**Current output:**
```typescript
interface DocumentAnalysisResult {
  fields: Array<{ id, type, question, position }>
  summary: string
}
```

**Extended output:**
```typescript
interface DocumentAnalysisResult {
  fields: Array<{ id, type, question, position }>
  summary: string
  // New structured metadata
  metadata: {
    title: string | null
    issuingOrganization: string | null
    referenceNumber: string | null
    submissionDeadline: string | null
    projectStartDate: string | null
    contactName: string | null
    contactEmail: string | null
    contactPhone: string | null
  }
}
```

No migration — this is an in-memory type returned by the AI agent.

## Relationships

- `rfps.extractedMetadata` is populated during `process-rfp` Step 4 (analyze-document)
- `rfps.extractedMetadata` is read during `generate-proposal` Step 8 (generate-proposal-content) and passed to proposal writer
- `proposal_drafts.clarifyingQuestions` JSONB gains optional suggestion fields during draft creation
- `knowledge_entries.customerId` is used in the boosted search query (existing relationship, no change)

## Indexes

No new indexes required. Existing indexes on `knowledge_entries` (org, customer, embedding) are sufficient.

**Recommended (deferred):** Add a pgvector HNSW index on `knowledge_entries.embedding` for production scale:
```sql
CREATE INDEX knowledge_entries_embedding_hnsw_idx
  ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
```
This is a performance optimization, not required for correctness.

## Migration

Single migration file: `drizzle/0009_kb_driven_draft_intelligence.sql`

```sql
ALTER TABLE rfps ADD COLUMN extracted_metadata jsonb;
```

One line. All other changes are TypeScript interface extensions on existing JSONB columns.
