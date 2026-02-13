# Quickstart: P0 Critical Gaps

## Prerequisites

- Node.js 18.19.1+ (system version)
- Running Neon PostgreSQL with pgvector
- Vercel Blob configured (`BLOB_READ_WRITE_TOKEN`)
- Inngest Dev Server running (`npx inngest-cli@latest dev`)

## Setup

```bash
# Switch to feature branch
git checkout 002-p0-critical-gaps

# Install new dependencies
npm install react-pdf pdfjs-dist --legacy-peer-deps

# Run migration (adds completedFileError column)
npx drizzle-kit push

# Start dev server
npm run dev
```

## New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react-pdf` | `^9.x` | PDF viewer component for document preview |
| `pdfjs-dist` | `^4.x` | PDF.js worker (peer dep of react-pdf) |

## Key Files (New)

| File | Purpose |
|------|---------|
| `src/components/rfp/DocumentViewer.tsx` | PDF/Word document viewer (split view left side) |
| `src/app/(auth)/customers/page.tsx` | Customer list page |
| `src/app/(auth)/customers/[id]/page.tsx` | Customer detail page |
| `src/app/api/rfps/[rfpId]/download/route.ts` | Download completed document |
| `src/app/api/rfps/[rfpId]/document/route.ts` | Proxy original document |
| `src/lib/inngest/functions/generate-completed-document.ts` | Background doc generation |

## Key Files (Modified)

| File | Change |
|------|--------|
| `src/lib/db/schema/rfps.ts` | Add `completedFileError` field |
| `src/app/api/rfps/[rfpId]/finalize/route.ts` | Send `rfp/generate-completed-document` event |
| `src/app/(auth)/rfps/[id]/page.tsx` | Side-by-side layout with DocumentViewer |
| `src/components/rfp/RfpEditor.tsx` | Accept DocumentViewer as left panel |
| `src/app/(auth)/layout.tsx` | Add "Customers" nav link |

## Testing

```bash
# Run all tests
npm test

# Run only P0 tests
npm test -- --grep "document viewer|customer profile|download|completed document"
```

## Manual Verification

1. Upload a PDF RFP → process → review responses → finalize
2. Verify filled PDF appears for download on RFP detail page
3. Check side-by-side view shows original PDF on the left
4. Navigate to /customers, verify list shows RFP counts
5. Click a customer, verify detail page with settings and history
