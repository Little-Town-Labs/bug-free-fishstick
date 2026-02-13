# Data Model: P0 Critical Gaps

**Branch**: `002-p0-critical-gaps` | **Date**: 2026-02-13

## Schema Changes

### No New Tables Required

All three P0 features build on existing tables. The changes are field additions and UI pages.

### Modified Tables

#### `rfps` — Add completed document fields

```typescript
// Existing fields (no change):
// originalFileUrl: text
// originalFileType: enum['pdf' | 'docx']
// completedFileUrl: text  ← EXISTS but never populated

// New field:
completedFileError: text  // null if success, error message if generation failed
```

**Migration**: Add `completedFileError` column (nullable text) to `rfps` table.

#### `customers` — No schema changes needed

The existing `customers` table already has all required fields:
- `id`, `organizationId`, `name`, `description`
- `settings` (JSONB with `preferredTone`, `industryContext`, `customInstructions`)
- `createdAt`, `updatedAt`

The customer detail API already returns stats (`knowledgeEntries`, `totalRfps`).

### Existing Relationships (unchanged)

```
customers 1──* rfps           (via rfps.customerId FK)
customers 1──* knowledge_entries  (via knowledge_entries.customerId, optional)
customers 1──* learnings          (via learnings.customerId, optional)
rfps      1──* rfp_responses      (via rfp_responses.rfpId FK)
```

## State Transitions

### Completed Document Generation (new)

```
RFP finalized
    ↓
Inngest: rfp/generate-completed-document
    ↓
completedFileUrl = null, completedFileError = null  (in progress)
    ↓
┌─── Success ───────────────────────────┐
│ completedFileUrl = blob URL           │
│ completedFileError = null             │
└───────────────────────────────────────┘
┌─── Failure ───────────────────────────┐
│ completedFileUrl = null               │
│ completedFileError = "error message"  │
└───────────────────────────────────────┘
```

## API Impact

### New Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/rfps/[rfpId]/download` | Redirect to `completedFileUrl` or return 404 |
| GET | `/api/rfps/[rfpId]/document` | Proxy original file for client-side rendering |

### Modified Routes

| Method | Route | Change |
|--------|-------|--------|
| POST | `/api/rfps/[rfpId]/finalize` | Also sends `rfp/generate-completed-document` Inngest event |
| GET | `/api/rfps/[rfpId]` | Response includes `completedFileUrl` and `completedFileError` |

### Existing Routes (no change, UI just needs to use them)

| Method | Route | Used For |
|--------|-------|----------|
| GET | `/api/customers` | Customer list page |
| GET | `/api/customers/[id]` | Customer detail page (includes stats) |
| PATCH | `/api/customers/[id]` | Edit customer settings |
| POST | `/api/customers` | Create customer |
| DELETE | `/api/customers/[id]` | Delete customer |

## File Storage Layout

```
Vercel Blob:
  rfps/{orgId}/{rfpId}/
    ├── original.pdf          (existing - uploaded document)
    └── completed.pdf         (NEW - filled document after finalization)

  knowledge/{orgId}/
    ├── company/{filename}    (existing - org-level KB docs)
    └── {customerId}/{filename}  (existing - customer KB docs)
```
