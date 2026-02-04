# Implementation Plan: RFP Automation Core Platform

**Branch**: `001-rfp-automation-core` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-rfp-automation-core/spec.md`

## Summary

Build a multi-tenant SaaS platform that automates RFP completion using AI agents. Users upload PDF/Word RFPs, the system extracts fields, queries a customer-specific knowledge base, and generates responses with confidence scores. Human-in-the-loop interface allows review and editing before exporting completed documents with preserved formatting.

**Technical Approach**: Next.js 15 App Router with Clerk for multi-tenant auth, Neon PostgreSQL with pgvector for data and semantic search, Vercel AI SDK for LLM integration, and Inngest for orchestrating the multi-step AI processing workflow. Documents stored in Vercel Blob, with pdf-lib for PDF overlay output.

## Technical Context

**Language/Version**: TypeScript 5.0+ (strict mode), Node.js 20+
**Framework**: Next.js 15 (App Router)
**Primary Dependencies**:
- Frontend: React 18, Tailwind CSS, shadcn/ui, React Hook Form, Zod, Zustand
- Backend: Drizzle ORM, Vercel AI SDK, Inngest
- Document Processing: pdf-parse, pdf-lib, mammoth, docx
**Authentication**: Clerk (Organizations for multi-tenancy)
**Storage**: Neon PostgreSQL + pgvector (data), Vercel Blob (files), Vercel KV (cache)
**Testing**: Vitest (unit), Playwright (E2E), MSW (API mocking)
**Target Platform**: Vercel (serverless), Web browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (Next.js monorepo with API routes)
**Performance Goals**:
- Document parse < 3 seconds for typical RFPs
- Vector search < 500ms
- 99.5% availability
**Constraints**:
- Vercel function timeout (60s standard, use Inngest for longer operations)
- File uploads up to 50MB
- Multi-tenant data isolation required
**Scale/Scope**:
- Initial: 100 tenants, 1000 users, 10k RFPs
- Growth: 1000 tenants, 10k users, 100k RFPs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Implementation |
|-----------|--------|----------------|
| I. Tenant Isolation | ✅ PASS | Clerk Organizations provide tenant context; all Drizzle queries filtered by `organizationId`; Vercel Blob paths prefixed with org ID |
| II. Type Safety | ✅ PASS | TypeScript strict mode; Drizzle typed schemas; Zod validation on all inputs; no `any` types |
| III. Explicit Over Implicit | ✅ PASS | Dependency injection via React context and function parameters; explicit config via environment variables |
| IV. Secure by Default | ✅ PASS | Clerk handles auth; API keys encrypted in Neon; Vercel Blob private by default; audit logging via middleware |
| V. 80% Coverage | ✅ PLANNED | Vitest for unit tests, Playwright for E2E, coverage gates in CI |
| VI. Test the Agents | ✅ PLANNED | Inngest step mocking; deterministic LLM response fixtures; timeout simulation tests |
| VII. Integration Tests | ✅ PLANNED | Full workflow tests with sample RFPs; Playwright E2E for UI flows |
| VIII. Document Fidelity | ✅ PLANNED | Visual regression tests for PDF output; snapshot comparisons |
| IX. Progressive Disclosure | ✅ PASS | Confidence scores shown inline; technical details hidden in expandable sections |
| X. Human in Control | ✅ PASS | Accept/edit/reject for every AI response; no forced automation |
| XI. Consistent Feedback | ✅ PASS | shadcn/ui toast system; consistent loading states via Suspense |
| XII. Accessible First | ✅ PLANNED | shadcn/ui is accessible by default; keyboard navigation; ARIA labels |
| XIII. Sub-3s Parse | ✅ PASS | Inngest streaming; chunked processing; progress indicators |
| XIV. Streaming AI | ✅ PASS | Vercel AI SDK streaming; useChat/useCompletion hooks |
| XV. Efficient Vector Search | ✅ PASS | pgvector with HNSW index; <500ms target |
| XVI. Graceful Degradation | ✅ PASS | Inngest retries; queue on LLM failure; partial results displayed |

**Gate Status**: ✅ ALL PRINCIPLES SATISFIED

## Project Structure

### Documentation (this feature)

```text
specs/001-rfp-automation-core/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions and patterns
├── data-model.md        # Phase 1: Database schema and entities
├── quickstart.md        # Phase 1: Developer setup guide
├── contracts/           # Phase 1: API contracts
│   ├── api.yaml         # OpenAPI 3.1 specification
│   └── events.md        # Inngest event definitions
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
rfp-automator/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth-required routes
│   │   │   ├── dashboard/        # Main dashboard
│   │   │   ├── rfps/             # RFP management
│   │   │   │   ├── [id]/         # Single RFP view/edit
│   │   │   │   └── new/          # New RFP wizard
│   │   │   ├── knowledge/        # Knowledge base management
│   │   │   ├── customers/        # End-customer management
│   │   │   └── settings/         # Tenant settings
│   │   ├── (public)/             # Public routes
│   │   │   └── sign-in/          # Clerk sign-in
│   │   ├── api/                  # API routes
│   │   │   ├── rfps/             # RFP CRUD + processing
│   │   │   ├── knowledge/        # Knowledge base operations
│   │   │   ├── customers/        # Customer CRUD
│   │   │   ├── inngest/          # Inngest webhook handler
│   │   │   └── webhooks/         # Clerk webhooks
│   │   ├── layout.tsx            # Root layout with providers
│   │   └── globals.css           # Tailwind imports
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── rfp/                  # RFP-specific components
│   │   │   ├── RfpEditor.tsx     # Side-by-side editing interface
│   │   │   ├── ResponseCard.tsx  # Individual response with confidence
│   │   │   ├── DocumentPreview.tsx
│   │   │   └── ProgressTracker.tsx
│   │   ├── knowledge/            # KB components
│   │   └── shared/               # Shared components
│   │
│   ├── lib/                      # Core utilities
│   │   ├── db/                   # Database
│   │   │   ├── schema.ts         # Drizzle schema
│   │   │   ├── index.ts          # DB client
│   │   │   └── migrations/       # SQL migrations
│   │   ├── inngest/              # Background jobs
│   │   │   ├── client.ts         # Inngest client
│   │   │   └── functions/        # Inngest functions
│   │   │       ├── process-rfp.ts
│   │   │       ├── generate-embeddings.ts
│   │   │       └── export-document.ts
│   │   ├── ai/                   # AI/LLM utilities
│   │   │   ├── providers.ts      # LLM provider abstraction
│   │   │   ├── embeddings.ts     # Embedding generation
│   │   │   └── agents/           # Agent definitions
│   │   │       ├── document-analyzer.ts
│   │   │       ├── response-generator.ts
│   │   │       └── quality-checker.ts
│   │   ├── documents/            # Document processing
│   │   │   ├── pdf-parser.ts     # PDF extraction
│   │   │   ├── word-parser.ts    # Word extraction
│   │   │   ├── pdf-output.ts     # PDF overlay generation
│   │   │   └── word-output.ts    # Word generation
│   │   ├── storage/              # File storage
│   │   │   └── blob.ts           # Vercel Blob wrapper
│   │   └── utils/                # Shared utilities
│   │       ├── auth.ts           # Clerk helpers
│   │       └── validation.ts     # Zod schemas
│   │
│   ├── hooks/                    # React hooks
│   │   ├── use-rfp.ts
│   │   ├── use-knowledge-search.ts
│   │   └── use-processing-status.ts
│   │
│   └── types/                    # TypeScript types
│       ├── rfp.ts
│       ├── knowledge.ts
│       └── api.ts
│
├── tests/
│   ├── unit/                     # Unit tests (Vitest)
│   │   ├── lib/
│   │   └── components/
│   ├── integration/              # Integration tests
│   │   └── api/
│   └── e2e/                      # E2E tests (Playwright)
│       ├── rfp-workflow.spec.ts
│       └── knowledge-base.spec.ts
│
├── drizzle.config.ts             # Drizzle configuration
├── inngest.config.ts             # Inngest configuration
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── vitest.config.ts              # Vitest configuration
├── playwright.config.ts          # Playwright configuration
└── package.json
```

**Structure Decision**: Next.js monorepo with colocated API routes. All code in `src/` following App Router conventions. Background jobs handled by Inngest functions in `src/lib/inngest/functions/`.

## Complexity Tracking

> No constitution violations requiring justification. Stack is appropriately scoped for requirements.

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Inngest over Vercel Cron | Multi-step workflows with retries needed for RFP processing | Vercel Cron too simple; Trigger.dev similar but Inngest has better streaming support |
| Drizzle over Prisma | Lighter bundle, SQL-like syntax, better Neon integration | Prisma more mature but heavier; raw SQL less maintainable |
| shadcn/ui over custom | Accessible by default, highly customizable, good DX | Custom components would take longer; other libraries less flexible |
