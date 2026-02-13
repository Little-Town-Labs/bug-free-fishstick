# Implementation Plan: P0 Critical Gaps

**Branch**: `002-p0-critical-gaps` | **Date**: 2026-02-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-p0-critical-gaps/spec.md`

## Summary

Close three critical P0 gaps: (1) format-preserving export using existing but unwired PDF overlay and Word output generators, (2) side-by-side document review with an inline PDF/Word viewer, and (3) end-customer profile UI pages leveraging the existing customer API.

Key discovery from research: **most backend infrastructure already exists**. The PDF overlay generator (`pdf-output.ts`), Word generator (`word-output.ts`), customer CRUD API, and document parsers are all implemented. The work is primarily wiring these into the finalization workflow and building UI.

## Technical Context

**Language/Version**: TypeScript 5.0+ (strict mode), Node.js 18.19.1
**Primary Dependencies**: Next.js 15, React 19, Drizzle ORM 0.45+, Inngest, Vercel AI SDK, shadcn/ui, react-pdf (new), pdfjs-dist (new)
**Storage**: Neon PostgreSQL + pgvector, Vercel Blob, Vercel KV
**Testing**: Vitest 2.x, jsdom 24.x, Playwright
**Target Platform**: Vercel serverless (Next.js App Router)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: <3s document parse (Constitution XIII), <500ms vector search (Constitution XV)
**Constraints**: Node 18 compatibility, legacy-peer-deps required, no SSR for PDF viewer
**Scale/Scope**: Multi-tenant SaaS, ~3 new pages, ~2 new API routes, 1 new Inngest function, 1 schema migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Tenant Isolation | PASS | All routes enforce orgId; customer data already scoped |
| II. Type Safety | PASS | TypeScript strict mode; all new code fully typed |
| III. Explicit Over Implicit | PASS | Inngest event for doc generation is explicit; no magic |
| IV. Secure by Default | PASS | Document proxy validates auth; no public blob URLs exposed directly |
| V. 80% Coverage | PLAN | Tests required for all new routes, components, Inngest function |
| VI. Test the Agents | N/A | No new AI agents in this feature |
| VII. Integration Tests | PLAN | Integration test for finalize → generate doc → download flow |
| VIII. Document Fidelity | PLAN | PDF overlay positioning tests needed; Word output structure tests |
| IX. Progressive Disclosure | PASS | Download button only shows when completedFileUrl exists |
| X. Human in Control | PASS | Export is user-triggered; fallback to markdown always available |
| XI. Consistent Feedback | PASS | Loading states for doc viewer; error states for failed generation |
| XII. Accessible First | PLAN | PDF viewer needs aria labels; keyboard nav for doc viewer |
| XIII. Sub-3s Parse | PASS | Document rendering is client-side; generation is background job |
| XIV. Streaming Responses | N/A | No new AI generation |
| XV. Efficient Vector Search | N/A | No changes to vector search |
| XVI. Graceful Degradation | PASS | Failed doc generation shows error + markdown fallback |

**Post-Phase 1 Re-check**: All gates pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/002-p0-critical-gaps/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Schema changes (1 new column)
├── quickstart.md        # Setup and verification guide
├── contracts/
│   ├── api.yaml         # New/modified API endpoints
│   └── events.md        # Inngest event definitions
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── customers/
│   │   │   ├── page.tsx                    # NEW: Customer list
│   │   │   └── [id]/
│   │   │       └── page.tsx                # NEW: Customer detail
│   │   ├── rfps/[id]/
│   │   │   └── page.tsx                    # MODIFIED: Side-by-side layout
│   │   └── layout.tsx                      # MODIFIED: Add Customers nav
│   └── api/
│       └── rfps/[rfpId]/
│           ├── download/
│           │   └── route.ts                # NEW: Download completed doc
│           ├── document/
│           │   └── route.ts                # NEW: Proxy original doc
│           └── finalize/
│               └── route.ts                # MODIFIED: Send Inngest event
├── components/
│   └── rfp/
│       ├── DocumentViewer.tsx              # NEW: PDF/Word viewer
│       └── RfpEditor.tsx                   # MODIFIED: Accept viewer slot
├── lib/
│   ├── db/schema/
│   │   └── rfps.ts                         # MODIFIED: Add completedFileError
│   └── inngest/functions/
│       └── generate-completed-document.ts  # NEW: Background doc generation

tests/
├── unit/
│   ├── api/
│   │   ├── rfp-download.test.ts            # NEW
│   │   └── rfp-document.test.ts            # NEW
│   └── components/
│       └── document-viewer.test.ts         # NEW
├── integration/
│   ├── api/
│   │   └── rfp-finalize-export.test.ts     # NEW
│   └── inngest/
│       └── generate-completed-document.test.ts  # NEW
└── e2e/
    └── side-by-side-review.spec.ts         # NEW (optional)
```

**Structure Decision**: Follows existing Next.js App Router monolith structure. No new top-level directories. Customer pages mirror the existing `settings/` and `content-library/` page patterns.

## Implementation Phases

### Phase A: Format-Preserving Export (US1)
1. Add `completedFileError` column to rfps schema + migration
2. Create `generate-completed-document` Inngest function
3. Register Inngest function in `api/inngest/route.ts`
4. Modify finalize route to send Inngest event
5. Create `/api/rfps/[rfpId]/download` route
6. Add download button to RFP detail page
7. Tests: unit (download route), integration (finalize → Inngest → download)

### Phase B: Side-by-Side Document Review (US2)
1. Install `react-pdf` and `pdfjs-dist`
2. Create `/api/rfps/[rfpId]/document` proxy route
3. Create `DocumentViewer` component (PDF mode + Word/HTML mode)
4. Refactor `RfpEditor` to include `DocumentViewer` as left panel
5. Update RFP detail page layout to side-by-side
6. Tests: unit (DocumentViewer, document route), component render tests

### Phase C: End-Customer Profiles (US3)
1. Create `/customers` list page
2. Create `/customers/[id]` detail page (with settings, RFP history, KB entries)
3. Add customer selector to RFP creation/detail
4. Add customer name + filter to dashboard
5. Add "Customers" link to nav layout
6. Tests: unit (pages), integration (customer API already tested)

## Complexity Tracking

No constitution violations. All features build on existing infrastructure with minimal new complexity.
