# Inngest Event Contracts: Team Scaling & Business Insights

**Branch**: `004-team-scaling-insights`
**Date**: 2026-02-14

All events follow the existing `domain/verb-noun` naming convention from `src/lib/inngest/client.ts`.

---

## New Events

### `analytics/compute-snapshots`

**Trigger**: Inngest cron — every 30 minutes
**Producer**: Inngest cron schedule
**Consumer**: `compute-snapshots` Inngest function

```typescript
{
  name: 'analytics/compute-snapshots',
  data: {} // no payload; function fetches all org IDs internally
}
```

---

### `analytics/compute-org-snapshot`

**Trigger**: Fan-out from `analytics/compute-snapshots`, one per organization
**Producer**: `compute-snapshots` function
**Consumer**: `compute-org-snapshot` Inngest function

```typescript
{
  name: 'analytics/compute-org-snapshot',
  data: {
    organizationId: string,
    period: 'day' | 'week' | 'month',
    snapshotDate: string // ISO date string
  }
}
```

---

### `integration/slack-notify`

**Trigger**: Fired from existing Inngest functions at status transition points
**Producer**: `process-rfp`, `rfp-workflow` (approve/return/finalize), `rfp-outcome` functions
**Consumer**: `slack-notify` Inngest function

```typescript
{
  name: 'integration/slack-notify',
  data: {
    organizationId: string,
    eventType: 'rfp_assigned' | 'approval_required' | 'rfp_approved' | 'rfp_returned' | 'rfp_won' | 'rfp_lost',
    rfpId: string,
    rfpName: string,
    targetUserId?: string,   // for assignment notifications
    returnComments?: string, // for return notifications
    deepLinkPath: string     // e.g. '/rfps/{rfpId}'
  }
}
```

---

### `integration/crm-sync-rfp`

**Trigger**: Fired when an RFP outcome (won/lost) is set via `PATCH /api/rfps/{rfpId}/outcome`
**Producer**: RFP outcome route / Inngest step
**Consumer**: `crm-sync-rfp` Inngest function

```typescript
{
  name: 'integration/crm-sync-rfp',
  data: {
    organizationId: string,
    rfpId: string,
    rfpName: string,
    outcome: 'won' | 'lost',
    crmDealId?: string,       // if present, update this deal; otherwise attempt lookup
    customerId?: string,
    customerName?: string,
    outcomeSetAt: string      // ISO timestamp
  }
}
```

---

### `integration/retry-failed`

**Trigger**: Admin clicks "Retry" on a failed sync event in settings UI
**Producer**: `POST /api/settings/integrations/sync-events/{id}/retry`
**Consumer**: `retry-failed-sync` Inngest function

```typescript
{
  name: 'integration/retry-failed',
  data: {
    organizationId: string,
    syncEventId: string,      // references sync_events.id
    integrationType: 'slack' | 'salesforce' | 'hubspot',
    originalEventType: string
  }
}
```

---

## Existing Events Modified

### `rfp/capture-learning` — no change to schema

The real-time response PATCH endpoint (`PATCH /api/rfps/{rfpId}/responses/{responseId}`) will fire `rfp/capture-learning` with `type: 'edit'` when a user modifies a field. This is already supported by the existing event schema — no changes needed.

---

## Integration Function Retry Configuration

All integration Inngest functions use step-level retries (not function-level), so only the outbound HTTP call retries — not config fetch, DB writes, or audit log creation.

| Function | Retries | Backoff | onFailure action |
|---|---|---|---|
| `slack-notify` | 3 | Inngest default exponential (1s, 2s, 4s) | Update `sync_events.status = 'failed'`; log error |
| `crm-sync-rfp` | 5 | Inngest default exponential | Update `sync_events.status = 'failed'`; set `integration_configs.status = 'error'` if 401/403 |
| `retry-failed-sync` | 3 | Inngest default exponential | Update `sync_events.status = 'failed'`; notify admin |
