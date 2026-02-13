# Research: P0 Critical Gaps

**Branch**: `002-p0-critical-gaps` | **Date**: 2026-02-13

## R1: PDF Viewer Library

**Decision**: `react-pdf` (v9.x) with `pdfjs-dist` worker

**Rationale**: Most widely used React PDF viewer (3M+ weekly downloads). Renders PDFs using Mozilla's pdf.js. Supports page navigation, zoom, and text selection. Compatible with Next.js via dynamic import.

**Alternatives Considered**:
- `@react-pdf-viewer/core` — More features but heavier bundle, more complex setup
- Raw `pdfjs-dist` — Lower level, would need to build UI wrapper ourselves
- `iframe` with blob URL — Simplest but no page navigation, no scroll-to-page API

**Compatibility Note**: `react-pdf` v9.x requires `pdfjs-dist` v4.x. Must use `next/dynamic` with `{ ssr: false }` to avoid server-side rendering issues. Worker file loaded from CDN or copied to public/.

**Bundle Impact**: ~180KB gzipped (within 200KB budget). Loaded only on RFP detail page via code splitting.

## R2: Word Document Preview

**Decision**: Use existing `mammoth` library to convert DOCX → HTML, render in a styled container

**Rationale**: `mammoth` is already a dependency (`^1.11.0`). It produces clean HTML from DOCX that preserves headings, lists, tables, and basic formatting. No additional dependency needed.

**Alternatives Considered**:
- `docx-preview` — Renders DOCX with better fidelity but adds ~100KB and has limited React support
- Convert to PDF server-side then use PDF viewer — Adds complexity, requires LibreOffice or similar
- iframe with Google Docs viewer — Requires public URL, breaks tenant isolation

**Approach**: Fetch original DOCX from Vercel Blob on the client, pass to mammoth's `convertToHtml()`, render result in a scrollable container with sanitized HTML.

## R3: PDF Overlay Output

**Decision**: Use existing `pdf-output.ts` (`pdf-lib`) — already implemented, just not wired up

**Rationale**: `generatePdfOutput()` in `src/lib/documents/pdf-output.ts` already handles:
- Loading original PDF buffer
- Overlaying response text at exact field positions
- Text wrapping for long content
- Returning modified PDF as Buffer

**What's Missing**: The finalization workflow doesn't call it. Need to:
1. Create Inngest function to trigger on finalization
2. Download original PDF from Vercel Blob
3. Fetch all responses for the RFP
4. Call `generatePdfOutput()` with original + responses
5. Upload result to Vercel Blob
6. Update `completedFileUrl` on the RFP

## R4: Word Output Generation

**Decision**: Enhance existing `word-output.ts` (`docx` library) to preserve original document structure

**Rationale**: Current `generateWordOutput()` creates a standalone DOCX — it doesn't use the original. For format-preserving export, we need to:
1. Parse original DOCX to understand structure (mammoth gives us HTML, but `docx` library works with XML)
2. Insert responses into the original document structure

**Revised Approach**: Since modifying the original DOCX XML is complex and fragile:
- For V1: Generate a new DOCX that mirrors the original structure (headings, sections) with responses filled in
- The `docx` library can create styled documents with the field questions as section headers and responses as content
- Flag this as a known limitation: formatting won't be pixel-perfect like PDF overlay

**Alternatives Considered**:
- LibreOffice headless conversion — Requires server binary, not viable on Vercel serverless
- python-docx via API — Adds Python service dependency
- Template-based approach — Requires pre-made templates per customer

## R5: Customer Profile UI

**Decision**: Build customer list and detail pages using existing API routes + shadcn/ui

**Rationale**: The customer CRUD API already exists with full tenant isolation:
- GET/POST `/api/customers`
- GET/PATCH/DELETE `/api/customers/[customerId]`
- Customer detail already returns stats (knowledgeEntries count, totalRfps)

**What's Missing**: UI pages and navigation. Need:
- `/customers` list page (table with name, RFP count, KB entries, created date)
- `/customers/[id]` detail page (profile, settings editor, RFP history tab, KB entries tab)
- Customer selector component for RFP creation
- Customer name on dashboard RFP cards

**Settings Schema** (already in DB):
```typescript
{
  preferredTone: 'formal' | 'casual' | 'technical'
  industryContext: string  // max 500 chars
  customInstructions: string  // max 2000 chars
}
```

## R6: Inngest Finalization Pipeline

**Decision**: New Inngest function `rfp/generate-completed-document`

**Rationale**: Document generation (especially PDF overlay) can take several seconds. Running it as a background job keeps the finalization API response fast and allows retry on failure.

**Event payload**:
```typescript
{
  name: 'rfp/generate-completed-document',
  data: { rfpId: string, organizationId: string }
}
```

**Pipeline**:
1. Fetch RFP record (get originalFileUrl, originalFileType)
2. Download original file from Vercel Blob
3. Fetch all responses for the RFP
4. If PDF: call `generatePdfOutput()`; if Word: call `generateWordOutput()`
5. Upload result to Vercel Blob at `rfps/{orgId}/{rfpId}/completed.{ext}`
6. Update RFP record: set `completedFileUrl`

**Error handling**: If generation fails, set a `completedFileError` field (or leave `completedFileUrl` null). User can still download markdown as fallback.
