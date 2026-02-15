# Quickstart: Team Scaling & Business Insights

**Branch**: `004-team-scaling-insights`
**Date**: 2026-02-14

This guide covers how to set up, configure, and use the three new features in this release.

---

## Analytics Dashboard

### Access

Navigate to **Analytics** in the left sidebar. Admins see org-wide metrics; other team members see metrics for their own assignments only.

### Filters

Use the filter bar at the top to scope data by:
- **Date range** — choose a preset (Last 7 days, Last 30 days, Last quarter) or set a custom range
- **Customer** — scope all metrics to a single customer
- **RFP Type** — filter by technical, commercial, compliance, or mixed

### Data freshness

Metrics are refreshed automatically every 30 minutes. The **"Data as of"** timestamp in the top-right corner shows when the last snapshot was computed.

### Available metrics

| Metric | Description |
|---|---|
| Total RFPs | Count of all RFPs processed in the selected period |
| Win Rate | Finalized RFPs marked "won" ÷ total completed |
| Avg Completion | Average calendar days from receipt to finalization |
| Active Members | Count of users with at least one RFP assignment |
| Volume Over Time | Bar chart of RFP count per day/week/month |
| Win/Loss by Type | Breakdown of outcomes per RFP type |
| Top Contributors | (Admin only) Ranked by RFPs completed |

---

## Real-Time Collaboration

### How it works

When multiple team members open the same RFP, you'll see:
- **Presence avatars** in the top-right corner showing who else is viewing the RFP
- **Live field updates** — when a colleague saves a response, you see the change immediately (within 5 seconds) without refreshing

### Saving responses

Response fields have an optimistic save with version tracking. If two people edit the **same field** at the same time:
1. The first save goes through normally
2. The second person sees a **Conflict** banner with both versions
3. They choose which version to keep (or manually merge text)

Different fields can be edited simultaneously with no conflicts.

### Activity log

Scroll to the bottom of the RFP detail page to see a chronological activity log of all edits, including who changed what and when.

### Connection notes

The live connection refreshes automatically approximately every 60 seconds. You may briefly see a "Reconnecting..." indicator — this is normal and no changes are lost.

---

## CRM & Slack Integrations

### Prerequisites

- You must be an **org admin** to configure integrations
- Navigate to **Settings → Integrations**

### Slack Setup

1. In your Slack workspace, create an **Incoming Webhook** (Slack Apps → Incoming Webhooks)
2. Copy the webhook URL
3. In RFP Automator, go to **Settings → Integrations → Slack**
4. Paste the webhook URL and click **Send Test Message**
5. Choose which events send notifications:
   - New RFP assigned to me
   - Approval required
   - RFP approved / returned
   - RFP marked won / lost
6. Click **Save**

### CRM Setup (HubSpot or Salesforce)

1. Go to **Settings → Integrations → HubSpot** (or Salesforce)
2. Click **Connect** — you'll be redirected to authorize the connection
3. After authorization, return to settings and configure field mappings if needed
4. Events that trigger a CRM sync:
   - RFP marked **Won** → linked deal updated to "Closed Won"
   - RFP marked **Lost** → linked deal updated to "Closed Lost"

### Marking an RFP as Won or Lost

On any **finalized** RFP, use the **Outcome** button in the top action bar:
- Select **Won** or **Lost**
- Optionally enter or confirm the CRM deal ID to link
- Click **Save Outcome**

If a CRM integration is configured, the sync happens automatically in the background.

### Monitoring integration health

In **Settings → Integrations**, each integration card shows its current status:
- **Active** — working normally
- **Error** — last sync failed; view details
- **Requires Reconnect** — credentials expired; click **Reconnect**

Click **View Sync History** to see a log of all outbound sync attempts, including failures with error details and a **Retry** button for failed events.

---

## Local Development

### Environment variables (add to `.env.local`)

```bash
# Vercel KV (Upstash Redis) — already required for caching
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# For SSE pub/sub (Upstash Redis subscribe endpoint)
UPSTASH_REDIS_URL=rediss://...   # ioredis-compatible URL

# Encryption key — already required (64 hex chars)
ENCRYPTION_KEY=...
```

### Running the analytics cron locally

The analytics cron function runs every 30 minutes in production. To trigger it manually in development:

```bash
# Via Inngest Dev Server (http://localhost:8288)
# Navigate to Functions → analytics/compute-snapshots → Invoke
```

Or use the Inngest CLI:

```bash
npx inngest-cli@latest dev
# Then invoke via the UI or API
```

### Testing SSE locally

Open two browser tabs to the same RFP detail page while running `npm run dev`. Edit a response in one tab and observe the update in the other.
