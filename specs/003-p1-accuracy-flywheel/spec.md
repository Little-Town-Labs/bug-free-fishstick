# Feature Specification: P1 — Accuracy Flywheel

**Version**: 1.0.0 | **Date**: 2026-02-13 | **Status**: Draft

## Overview

Transform the RFP Automator from a generic pipeline into a self-improving, customer-aware system. Five interconnected capabilities form a flywheel: better customer context → better responses → more user corrections captured → better learnings → even better responses.

## User Stories

### US1: Customer-Specific AI Agents (P1)

**As a** response reviewer, **I want** AI-generated responses to reflect each customer's preferred tone, industry terminology, and past corrections **so that** I spend less time editing for style/context.

**Acceptance Criteria:**
- Customer `settings.preferredTone`, `industryContext`, and `customInstructions` are injected into the response generator's system prompt
- Per-customer learnings are prioritized over org-level learnings in context window
- Response confidence scores increase over time as more customer-specific learnings accumulate
- Customer-specific system prompt is visible (read-only) in customer settings page

**Current State:** `generateResponses()` receives `learningsContext` and `knowledgeContext` but ignores `customer.settings`. System prompt is hardcoded.

### US2: Real-Time Learning (P1)

**As a** response reviewer, **I want** every accept, edit, and reject action to contribute to the system's learning **so that** the AI improves with each RFP, not just at approval time.

**Acceptance Criteria:**
- Accept action: captures "this response was good for this question type" signal
- Edit action: captures original vs. corrected text as a correction learning (debounced, fires on save)
- Reject action: captures "this response was wrong for this question type" signal
- Learning capture is async (non-blocking UI)
- Learnings panel on RFP detail page shows captured learnings for current RFP
- Learning count visible in customer profile stats

**Current State:** `captureCorrection()` and `captureManualLearning()` services exist but are never called from the response review UI. Learning only triggers on RFP approval via Inngest.

### US3: Auto-Classification & Routing (P1)

**As an** org admin, **I want** incoming RFPs to be automatically classified by type and complexity, with suggested assignee **so that** I can triage faster and route to the right person.

**Acceptance Criteria:**
- After document analysis (process-rfp step 4), classify RFP into: type (technical, commercial, compliance, mixed), complexity (simple, medium, complex), and industry tags
- Classification stored on RFP record and visible in dashboard
- Suggested assignee based on: past RFP assignments for similar type/complexity, user workload (count of in-progress RFPs)
- Admin can accept or override suggested assignment
- Dashboard filterable by type and complexity
- Classification runs within existing process-rfp Inngest function (no separate job)

**Current State:** `rfps` schema has `assignedUserId` (manual) and `automationPercentage` (computed). No type, complexity, or industry fields. No classification logic.

### US4: Smart Content Library Matching (P1)

**As a** proposal author, **I want** the content library to automatically surface the most relevant entries for each RFP section **so that** I don't have to manually browse categories.

**Acceptance Criteria:**
- Content library entries get embeddings (like knowledge entries)
- During proposal generation, entries are ranked by semantic similarity to the RFP context
- Top-N relevant entries (configurable, default 5) are injected into the proposal writer
- Relevance scores shown in the UI alongside matched entries
- Fallback to category-based matching if no embeddings exist yet
- Batch embedding migration for existing entries

**Current State:** Content library entries have no embeddings. `proposal-writer.ts` receives all entries flat. Retrieval is category-filter only.

### US5: Auto-Index KB Uploads (P1)

**As a** knowledge base manager, **I want** uploaded documents to be automatically chunked, tagged, and indexed **so that** I don't have to manually create individual entries.

**Acceptance Criteria:**
- Uploaded PDF/DOCX documents are chunked into semantic sections (paragraphs or heading-delimited)
- Each chunk becomes a separate knowledge entry with its own embedding
- Source document metadata (page number, section heading) preserved on each chunk
- Auto-generated tags based on content (up to 5 tags per chunk)
- Upload progress shown in UI (processing → chunked → embedded)
- Existing single-entry upload still works as fallback for short documents
- Long documents (>2000 tokens) automatically trigger chunking

**Current State:** Upload creates a single knowledge entry with the full document text. Embedding is generated for the entire content. No chunking, no auto-tagging.

## Non-Functional Requirements

- **NFR1**: Learning capture must not add >100ms to accept/edit/reject actions (async via Inngest events)
- **NFR2**: Classification must complete within the existing process-rfp pipeline (no additional user-visible latency)
- **NFR3**: Content library embedding migration must be idempotent and resumable
- **NFR4**: Document chunking must handle documents up to 200 pages
- **NFR5**: All features must maintain tenant isolation (Constitution I)
- **NFR6**: All new schema fields must have appropriate indexes for org-scoped queries

## Out of Scope

- Custom LLM fine-tuning per customer (use prompt engineering instead)
- Real-time collaborative editing
- External knowledge source connectors (SharePoint, Confluence, etc.)
- A/B testing framework for response quality
- Learning quality scoring / deprecation of stale learnings
