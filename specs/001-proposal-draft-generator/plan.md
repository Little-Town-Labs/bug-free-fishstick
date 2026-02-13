# Implementation Plan: Proposal Draft Generator

**Branch**: `001-proposal-draft-generator` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-proposal-draft-generator/spec.md`

## Summary

Adds an AI-assisted proposal generation workflow that analyzes an ingested RFP and the org's knowledge base, presents targeted clarifying questions to the user, and produces a complete first-pass proposal as an editable markdown document. Introduces a reusable **Proposal Content Library** where all org members can store standards, pricing tiers, service descriptions, and boilerplate text to be incorporated into future proposals.

## Technical Context

**Language/Version**: TypeScript 5.0+ (strict mode), Node.js 18.19.1 (system)
**Primary Dependencies**: Next.js 14 (App Router), Drizzle ORM 0.45+, Vercel AI SDK, Inngest, Zod, shadcn/ui
**Storage**: Neon PostgreSQL + pgvector (data), Vercel Blob (file export), Upstash Redis (caching)
**Testing**: Vitest 2.x, jsdom 24.x — 763 existing tests
**Target Platform**: Web application (Next.js server + client components)
**Project Type**: Web application (existing Next.js monorepo under `src/`)
**Performance Goals**: Clarifying questions generated in < 3 s; full proposal generation queued async via Inngest (streamed progress shown to user); content library operations < 500 ms
**Constraints**: Must scope all DB queries by `organizationId`; markdown-only export for v1; no PDF/DOCX generation in this feature
**Scale/Scope**: Per-RFP proposal drafts; content library entries per org (expected < 500 entries)

## Constitution Check

| Principle | Check | Notes |
|-----------|-------|-------|
| I. Tenant Isolation | ✅ PASS | All new tables have `organization_id`; all queries must filter by it |
| II. Type Safety | ✅ PASS | Strict TypeScript throughout; Zod schemas on all AI inputs/outputs |
| III. Explicit Over Implicit | ✅ PASS | Proposal status transitions are explicit; no magic injection |
| IV. Secure by Default | ✅ PASS | Content library is org-scoped; no sensitive data involved |
| V. 80% Coverage | ✅ PASS | New services and agents must have unit + integration tests |
| VI. Test the Agents | ✅ PASS | `question-generator` and `proposal-writer` agents require mocked LLM tests |
| VII. Integration Tests | ✅ PASS | Full proposal generation flow needs end-to-end Inngest test |
| VIII. Document Fidelity | ✅ PASS | Markdown export test verifies section structure against RFP fields |
| IX. Progressive Disclosure | ✅ PASS | Generation queued via Inngest; UI polls status and shows progress |
| X. Human in Control | ✅ PASS | User answers all questions; can edit every section of the draft |
| XI. Consistent Feedback | ✅ PASS | Reuse existing loading/error/success patterns |
| XII. Accessible First | ✅ PASS | All new UI components must meet WCAG 2.1 AA |
| XIII. Sub-3s Parse | ✅ PASS | Question generation is synchronous + fast; proposal generation is async |
| XIV. Streaming AI | ✅ PASS | Inngest job sends progress events; UI subscribes |
| XV. Vector Search < 500ms | ✅ PASS | Reuses existing `searchSimilar` service |
| XVI. Graceful Degradation | ✅ PASS | Inngest queues work; failure creates draft in `error` state with retry |

No constitution violations. No complexity table needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-proposal-draft-generator/
├── plan.md              ✅ this file
├── research.md          ✅ Phase 0 output
├── data-model.md        ✅ Phase 1 output
├── quickstart.md        ✅ Phase 1 output
├── contracts/           ✅ Phase 1 output
│   ├── content-library.yaml
│   └── proposals.yaml
└── tasks.md             (created by /speckit.tasks)
```

### Source Code (this feature adds)

```text
src/
├── lib/
│   ├── db/
│   │   └── schema/
│   │       ├── proposal-content-library.ts   NEW
│   │       └── proposal-drafts.ts            NEW
│   ├── services/
│   │   ├── proposal-draft.ts                 NEW
│   │   └── proposal-content-library.ts       NEW
│   ├── ai/
│   │   └── agents/
│   │       ├── proposal-question-generator.ts  NEW
│   │       └── proposal-writer.ts              NEW
│   └── inngest/
│       └── functions/
│           └── generate-proposal.ts          NEW
├── app/
│   ├── api/
│   │   ├── content-library/
│   │   │   └── route.ts                      NEW  (GET, POST)
│   │   ├── content-library/[entryId]/
│   │   │   └── route.ts                      NEW  (GET, PATCH, DELETE)
│   │   └── rfps/[rfpId]/
│   │       └── proposals/
│   │           ├── route.ts                  NEW  (GET, POST)
│   │           └── [draftId]/
│   │               ├── route.ts              NEW  (GET, PATCH, DELETE)
│   │               ├── answers/
│   │               │   └── route.ts          NEW  (POST — submit clarifying answers)
│   │               └── export/
│   │                   └── route.ts          NEW  (GET — download markdown)
│   └── (auth)/
│       ├── rfps/[rfpId]/
│       │   └── proposal/
│       │       └── page.tsx                  NEW  (wizard: questions → generation → editor)
│       └── content-library/
│           └── page.tsx                      NEW
├── components/
│   ├── rfp/
│   │   ├── ClarifyingQuestionsForm.tsx       NEW
│   │   ├── ProposalEditor.tsx                NEW
│   │   └── ProposalDraftPanel.tsx            NEW
│   └── content-library/
│       ├── ContentLibraryList.tsx            NEW
│       └── ContentLibraryForm.tsx            NEW

tests/
├── unit/
│   ├── agents/
│   │   ├── proposal-question-generator.test.ts  NEW
│   │   └── proposal-writer.test.ts              NEW
│   └── services/
│       ├── proposal-draft.test.ts               NEW
│       └── proposal-content-library.test.ts     NEW
└── integration/
    └── api/
        ├── content-library.test.ts              NEW
        ├── proposals.test.ts                    NEW
        └── proposals-export.test.ts             NEW
    └── inngest/
        └── generate-proposal.test.ts            NEW
```

**Structure Decision**: Follows the existing web application layout under `src/`. Content Library is a top-level resource (not nested under RFPs) because it is org-wide. Proposal drafts are nested under RFPs since they are per-RFP.
