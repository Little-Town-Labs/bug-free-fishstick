# Research: Team Scaling & Business Insights

**Branch**: `004-team-scaling-insights`
**Date**: 2026-02-14
**Status**: Complete — all unknowns resolved

---

## 1. Analytics Dashboard

### Decision: Inngest Cron Job → `analytics_snapshots` Table (Read from Vercel KV Cache)

**Rationale**: Staleness tolerance is 1 hour, so real-time aggregation queries per page load are unnecessary and expensive on Neon PostgreSQL's serverless connection model. Pre-computed snapshots written by a background Inngest job, served from a narrow snapshot table (and cached in Vercel KV), give sub-millisecond dashboard reads.

**How it works**:
- An Inngest cron function (`analytics/compute-snapshots`) runs every 30 minutes.
- It fans out per-organization: `analytics/compute-org-snapshot` events, each computing win rate, volume time series, avg completion days, and top-customer breakdowns via Drizzle `sql` tagged aggregations.
- Results upsert into `analytics_snapshots` keyed by `(organizationId, snapshotDate, period, metricKey, dimensionKey)`.
- `GET /api/analytics` reads from this table; Vercel KV caches the response (TTL 30 minutes) using the existing caching pattern.

**Metrics computable from existing schema**:

| Metric | Source |
|---|---|
| Win rate | `rfps.status` — finalized / total |
| Volume over time | `rfps.createdAt` bucketed by day/week/month |
| Avg completion days | `rfps.completionDate - rfps.receiveDate` |
| Automation % | `rfps.automationPercentage` by `rfps.complexity` |
| Top customers | `rfps.customerId` JOIN `customers.name` |
| Avg confidence | `rfp_responses.confidenceScore` |

**Alternatives rejected**:
- Ad-hoc aggregation queries per page load — Neon serverless cold-start latency compounds under load; degrades at P99.
- PostgreSQL materialized views — require pg_cron or an external trigger to refresh; unnecessary complexity.
- Separate data warehouse — disproportionate at this scale.

---

## 2. Real-Time Collaboration & Presence

### Decision: SSE Route Handlers + Vercel KV Pub/Sub for Field Updates; KV TTL Keys for Presence

**Rationale**: Vercel serverless functions do not support persistent WebSocket connections (60s max duration). Server-Sent Events via Next.js 15 App Router route handlers work natively. Vercel KV (Upstash Redis) pub/sub bridges the "no shared memory between serverless instances" problem using infrastructure already in the project.

**Field update broadcasting**:
- After a response field is saved via `PATCH /api/rfps/[rfpId]/responses/[responseId]`, publish a Redis pub/sub message to channel `rfp-stream:{rfpId}`.
- `GET /api/rfps/[rfpId]/stream` — SSE route handler subscribes to that Redis channel and forwards messages as SSE frames.
- Client uses native `EventSource` API with reconnect wrapper (SSE auto-reconnects; client re-syncs state from DB after reconnect).
- Upstash Redis `@upstash/redis` subscribe API (v1.28+) or `ioredis` with `rediss://` connection string.

**Presence**:
- `POST /api/rfps/[rfpId]/presence` — heartbeat every 10s; upserts `presence:{rfpId}:{userId}` KV key with 30s TTL and user display data.
- `GET /api/rfps/[rfpId]/presence` — reads KV keys for that RFP, returns active users. Client polls every 10–15s.
- No DB table needed — KV TTL expiry handles cleanup automatically.

**Conflict detection**:
- `rfp_responses` gains a `version: integer` column. PATCH routes return 409 on version mismatch. Client shows conflict UI with both versions for manual resolution.

**Constraints**:
- SSE connections terminate at Vercel's max Function duration (~60s on Pro). Client must handle graceful reconnect and state re-sync.
- Upstash Redis HTTP client does not support pub/sub; must use subscribe API or `ioredis` with `rediss://` URL.

**Alternatives rejected**:
- Liveblocks / Partykit — hosted WebSocket solutions that handle CRDTs and presence natively; rejected due to per-seat pricing and third-party auth integration complexity. Revisit if collaboration becomes a core differentiator.
- Pusher / Ably — per-message pricing, additional vendor dependency.
- Pure polling — chatty (100–150 req/min at 10 concurrent users); acceptable fallback only.
- Separate WebSocket server — splits deployment topology; adds infra complexity.

---

## 3. CRM/Slack Integrations

### Decision: Inngest Event Fan-Out with Dedicated `integration_configs` + `sync_events` Tables; Existing `encrypt()`/`decrypt()` for Credentials

**Rationale**: Extends existing patterns directly — the `tenantSettings` encrypted credential pattern, the Inngest event naming convention, and the `onConflictDoUpdate` upsert used in settings. Integration concerns stay out of API route handlers by triggering integration events from within existing Inngest step functions.

**Inngest event naming** (following existing `domain/verb-noun` convention):
- `integration/slack-notify` — send Slack webhook message
- `integration/crm-sync-rfp` — push RFP data to CRM
- `integration/retry-failed` — admin-triggered retry of a failed `sync_events` record

**Step-level retry pattern**:
- Each outbound HTTP call is wrapped in its own `step.run('send-webhook')` — Inngest memoizes completed steps across retries, so only the failing HTTP call retries (not config fetch or DB writes).
- `onFailure` handler writes final `status: 'failed'` to `sync_events` and emits an in-app alert.

**Triggering integration events**:
- Triggered from within existing Inngest functions at logical transition points (e.g., end of `process-rfp.ts` → send `integration/crm-sync-rfp`), not from API route handlers. This preserves step-memoization guarantees and keeps route handlers clean.

**Credential storage**:
- `credentialsEncrypted` uses `encrypt(JSON.stringify({ accessToken, webhookUrl, ... }))` — same `src/lib/services/encryption.ts` AES-256-GCM service, no new crypto code.
- `configJson` JSONB stores non-secret config (channel IDs, field mappings, `notifyOnStatus[]`).

**Alternatives rejected**:
- Direct HTTP calls from API route handlers — no retry, no durability; sync silently lost if external API is down.
- Adding integration columns to `tenantSettings` — breaks normalization at 2+ integrations.
- Zapier/Make.com — no audit trail ownership, no org-scoped credential management, no custom field mapping.
