# Feature Specification: P0 Critical Gaps

**Branch**: `002-p0-critical-gaps` | **Date**: 2026-02-13

## Overview

Close three critical P0 gaps between the current implementation and the PRD vision:

1. **Format-preserving export** — Wire up existing PDF overlay and Word output generators to produce filled documents in the original format, store them via Vercel Blob, and expose download from the RFP detail page.
2. **Side-by-side document review** — Replace the placeholder RFP detail page with a true split view: rendered original document on the left, editable response cards on the right.
3. **End-customer profile enhancements** — Surface customer profiles with RFP history, knowledge base stats, and configurable preferences in the UI; link them throughout the RFP workflow.

## Scope

### In Scope

- Format-preserving export (PDF overlay + Word generation) triggered on finalization
- Download route for completed RFP documents (PDF + Word)
- Client-side PDF viewer for original RFP documents (react-pdf or pdfjs-dist)
- Word document rendered as HTML (mammoth already available)
- Side-by-side layout: original doc | response editor
- Customer profile page with stats (RFP count, KB entries, learnings, preferences)
- Customer selector on RFP creation and detail page
- Customer history view (past RFPs for a customer)

### Out of Scope

- Real-time collaboration (P2)
- Analytics dashboard (P2)
- Customer-specific AI agents (P1 — separate feature)
- Auto-classification/routing (P1)
- CRM integrations (P2)
- Batch upload (P2)

## User Stories

### US1: Format-Preserving Export

**As a** proposal manager
**I want to** download the completed RFP as a filled PDF or Word document
**So that** I can submit it in the original format with our responses overlaid

**Acceptance Criteria:**
- On RFP finalization, the system generates a filled PDF (overlay) and stores it via Vercel Blob
- On RFP finalization for Word documents, the system generates a filled DOCX
- The `completedFileUrl` field is populated on the RFP record
- A download button on the RFP detail page lets users download the completed document
- The original document formatting and branding are preserved
- Export falls back to markdown if original file is unavailable

### US2: Side-by-Side Document Review

**As an** RFP reviewer
**I want to** see the original RFP document alongside the editable responses
**So that** I can compare my answers with the original questions in context

**Acceptance Criteria:**
- PDF documents render inline using a PDF viewer component
- Word documents render as HTML using mammoth
- The split view is responsive: stacks vertically on mobile
- Clicking a response card scrolls the document preview to the relevant page
- Loading states shown while document loads
- Graceful fallback if document cannot be rendered (show metadata list as today)

### US3: End-Customer Profiles

**As an** admin
**I want to** view and manage customer profiles with history and preferences
**So that** I can track our relationship and configure customer-specific settings

**Acceptance Criteria:**
- Customer list page shows all customers with stats (RFP count, KB entries)
- Customer detail page shows: profile info, settings, RFP history, KB entries
- Customer settings (preferredTone, industryContext, customInstructions) are editable
- RFP creation wizard shows customer selector with past RFP count
- Customer name appears on RFP cards in the dashboard
- Customer filter available on dashboard

## Technical Approach

### US1: Format-Preserving Export
- Wire `generatePdfOutput()` and `generateWordOutput()` from `src/lib/documents/` into the finalization workflow
- Create Inngest function `rfp/generate-completed-document` triggered on finalization
- Upload completed file to Vercel Blob, update `completedFileUrl`
- Add GET `/api/rfps/[rfpId]/download` route that redirects to the blob URL
- Add download button to RFP detail page (enabled when completedFileUrl is set)

### US2: Side-by-Side Document Review
- Install `react-pdf` (wraps pdfjs-dist) for PDF rendering
- Use existing `mammoth` to convert DOCX → HTML for preview
- Create `DocumentViewer` component (PDF viewer or HTML viewer based on file type)
- Refactor `RfpEditor` to accept a `documentViewer` slot for the side-by-side layout
- Add page navigation and scroll-to-page via response card click

### US3: End-Customer Profiles
- Customer CRUD API already exists — build UI pages
- Create `/customers` list page and `/customers/[id]` detail page
- Add customer selector dropdown to RFP creation flow
- Add customer name column to dashboard RFP list
- Add customer filter to dashboard

## Non-Functional Requirements

- PDF viewer must not increase initial bundle by more than 200KB (use dynamic import)
- Document rendering must complete in <3 seconds (Constitution XIII)
- All new UI must be keyboard navigable and screen-reader accessible (Constitution XII)
- 80%+ test coverage on new code (Constitution V)
- Tenant isolation on all customer and document routes (Constitution I)
