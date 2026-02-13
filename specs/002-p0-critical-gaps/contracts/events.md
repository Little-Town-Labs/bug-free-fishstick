# Inngest Events: P0 Critical Gaps

## New Event

### `rfp/generate-completed-document`

**Trigger**: RFP finalization (POST `/api/rfps/[rfpId]/finalize`)

**Payload**:
```typescript
{
  name: 'rfp/generate-completed-document',
  data: {
    rfpId: string      // UUID of the finalized RFP
    organizationId: string  // Clerk org ID for tenant scoping
  }
}
```

**Function**: `generate-completed-document`

**Steps**:
1. `fetch-rfp` — Load RFP record, validate status is `finalized`
2. `download-original` — Fetch original document from Vercel Blob
3. `fetch-responses` — Load all `rfp_responses` for this RFP
4. `generate-output` — Call `generatePdfOutput()` or `generateWordOutput()` based on `originalFileType`
5. `upload-completed` — Upload result to Vercel Blob at `rfps/{orgId}/{rfpId}/completed.{ext}`
6. `update-rfp` — Set `completedFileUrl` on RFP record (or `completedFileError` on failure)

**Retry policy**: 3 attempts with exponential backoff

**Error handling**: On final failure, set `completedFileError` with error message. User sees fallback to markdown export.

## Modified Event

### `rfp/finalize` (existing)

**Change**: After status update to `FINALIZED`, also send `rfp/generate-completed-document` event.
