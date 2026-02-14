# Data Model: P1 — Accuracy Flywheel

## Schema Changes

### Modified: `rfps` table

New columns (all nullable for backward compatibility):

| Column | Type | Description |
|--------|------|-------------|
| `rfpType` | `text` | Classification: `'technical' \| 'commercial' \| 'compliance' \| 'mixed'` |
| `complexity` | `text` | Complexity: `'simple' \| 'medium' \| 'complex'` |
| `industryTags` | `jsonb` | Array of industry tag strings, e.g. `["healthcare", "government"]` |
| `suggestedAssigneeId` | `text` | Suggested user ID based on classification + workload |

Indexes:
- `idx_rfps_type` on `(organizationId, rfpType)` — for dashboard filtering
- `idx_rfps_complexity` on `(organizationId, complexity)` — for dashboard filtering

### Modified: `proposalContentLibrary` table

New columns:

| Column | Type | Description |
|--------|------|-------------|
| `embedding` | `vector(1536)` | OpenAI ada-002 embedding for semantic search |

### Modified: `knowledgeEntries` table

New columns:

| Column | Type | Description |
|--------|------|-------------|
| `chunkIndex` | `integer` | Position of this chunk within source document (null for non-chunked) |
| `totalChunks` | `integer` | Total chunks from source document (null for non-chunked) |
| `sectionHeading` | `text` | Heading of the section this chunk belongs to (null if unstructured) |
| `tags` | `jsonb` | Auto-generated topic tags, e.g. `["compliance", "pricing"]` |
| `sourceEntryId` | `uuid` | Self-reference to parent entry if this is a chunk (null for original uploads) |
| `processingStatus` | `text` | `'pending' \| 'chunking' \| 'embedding' \| 'complete' \| 'error'` (default: `'complete'` for existing) |

Indexes:
- `idx_ke_source_entry` on `(sourceEntryId)` — for looking up chunks of a document
- `idx_ke_processing` on `(organizationId, processingStatus)` — for monitoring

### Modified: `learnings` table

New columns:

| Column | Type | Description |
|--------|------|-------------|
| `sourceType` | Already exists | Add new enum values: `'accept_signal' \| 'edit_correction' \| 'reject_signal'` to existing `'rfp_approval' \| 'user_correction' \| 'manual_entry'` |
| `fieldId` | `text` | The response field this learning relates to (nullable) |
| `questionType` | `text` | The field type from the RFP (e.g., "pricing", "technical", "compliance") |
| `confidence` | `real` | Original AI confidence score for the response (for signal analysis) |

## Entity Relationships

```
Customer 1──∞ RFP
  │                ├── rfpType (new)
  │                ├── complexity (new)
  │                ├── suggestedAssigneeId (new)
  │                └── responses[] ──→ Learning (via fieldId)
  │
  ├── settings (preferredTone, industryContext, customInstructions)
  │     └──→ injected into response generator system prompt (US1)
  │
  ├──∞ KnowledgeEntry
  │     ├── embedding (existing)
  │     ├── chunkIndex (new, for chunked docs)
  │     ├── tags (new, auto-generated)
  │     └── sourceEntryId (new, self-ref for chunks)
  │
  └──∞ Learning
        ├── sourceType (extended with accept/edit/reject)
        ├── fieldId (new)
        └── questionType (new)

Organization 1──∞ ProposalContentLibrary
                    └── embedding (new, for semantic search)
```

## Event Types (Inngest)

New events to add to `src/lib/inngest/client.ts`:

```typescript
'rfp/capture-learning': {
  data: {
    type: 'accept' | 'edit' | 'reject'
    rfpId: string
    fieldId: string
    organizationId: string
    customerId?: string
    userId: string
    originalText?: string
    correctedText?: string
    questionType?: string
    confidence?: number
  }
}

'content-library/generate-embedding': {
  data: {
    entryId: string
    content: string
  }
}

'content-library/batch-embed': {
  data: {
    organizationId: string
  }
}

'knowledge/chunk-document': {
  data: {
    knowledgeEntryId: string
    organizationId: string
    customerId?: string
  }
}
```
