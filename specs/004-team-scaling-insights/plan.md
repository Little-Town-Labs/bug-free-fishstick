# Implementation Plan: Team Scaling & Business Insights

**Branch**: `004-team-scaling-insights` | **Date**: 2026-02-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-team-scaling-insights/spec.md`

## Summary

Implements three independent feature areas for team scaling and business visibility: (1) a pre-computed analytics dashboard backed by an Inngest cron job writing to an `analytics_snapshots` table; (2) real-time collaboration with SSE field-update broadcasting via Vercel KV pub/sub and presence polling; and (3) CRM/Slack integrations using Inngest event fan-out with encrypted per-org credentials in new `integration_configs` and `sync_events` tables.

All three areas extend existing patterns: Inngest background jobs (analytics cron mirrors `content-library/batch-embed` fan-out), `encrypt()`/`decrypt()` from `src/lib/services/encryption.ts` (integrations), Vercel KV caching (analytics cache), and optimistic locking on `rfp_responses`.

## Technical Context

**Language/Version**: TypeScript 5.0+ (strict mode), Node.js 18.19.1
**Primary Dependencies**: Next.js 15 App Router, Drizzle ORM 0.45+, Inngest, Vercel AI SDK, shadcn/ui, Vercel KV (Upstash Redis)
**Storage**: Neon PostgreSQL + pgvector (new tables: `analytics_snapshots`, `integration_configs`, `sync_events`; modified: `rfps`, `rfp_responses`); Vercel KV (presence TTL keys, analytics cache, SSE pub/sub channel)
**Testing**: Vitest 2.x, MSW for API mocks, existing test factory patterns
**Target Platform**: Vercel (serverless Functions + Edge Network)
**Project Type**: Web application (Next.js monorepo — single `src/` tree)
**Performance Goals**: Dashboard load < 200ms (served from KV cache); SSE field propagation < 5s; Slack notification delivery < 30s; CRM sync success ≥ 95% first attempt
**Constraints**: Vercel Function max duration ~60s (SSE reconnect required); no WebSocket support on Vercel serverless; Vercel KV HTTP client does not support pub/sub (must use Upstash subscribe API or `ioredis` with `rediss://` URL via `UPSTASH_REDIS_URL` env var)
**Scale/Scope**: Org-level analytics for teams of 2–50 users; real-time collab for up to 10 concurrent editors per RFP; 2 CRM integrations (HubSpot, Salesforce) + Slack

## Constitution Check

*GATE: Checked against `.specify/memory/constitution.md` — all 16 principles evaluated.*

| Principle | Status | Notes |
|---|---|---|
| I. Tenant Isolation | ✅ Pass | All new tables have `organizationId`; analytics scoped per org; integration_configs unique per org; SSE channels scoped to `rfp:{rfpId}` + org auth check |
| II. Type Safety | ✅ Pass | All Drizzle schemas fully typed; Inngest event types extended in `client.ts`; SSE event payloads typed |
| III. Explicit Over Implicit | ✅ Pass | Integration event triggers explicit (fired from Inngest steps, not magic hooks); SSE channel naming explicit; ActivityLog reads from `rfp_responses` version history (no implicit undocumented route) |
| IV. Secure by Default | ✅ Pass | Integration credentials encrypted at rest via existing `encrypt()`; `credentialsEncrypted` never returned in API responses; secrets redacted from `sync_events.requestPayload` |
| V. 80% Coverage | ✅ Pass | New services, Inngest functions, and API routes each require unit + integration tests |
| VI. Test the Agents | N/A | No new AI agents in this feature |
| VII. Integration Tests for Workflows | ✅ Pass | Inngest function tests for analytics fan-out, Slack notify, and CRM sync required |
| VIII. Document Fidelity Tests | N/A | No document generation in this feature |
| IX. Progressive Disclosure | ✅ Pass | Analytics empty state; integration status clearly surfaced; SSE reconnect is invisible to user |
| X. Human Always in Control | ✅ Pass | Outcome (won/lost) is always manually set; integrations are opt-in per org; failed sync events can be retried or ignored |
| XI. Consistent Feedback Patterns | ✅ Pass | Using existing shadcn/ui patterns; conflict UI follows existing error patterns |
| XII. Accessible First | ✅ Pass | Charts require accessible fallback data tables; ARIA labels on presence avatars; conflict modal keyboard-navigable |
| XIII. Sub-3s Parse | N/A | No document parsing in this feature |
| XIV. Streaming AI Responses | N/A | No AI generation in this feature |
| XV. Efficient Vector Search | N/A | No vector search in this feature |
| XVI. Graceful Degradation | ✅ Pass | SSE stream has polling fallback; failed CRM sync queued and retried; analytics serves cached data if snapshot job is delayed |

**No violations. No complexity justification required.**

## Project Structure

### Documentation (this feature)

```text
specs/004-team-scaling-insights/
├── plan.md              # This file
├── research.md          # Phase 0 output ✓
├── data-model.md        # Phase 1 output ✓
├── quickstart.md        # Phase 1 output ✓
├── contracts/
│   ├── api.yaml         # Phase 1 output ✓
│   └── events.md        # Phase 1 output ✓
└── tasks.md             # Phase 2 output ✓
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── analytics/
│   │   │   └── page.tsx                          # Analytics dashboard page
│   │   └── settings/
│   │       └── integrations/
│   │           └── page.tsx                      # Integration settings page
│   └── api/
│       ├── analytics/
│       │   └── route.ts                          # GET /api/analytics
│       ├── rfps/[rfpId]/
│       │   ├── stream/route.ts                   # GET SSE stream
│       │   ├── presence/route.ts                 # GET + POST presence
│       │   ├── outcome/route.ts                  # PATCH won/lost
│       │   └── responses/[responseId]/route.ts   # PATCH (extended with version)
│       └── settings/
│           └── integrations/
│               ├── route.ts                      # GET all configs
│               ├── [type]/route.ts               # PUT + DELETE config
│               ├── [type]/test/route.ts          # POST test
│               └── sync-events/
│                   ├── route.ts                  # GET sync event log
│                   └── [syncEventId]/retry/route.ts
├── components/
│   ├── analytics/
│   │   ├── AnalyticsDashboard.tsx
│   │   ├── MetricCard.tsx
│   │   ├── VolumeChart.tsx
│   │   ├── WinLossBreakdown.tsx
│   │   └── TopContributors.tsx
│   ├── rfp/
│   │   ├── PresenceIndicator.tsx
│   │   ├── ActivityLog.tsx
│   │   ├── ConflictResolver.tsx
│   │   └── OutcomeSelector.tsx
│   └── settings/
│       ├── IntegrationCard.tsx
│       ├── SlackConfigForm.tsx
│       ├── CrmConfigForm.tsx
│       └── SyncEventLog.tsx
└── lib/
    ├── db/schema/
    │   ├── analytics-snapshots.ts                # New table
    │   ├── integration-configs.ts                # New table
    │   └── sync-events.ts                        # New table
    ├── inngest/
    │   ├── client.ts                             # + 5 new event types
    │   └── functions/
    │       ├── compute-snapshots.ts              # Cron + fan-out
    │       ├── compute-org-snapshot.ts           # Per-org analytics
    │       ├── slack-notify.ts                   # Slack outbound
    │       ├── crm-sync-rfp.ts                   # CRM outbound
    │       └── retry-failed-sync.ts              # Admin retry
    └── services/
        ├── analytics.ts                          # Aggregation queries
        ├── integration-config.ts                 # CRUD + credential encrypt/decrypt
        └── sse-publisher.ts                      # KV pub/sub abstraction

tests/
├── unit/
│   ├── services/
│   │   ├── analytics.test.ts
│   │   └── integration-config.test.ts
│   ├── api/
│   │   ├── analytics.test.ts
│   │   ├── presence.test.ts
│   │   ├── outcome.test.ts
│   │   └── integrations.test.ts
│   └── components/
│       └── conflict-resolver.test.tsx
└── integration/
    └── inngest/
        ├── compute-org-snapshot.test.ts
        ├── slack-notify.test.ts
        └── crm-sync-rfp.test.ts
```

**Structure Decision**: Single Next.js monorepo (`src/` at repository root). No separate backend or frontend directories. Matches existing project structure throughout branches 001–003.
