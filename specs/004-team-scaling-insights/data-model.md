# Data Model: Team Scaling & Business Insights

**Branch**: `004-team-scaling-insights`
**Date**: 2026-02-14

---

## New Tables

### `analytics_snapshots`

Stores pre-computed, org-scoped metric snapshots written by the Inngest cron job. Served to the dashboard without join-heavy queries.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organizationId` | text NOT NULL | Clerk org ID; indexed |
| `snapshotDate` | date NOT NULL | Truncated to day of computation |
| `period` | text NOT NULL | `'day' \| 'week' \| 'month'` |
| `metricKey` | text NOT NULL | `'win_rate' \| 'volume' \| 'avg_completion_days' \| 'avg_automation_pct' \| 'top_customer'` |
| `dimensionKey` | text | Nullable; `'complexity:complex'`, `'customer:{uuid}'`, etc. Null = org total |
| `metricValue` | real NOT NULL | Numeric value of the metric |
| `metadataJson` | jsonb | Arbitrary breakdown: `{ label, count, breakdown: [] }` |
| `computedAt` | timestamp NOT NULL | When this snapshot was computed |

**Unique constraint**: `(organizationId, snapshotDate, period, metricKey, dimensionKey)`
**Index**: `organizationId, period, metricKey` (covering index for dashboard reads)

---

### `integration_configs`

Per-organization configuration for external integrations. One row per org per integration type.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organizationId` | text NOT NULL | Clerk org ID |
| `integrationType` | text NOT NULL | `'slack' \| 'salesforce' \| 'hubspot'` |
| `isEnabled` | boolean NOT NULL | default `true`; admin can disable without deleting |
| `credentialsEncrypted` | text NOT NULL | `encrypt(JSON.stringify({ accessToken?, refreshToken?, webhookUrl?, instanceUrl? }))` |
| `configJson` | jsonb NOT NULL | Non-secret config: `{ notifyOnStatus: string[], channelId?, fieldMappings? }` |
| `status` | text NOT NULL | `'active' \| 'error' \| 'requires_reconnect'` default `'active'` |
| `lastVerifiedAt` | timestamp | When credentials were last confirmed valid |
| `createdAt` | timestamp NOT NULL | |
| `updatedAt` | timestamp NOT NULL | |

**Unique constraint**: `(organizationId, integrationType)`
**Index**: `organizationId`

---

### `sync_events`

Audit log and recoverable dead-letter queue for all outbound integration calls.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organizationId` | text NOT NULL | For tenant-scoped admin UI queries |
| `integrationConfigId` | uuid NOT NULL | FK → `integration_configs.id` |
| `integrationType` | text NOT NULL | Denormalized for fast filtering without join |
| `eventType` | text NOT NULL | `'rfp_status_changed' \| 'rfp_finalized' \| 'rfp_won'` |
| `referenceId` | text NOT NULL | `rfpId` or other entity ID that triggered the sync |
| `status` | text NOT NULL | `'pending' \| 'success' \| 'failed' \| 'skipped'` |
| `inngestEventId` | text | Inngest event ID for correlation with Inngest dashboard |
| `requestPayload` | jsonb | What was sent (secrets redacted) |
| `responsePayload` | jsonb | What was received |
| `errorMessage` | text | Human-readable error on failure |
| `attemptCount` | integer NOT NULL | default `0` |
| `lastAttemptAt` | timestamp | |
| `createdAt` | timestamp NOT NULL | |

**Index**: `organizationId, status` (for admin "failed syncs" view)
**Index**: `referenceId` (for RFP-level integration status queries)

---

## Modified Tables

### `rfps` — New columns

| Column | Type | Notes |
|---|---|---|
| `outcome` | text | `'won' \| 'lost' \| null`; null until explicitly set |
| `outcomeSetAt` | timestamp | When outcome was recorded |
| `crmDealId` | text | External CRM deal reference ID (manually entered or future import) |

**Note**: `outcome` extends the existing workflow beyond `finalized`. A finalized RFP can subsequently be marked won or lost. The existing `status` enum is NOT extended — outcome is a separate concern.

### `rfp_responses` — New column

| Column | Type | Notes |
|---|---|---|
| `version` | integer NOT NULL | default `1`; incremented on each save; used for optimistic locking in real-time conflict detection |

---

## Vercel KV Keys (not DB tables)

These live in Vercel KV (Upstash Redis) and expire automatically — no DB migration required.

| Key Pattern | Value | TTL | Purpose |
|---|---|---|---|
| `presence:{rfpId}:{userId}` | `{ userId, displayName, avatarUrl, color, lastSeenAt }` JSON | 30s | Active viewer presence |
| `analytics:{orgId}:{period}` | Serialized analytics snapshot JSON | 30 min | Dashboard response cache |
| `rfp-stream:{rfpId}` | Redis pub/sub channel (no stored value) | — | Field-update broadcast channel identifier |

---

## Entity Relationships

```
organizations (Clerk)
├── analytics_snapshots (1:many, orgId)
├── integration_configs (1:few, unique per type)
│   └── sync_events (1:many)
└── rfps (existing)
    ├── rfp_responses (existing, + version column)
    └── outcome / crmDealId (new columns)
```

---

## Migration Notes

- New tables: `analytics_snapshots`, `integration_configs`, `sync_events` → new Drizzle migration file
- Modified: `rfps` table — add `outcome text`, `outcomeSetAt timestamp`, `crmDealId text` (all nullable, no breaking change)
- Modified: `rfp_responses` table — add `version integer NOT NULL DEFAULT 1` (no breaking change)
- No existing columns removed or renamed
