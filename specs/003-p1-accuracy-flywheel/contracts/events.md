# Inngest Event Contracts: P1 — Accuracy Flywheel

## New Events

### `rfp/capture-learning`
**Trigger**: POST `/api/rfps/{rfpId}/responses/{fieldId}/feedback`
**Handler**: `src/lib/inngest/functions/capture-learning.ts`

```typescript
{
  name: 'rfp/capture-learning',
  data: {
    type: 'accept' | 'edit' | 'reject',
    rfpId: string,
    fieldId: string,
    organizationId: string,
    customerId?: string,
    userId: string,
    originalText?: string,      // for edit/reject
    correctedText?: string,     // for edit
    questionType?: string,      // from field metadata
    confidence?: number         // original AI confidence
  }
}
```

**Behavior**:
- `accept`: Insert learning with `sourceType: 'accept_signal'`, content = question + response summary
- `edit`: Insert learning with `sourceType: 'edit_correction'`, content = diff summary (original → corrected)
- `reject`: Insert learning with `sourceType: 'reject_signal'`, content = question + rejection note

### `content-library/generate-embedding`
**Trigger**: Content library create/update, or batch-embed fan-out
**Handler**: `src/lib/inngest/functions/content-library-embedding.ts`

```typescript
{
  name: 'content-library/generate-embedding',
  data: {
    entryId: string,
    content: string
  }
}
```

**Behavior**: Generate embedding via `generateEmbedding(content)`, update `proposalContentLibrary.embedding`.

### `content-library/batch-embed`
**Trigger**: POST `/api/content-library/embed`
**Handler**: `src/lib/inngest/functions/content-library-embedding.ts`

```typescript
{
  name: 'content-library/batch-embed',
  data: {
    organizationId: string
  }
}
```

**Behavior**: Query all entries without embeddings, fan out `content-library/generate-embedding` events.

### `knowledge/chunk-document`
**Trigger**: POST `/api/customers/{customerId}/knowledge/upload` (when document > 2000 tokens)
**Handler**: `src/lib/inngest/functions/chunk-document.ts`

```typescript
{
  name: 'knowledge/chunk-document',
  data: {
    knowledgeEntryId: string,
    organizationId: string,
    customerId?: string
  }
}
```

**Behavior**:
1. Fetch parent entry content
2. Chunk by headings → paragraphs → sentences (max 1500 tokens, 200 overlap)
3. Insert child entries with `sourceEntryId`, `chunkIndex`, `totalChunks`, `sectionHeading`
4. Auto-tag each chunk (LLM call, up to 5 tags)
5. Fan out `rfp/generate-embeddings` for each chunk
6. Update parent entry `processingStatus: 'complete'`

## Modified Events

### `rfp/process` (existing)
**Change**: Add new step between step 4 (analyze) and step 5 (generate):
- **Step 4.5: classify-rfp** — Call LLM with parsed structure to determine `rfpType`, `complexity`, `industryTags`, `suggestedAssigneeId`
- **Step 5 modification**: Inject `customer.settings` into `generateResponses()` call as `customerContext`

### `rfp/generate-embeddings` (existing)
**No changes** — already handles single-entry embedding generation. Reused for KB chunks.
