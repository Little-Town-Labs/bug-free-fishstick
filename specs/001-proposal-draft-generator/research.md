# Research: Proposal Draft Generator

**Branch**: `001-proposal-draft-generator` | **Date**: 2026-02-12

## Decision Log

---

### Decision 1: Proposal Generation Flow Architecture

**Decision**: Two-phase async flow — synchronous question generation, async proposal writing via Inngest.

**Rationale**: Clarifying question generation is fast (< 3 s) and benefits from immediate feedback. Full proposal writing is slower (10–60 s depending on RFP size and LLM latency) and must be non-blocking per Constitution Principle XIV. Inngest already handles the background processing pattern in this codebase (see `process-rfp.ts`). The `proposal_drafts` table holds the status (`awaiting_answers` → `generating` → `draft`) so the UI can poll.

**Alternatives considered**:
- Server-Sent Events (SSE) for streaming generation — rejected because Inngest already handles retries, queuing, and observability consistently with other background jobs in the project.
- Synchronous blocking generation — rejected; violates Constitution Principle XIV for long LLM calls.

---

### Decision 2: AI Agent Design — Two Separate Agents

**Decision**: Create two new agents: `proposal-question-generator` and `proposal-writer`.

**Rationale**: Separating concerns allows each agent to be independently tested with mocked LLM responses (Constitution Principle VI). The question generator runs synchronously on RFP initiation; the proposal writer runs inside the Inngest background job.

**`proposal-question-generator`**:
- Input: RFP parsed fields + summary, list of knowledge base topics found via vector search, content library category names
- Output: 3–10 targeted questions (structured JSON with question text, RFP section reference, why it's needed)
- Uses `generateObject` with a Zod schema (same pattern as existing agents)

**`proposal-writer`**:
- Input: RFP sections/fields, knowledge context (vector search results), content library entries (matched by category/semantic), user answers to clarifying questions
- Output: Full markdown document with section headers matching RFP structure, clearly annotated sources
- Uses `generateText` with streaming (streamed content stored chunk-by-chunk in the draft's `markdown_content`)

**Alternatives considered**:
- Single combined agent — rejected; too large a context window for both tasks, harder to test and tune independently.

---

### Decision 3: Content Library Storage

**Decision**: New `proposal_content_library` table in PostgreSQL, scoped by `organization_id`. Entries carry a free-text `category` field (not an enum) to allow flexible categorization.

**Rationale**: Follows the same pattern as `knowledge_entries`. Using a free-text category (e.g., "Pricing", "Service", "Standard", "Boilerplate", "Terms") rather than a fixed enum gives organizations flexibility without requiring schema migrations to add categories. All members can create/edit/delete entries (per spec FR-012).

**Matching to proposals**: At generation time, the `proposal-writer` agent receives all content library entries for the org as context. The LLM determines relevance based on the RFP content. For large libraries (> 100 entries), a vector similarity pre-filter can be added in a future iteration.

**Alternatives considered**:
- Extend `knowledge_entries` with a `is_proposal_library` flag — rejected; conflates two different use cases with different governance (knowledge entries are org+customer scoped, content library is purely org-scoped).
- Enum category — rejected; organizations have different vocabularies; too restrictive without a migration path.

---

### Decision 4: Proposal Draft Storage

**Decision**: New `proposal_drafts` table storing `markdown_content` as TEXT and `clarifying_questions` as JSONB.

**Rationale**: JSONB for questions/answers avoids a separate join table for a list that is only ever accessed in full (never queried by individual question). TEXT for markdown_content is the simplest storage; markdown documents fit well within PostgreSQL's text limit. Keeping everything in one table reduces query complexity.

**Draft statuses**: `awaiting_answers` → `generating` → `draft` → `finalized` (plus `error` for failed generation).

**Alternatives considered**:
- Separate `proposal_clarifications` table — rejected for v1; overkill given questions are always fetched with the draft.
- Storing markdown in Vercel Blob — rejected; adds latency for a document that is frequently read/edited; blob storage is appropriate for binary files (PDFs), not live-edited text.

---

### Decision 5: Markdown Editor UI

**Decision**: Use the existing `<textarea>` component (shadcn/ui) with a side-by-side or toggle preview. No third-party markdown editor library in v1.

**Rationale**: The project already uses a minimal component set. Adding a heavy markdown editor (e.g., CodeMirror, TipTap) increases bundle size and introduces new dependencies. A `<textarea>` + client-side markdown render (using `react-markdown`, already a common dep or easily added) is sufficient for the first release. Users who need advanced editing can export and use their preferred editor.

**Alternatives considered**:
- TipTap rich text editor — rejected for v1; adds complexity and bundle weight.
- Vercel's `geist` text editor — not applicable.

---

### Decision 6: Export Format

**Decision**: `GET /api/rfps/[rfpId]/proposals/[draftId]/export` returns the markdown content as a file download (`Content-Disposition: attachment; filename="proposal-{rfpName}.md"`).

**Rationale**: Simple, no external dependencies. Markdown is a universal format. Future phases can add DOCX/PDF export as a separate feature.

**Alternatives considered**:
- Generate a Vercel Blob URL for the exported file — rejected for v1; adds async overhead for a synchronous read-and-stream operation.

---

## No NEEDS CLARIFICATION Remaining

All technical unknowns resolved. No blockers for Phase 1 design.
