# Inngest Event Definitions

**Feature**: 001-rfp-automation-core
**Date**: 2026-02-04

## Event Schema

All events follow this base structure:

```typescript
interface InngestEvent<T extends string, D> {
  name: T;
  data: D;
  ts: number; // Unix timestamp
}
```

---

## RFP Events

### `rfp/uploaded`

Triggered when a new RFP document is uploaded.

```typescript
interface RfpUploadedEvent {
  name: "rfp/uploaded";
  data: {
    rfpId: string;
    organizationId: string;
    customerId: string;
    userId: string;
    fileUrl: string;
    fileType: "pdf" | "docx";
    fileName: string;
    fileSize: number;
  };
}
```

**Triggers**: `processRfp` function

---

### `rfp/processing.started`

Emitted when AI processing begins.

```typescript
interface RfpProcessingStartedEvent {
  name: "rfp/processing.started";
  data: {
    rfpId: string;
    organizationId: string;
    jobId: string;
    startedAt: string; // ISO timestamp
  };
}
```

**Used for**: UI status updates via polling

---

### `rfp/processing.progress`

Emitted at each processing step.

```typescript
interface RfpProcessingProgressEvent {
  name: "rfp/processing.progress";
  data: {
    rfpId: string;
    organizationId: string;
    jobId: string;
    step:
      | "parsing"
      | "extracting"
      | "embedding"
      | "retrieving"
      | "generating"
      | "checking"
      | "saving";
    progress: number; // 0-100
    message?: string;
    fieldsProcessed?: number;
    fieldsTotal?: number;
  };
}
```

**Used for**: Real-time progress UI

---

### `rfp/processing.complete`

Emitted when processing finishes successfully.

```typescript
interface RfpProcessingCompleteEvent {
  name: "rfp/processing.complete";
  data: {
    rfpId: string;
    organizationId: string;
    jobId: string;
    completedAt: string; // ISO timestamp
    stats: {
      totalFields: number;
      autoFilled: number;
      needsInput: number;
      automationPercentage: number;
      processingTimeMs: number;
    };
  };
}
```

**Side effects**:
- Updates RFP status to `draft`
- Clears processing status from KV

---

### `rfp/processing.failed`

Emitted when processing fails.

```typescript
interface RfpProcessingFailedEvent {
  name: "rfp/processing.failed";
  data: {
    rfpId: string;
    organizationId: string;
    jobId: string;
    failedAt: string; // ISO timestamp
    error: {
      code: string;
      message: string;
      step?: string;
      recoverable: boolean;
    };
  };
}
```

**Side effects**:
- Updates RFP status to `draft`
- Stores error in processing status
- May trigger notification

---

### `rfp/status.changed`

Emitted on workflow status transitions.

```typescript
interface RfpStatusChangedEvent {
  name: "rfp/status.changed";
  data: {
    rfpId: string;
    organizationId: string;
    previousStatus: RfpStatus;
    newStatus: RfpStatus;
    changedBy: string; // User ID
    comments?: string; // For returns
  };
}
```

**Used for**: Audit logging, notifications

---

### `rfp/export.requested`

Triggered when user requests document export.

```typescript
interface RfpExportRequestedEvent {
  name: "rfp/export.requested";
  data: {
    rfpId: string;
    organizationId: string;
    userId: string;
    format: "pdf" | "docx" | "json";
  };
}
```

**Triggers**: `exportRfp` function (generates overlay document)

---

### `rfp/export.complete`

Emitted when export is ready.

```typescript
interface RfpExportCompleteEvent {
  name: "rfp/export.complete";
  data: {
    rfpId: string;
    organizationId: string;
    userId: string;
    format: "pdf" | "docx" | "json";
    fileUrl: string;
    expiresAt: string; // ISO timestamp (signed URL expiry)
  };
}
```

---

## Knowledge Base Events

### `knowledge/document.uploaded`

Triggered when a document is added to knowledge base.

```typescript
interface KnowledgeDocumentUploadedEvent {
  name: "knowledge/document.uploaded";
  data: {
    entryId: string;
    organizationId: string;
    customerId: string;
    userId: string;
    type: KnowledgeEntryType;
    title: string;
    fileUrl?: string;
    contentLength: number;
  };
}
```

**Triggers**: `generateEmbeddings` function

---

### `knowledge/embeddings.generated`

Emitted when embeddings are created.

```typescript
interface KnowledgeEmbeddingsGeneratedEvent {
  name: "knowledge/embeddings.generated";
  data: {
    entryId: string;
    organizationId: string;
    customerId: string;
    embeddingDimensions: number;
    chunksCreated: number;
    processingTimeMs: number;
  };
}
```

---

## Learning Events

### `learning/correction.recorded`

Triggered when user edits an AI response.

```typescript
interface LearningCorrectionRecordedEvent {
  name: "learning/correction.recorded";
  data: {
    learningId: string;
    organizationId: string;
    customerId?: string;
    rfpId: string;
    fieldId: string;
    userId: string;
    originalText: string;
    correctedText: string;
  };
}
```

**Side effects**: May trigger embedding regeneration

---

### `learning/rfp.approved`

Triggered when RFP is approved (for auto-learning).

```typescript
interface LearningRfpApprovedEvent {
  name: "learning/rfp.approved";
  data: {
    rfpId: string;
    organizationId: string;
    customerId: string;
    approvedBy: string;
    responseCount: number;
  };
}
```

**Triggers**: `extractLearnings` function (if autoLearnEnabled)

---

## Webhook Events (from Clerk)

### `clerk/organization.created`

Syncs new Clerk organization to tenant_settings.

```typescript
// Handled by /api/webhooks/clerk route
interface ClerkOrganizationCreatedEvent {
  type: "organization.created";
  data: {
    id: string; // Organization ID
    name: string;
    slug: string;
    created_by: string; // User ID
  };
}
```

**Side effects**: Creates tenant_settings row with defaults

---

### `clerk/organization.deleted`

Handles organization deletion.

```typescript
interface ClerkOrganizationDeletedEvent {
  type: "organization.deleted";
  data: {
    id: string;
  };
}
```

**Side effects**:
- Soft-delete or cascade tenant data
- Clean up Vercel Blob files

---

## Event Flow Diagrams

### RFP Processing Flow

```
User uploads document
        │
        ▼
┌───────────────────────┐
│  rfp/uploaded         │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  processRfp function  │──────┐
│  (Inngest)            │      │
└───────────────────────┘      │
        │                      │
        ▼                      │ on each step
┌───────────────────────┐      │
│ rfp/processing.started│      │
└───────────────────────┘      │
        │                      │
        ▼                      ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Parse document        │───▶│ rfp/processing.progress│
└───────────────────────┘    │ step: "parsing"        │
        │                    └───────────────────────┘
        ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Extract fields        │───▶│ rfp/processing.progress│
└───────────────────────┘    │ step: "extracting"     │
        │                    └───────────────────────┘
        ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Generate embeddings   │───▶│ rfp/processing.progress│
└───────────────────────┘    │ step: "embedding"      │
        │                    └───────────────────────┘
        ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Query knowledge base  │───▶│ rfp/processing.progress│
└───────────────────────┘    │ step: "retrieving"     │
        │                    └───────────────────────┘
        ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Generate AI responses │───▶│ rfp/processing.progress│
└───────────────────────┘    │ step: "generating"     │
        │                    └───────────────────────┘
        ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Quality check & score │───▶│ rfp/processing.progress│
└───────────────────────┘    │ step: "checking"       │
        │                    └───────────────────────┘
        ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Save results          │───▶│ rfp/processing.progress│
└───────────────────────┘    │ step: "saving"         │
        │                    └───────────────────────┘
        ▼
┌───────────────────────┐
│ rfp/processing.complete│
└───────────────────────┘
```

### Knowledge Base Update Flow

```
User uploads KB document
        │
        ▼
┌───────────────────────────┐
│ knowledge/document.uploaded│
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ generateEmbeddings func   │
│ (Inngest)                 │
└───────────────────────────┘
        │
        ├── Chunk content
        ├── Generate embeddings
        ├── Store in pgvector
        │
        ▼
┌─────────────────────────────┐
│ knowledge/embeddings.generated│
└─────────────────────────────┘
```

---

## Inngest Function Registry

```typescript
// src/lib/inngest/functions/index.ts

export const functions = [
  // RFP Processing
  processRfp,           // rfp/uploaded → full processing pipeline
  exportRfp,            // rfp/export.requested → generate overlay doc

  // Knowledge Base
  generateEmbeddings,   // knowledge/document.uploaded → create vectors

  // Learning
  extractLearnings,     // learning/rfp.approved → auto-learn from approval

  // Maintenance
  cleanupExpiredExports, // cron: daily → remove old export files
];
```
