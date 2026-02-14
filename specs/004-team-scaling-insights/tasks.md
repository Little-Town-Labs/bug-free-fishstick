# Tasks: Team Scaling & Business Insights

**Input**: Design documents from `/specs/004-team-scaling-insights/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Organization**: Tasks grouped by user story — each phase independently deliverable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema additions and Inngest event type registration that all three user stories depend on.

- [ ] T001 Create Drizzle migration file for new tables (`analytics_snapshots`, `integration_configs`, `sync_events`) and modified columns in `rfps` + `rfp_responses` in `drizzle/`
- [ ] T002 [P] Create `analytics_snapshots` Drizzle schema in `src/lib/db/schema/analytics-snapshots.ts` with `organizationId`, `snapshotDate`, `period`, `metricKey`, `dimensionKey`, `metricValue`, `metadataJson`, `computedAt` columns and unique constraint
- [ ] T003 [P] Create `integration_configs` Drizzle schema in `src/lib/db/schema/integration-configs.ts` with `organizationId`, `integrationType`, `isEnabled`, `credentialsEncrypted`, `configJson`, `status`, `lastVerifiedAt` columns and unique constraint
- [ ] T004 [P] Create `sync_events` Drizzle schema in `src/lib/db/schema/sync-events.ts` with `organizationId`, `integrationConfigId`, `integrationType`, `eventType`, `referenceId`, `status`, `inngestEventId`, `requestPayload`, `responsePayload`, `errorMessage`, `attemptCount`, `lastAttemptAt` columns
- [ ] T005 Add `outcome` (text nullable), `outcomeSetAt` (timestamp nullable), and `crmDealId` (text nullable) columns to `rfps` schema in `src/lib/db/schema/rfps.ts`
- [ ] T006 Add `version` (integer NOT NULL DEFAULT 1) column to `rfp_responses` schema in `src/lib/db/schema/rfp-responses.ts`
- [ ] T007 Export all new schemas from `src/lib/db/schema/index.ts`
- [ ] T008 Add 5 new Inngest event type definitions to `src/lib/inngest/client.ts`: `analytics/compute-snapshots`, `analytics/compute-org-snapshot`, `integration/slack-notify`, `integration/crm-sync-rfp`, `integration/retry-failed`

**Checkpoint**: Schema and event types ready — all phases can proceed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared service abstractions used by multiple user stories

**⚠️ CRITICAL**: Complete before user story implementation

- [ ] T009 Create `src/lib/services/sse-publisher.ts` — thin abstraction over Upstash Redis pub/sub that publishes and subscribes to `rfp-stream:{rfpId}` channels; export `publishFieldUpdate(rfpId, payload)` and `subscribeToRfpStream(rfpId, onMessage, signal)` using `@upstash/redis` subscribe API or `ioredis` with `UPSTASH_REDIS_URL`
- [ ] T010 Create `src/lib/services/integration-config.ts` — CRUD service for `integration_configs` and `sync_events`; export `getIntegrationConfig(orgId, type)`, `upsertIntegrationConfig(orgId, type, credentials, config)`, `deleteIntegrationConfig(orgId, type)`, `createSyncEvent(data)`, `updateSyncEvent(id, data)`, `listSyncEvents(orgId, filters)`; use existing `encrypt()`/`decrypt()` from `src/lib/services/encryption.ts` for `credentialsEncrypted`
- [ ] T011 Write unit test for `integration-config.ts` in `tests/unit/services/integration-config.test.ts` — mock `db` and `encryption` module; verify encrypt/decrypt is called, upsert uses `onConflictDoUpdate`, and credentials are never returned in list results

**Checkpoint**: Foundation ready — user story phases can begin

---

## Phase 3: User Story 1 - Analytics Dashboard (Priority: P1) 🎯 MVP

**Goal**: Pre-computed org metrics dashboard with date/customer/type filters, role-scoped views, and <30s to answer "what is our win rate this quarter?"

**Independent Test**: Navigate to `/analytics` as an admin with ≥5 completed RFPs; verify summary cards, volume chart, win/loss breakdown, and filters all render with correct data. Open as a non-admin; verify only own-assignment metrics appear.

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create `src/lib/services/analytics.ts` — export `computeOrgSnapshot(orgId, period, snapshotDate)` that runs Drizzle `sql` aggregations against `rfps`, `rfp_responses`, and `customers` tables computing win rate, volume by period, avg completion days, avg automation %, and top customers; returns typed `AnalyticsSnapshot[]` ready for upsert
- [ ] T013 [P] [US1] Create Inngest function `src/lib/inngest/functions/compute-org-snapshot.ts` — handles `analytics/compute-org-snapshot` event; calls `computeOrgSnapshot()` in `step.run()`; upserts results to `analytics_snapshots` via Drizzle `onConflictDoUpdate`; scopes all DB access by `organizationId`
- [ ] T014 [US1] Create Inngest function `src/lib/inngest/functions/compute-snapshots.ts` — handles `analytics/compute-snapshots` cron event; `step.run('fetch-org-ids')` fetches distinct `organizationId` values from `rfps`; `step.sendEvent('fan-out')` sends one `analytics/compute-org-snapshot` event per org (mirrors `content-library/batch-embed` pattern in `src/lib/inngest/functions/content-library-embedding.ts`)
- [ ] T015 [US1] Register `computeSnapshots` and `computeOrgSnapshot` functions in `src/app/api/inngest/route.ts`; add Inngest cron schedule for `analytics/compute-snapshots` every 30 minutes
- [ ] T016 [US1] Create `GET /api/analytics` route in `src/app/api/analytics/route.ts` — require auth; read `organizationId` from auth context; if admin, query `analytics_snapshots` with optional `period`, `startDate`, `endDate`, `customerId`, `rfpType` query params; if non-admin, additionally filter by `assignedUserId`; format response per `contracts/api.yaml` schema; return 200
- [ ] T017 [P] [US1] Create `src/components/analytics/MetricCard.tsx` — reusable card for a single metric (label, value, subtitle, trend indicator); accepts `metricKey`, `value`, `unit` props; uses shadcn/ui Card
- [ ] T018 [P] [US1] Create `src/components/analytics/VolumeChart.tsx` — bar chart of RFP volume over time using `recharts` (already in project via shadcn); accepts time-series data; includes accessible fallback `<table>` with same data for screen readers
- [ ] T019 [P] [US1] Create `src/components/analytics/WinLossBreakdown.tsx` — grouped bar or stacked chart of win/loss by RFP type; includes accessible data table fallback
- [ ] T020 [P] [US1] Create `src/components/analytics/TopContributors.tsx` — ranked list of team members by RFPs completed; rendered only when `isAdmin` is true; otherwise renders nothing
- [ ] T021 [US1] Create `src/components/analytics/AnalyticsDashboard.tsx` — composes MetricCard, VolumeChart, WinLossBreakdown, TopContributors; accepts analytics API response as props; renders filter bar (date range, customer select, RFP type select) with `onChange` handlers; shows "Data as of {dataAsOf}" timestamp; shows empty state when `totalRfps === 0`
- [ ] T022 [US1] Create analytics page `src/app/(auth)/analytics/page.tsx` — React Server Component; fetch `GET /api/analytics` server-side; pass data to `AnalyticsDashboard`; wrap in Suspense with skeleton
- [ ] T023 [US1] Add "Analytics" nav link to `src/app/(auth)/layout.tsx` sidebar
- [ ] T024 [P] [US1] Write unit test for `analytics.ts` service in `tests/unit/services/analytics.test.ts` — mock Drizzle `db`; verify `computeOrgSnapshot` produces correct aggregations for edge cases (zero RFPs, all statuses, multiple periods)
- [ ] T025 [P] [US1] Write integration test for `compute-org-snapshot` Inngest function in `tests/integration/inngest/compute-org-snapshot.test.ts` — mock DB with sample RFP data; assert `analytics_snapshots` upsert is called with correct metricKey/value pairs; verify org isolation

**Checkpoint**: Analytics dashboard fully functional — deploy/demo as MVP

---

## Phase 4: User Story 2 - Real-Time Collaboration (Priority: P2)

**Goal**: Live field-update broadcasting via SSE + Redis pub/sub; presence indicators; conflict detection via version column; activity log on RFP detail page.

**Independent Test**: Open same RFP in two browser tabs; edit a response field in Tab A and save; verify Tab B shows updated value within 5 seconds without refreshing. Verify both users' avatars appear in the presence indicator.

### Implementation for User Story 2

- [ ] T026 [P] [US2] Create `GET /api/rfps/[rfpId]/stream/route.ts` — SSE route handler; require auth and org-scoped RFP access; call `subscribeToRfpStream(rfpId, onMessage, request.signal)` from `sse-publisher.ts`; return `new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })`; send heartbeat every 30s; on disconnect (signal abort) unsubscribe
- [ ] T027 [P] [US2] Create `GET + POST /api/rfps/[rfpId]/presence/route.ts` — GET: read all `presence:{rfpId}:*` keys from Vercel KV, return active viewers list; POST (heartbeat): upsert `presence:{rfpId}:{userId}` KV key with `{ userId, displayName, avatarUrl, lastSeenAt }` and 30s TTL; require auth on both
- [ ] T028 [US2] Extend `PATCH /api/rfps/[rfpId]/responses/[responseId]/route.ts` — add `version` field to request body; before update, read current `version` from DB; if mismatch, return 409 with `{ error, currentVersion, currentValue, yourValue }`; on success, increment `version`, save, then call `publishFieldUpdate(rfpId, { responseId, fieldId, value, updatedBy, version })` from `sse-publisher.ts`; return updated record with new `version`
- [ ] T029 [P] [US2] Create `PATCH /api/rfps/[rfpId]/outcome/route.ts` — require auth; verify RFP status is `'finalized'`; update `rfps.outcome`, `rfps.outcomeSetAt`, optionally `rfps.crmDealId`; if CRM integration is configured for org, send `integration/crm-sync-rfp` Inngest event; return 200 with updated RFP fields
- [ ] T030 [P] [US2] Create `src/components/rfp/PresenceIndicator.tsx` — polls `GET /api/rfps/[rfpId]/presence` every 10s via `setInterval`; sends heartbeat via `POST /api/rfps/[rfpId]/presence` every 10s; renders up to 5 avatar circles with colored rings (extra viewers shown as "+N" badge); ARIA label: "Currently viewing: {names}"
- [ ] T031 [P] [US2] Create `src/components/rfp/ActivityLog.tsx` — renders chronological list of field edits; accepts `entries: ActivityLogEntry[]` prop where entries are derived from `rfp_responses` rows that include `updatedBy` (userId) and `updatedAt` fields already present in the response record (no new API route required); shows editor name, field label, timestamp; data passed down from the RFP detail page which already fetches all responses
- [ ] T032 [P] [US2] Create `src/components/rfp/ConflictResolver.tsx` — modal shown when 409 received; displays "Your version" vs "Current version" side by side; buttons: "Keep mine", "Use theirs", "Cancel"; on choice, submits with correct value and current version; keyboard navigable; ARIA role="dialog"
- [ ] T033 [P] [US2] Create `src/components/rfp/OutcomeSelector.tsx` — button group showing "Won" / "Lost" with confirmation dialog; only renders on RFPs with `status === 'finalized'`; includes optional CRM deal ID input; calls `PATCH /api/rfps/[rfpId]/outcome`; shows success/error toast
- [ ] T034 [US2] Integrate `PresenceIndicator`, `ActivityLog`, and `OutcomeSelector` into `src/app/(auth)/rfps/[id]/page.tsx` — add `EventSource` hook that subscribes to `/api/rfps/[rfpId]/stream` and applies incoming `field-updated` events to local response state; handle reconnect on stream close; render `PresenceIndicator` in page header; render `ActivityLog` below response list; render `OutcomeSelector` in action bar when status is `finalized`
- [ ] T035 [P] [US2] Write unit test for `sse-publisher.ts` in `tests/unit/services/sse-publisher.test.ts` — mock Upstash Redis; verify `publishFieldUpdate` serializes payload correctly; verify `subscribeToRfpStream` calls subscribe with correct channel name and unsubscribes on abort signal
- [ ] T036 [P] [US2] Write unit tests for presence and outcome routes in `tests/unit/api/presence.test.ts` and `tests/unit/api/outcome.test.ts` — mock KV and DB; verify 409 on version conflict; verify 400 when outcome set on non-finalized RFP; verify CRM event is sent when integration configured

**Checkpoint**: Real-time collaboration fully functional — both US1 and US2 independently verifiable

---

## Phase 5: User Story 3 - CRM/Slack Integrations (Priority: P3)

**Goal**: Admins configure Slack webhook and HubSpot/Salesforce connections from Settings; key RFP events trigger Slack notifications and CRM deal updates; failures surface in a sync event log with admin retry.

**Independent Test**: Configure Slack webhook in Settings → Integrations; trigger an RFP assignment; verify Slack message received. Configure HubSpot sandbox; mark an RFP as won; verify deal status updated in HubSpot sandbox.

### Implementation for User Story 3

- [ ] T037 [P] [US3] Create `src/lib/inngest/functions/slack-notify.ts` — handles `integration/slack-notify`; `step.run('fetch-config')` loads and decrypts Slack credentials via `integration-config.ts` service; `step.run('send-webhook')` POSTs to Slack webhook URL; `step.run('record-result')` writes `sync_events` record with status; `onFailure` sets `sync_events.status = 'failed'`; function config: `{ retries: 3 }`
- [ ] T038 [P] [US3] Create `src/lib/inngest/functions/crm-sync-rfp.ts` — handles `integration/crm-sync-rfp`; `step.run('fetch-config')` loads and decrypts CRM credentials; `step.run('sync-crm')` calls HubSpot or Salesforce API to update deal status based on `integrationType`; `step.run('record-result')` writes `sync_events`; `onFailure` sets `sync_events.status = 'failed'` and `integration_configs.status = 'error'` on 401/403; function config: `{ retries: 3 }` (per FR-015: up to 3 retry attempts)
- [ ] T039 [P] [US3] Create `src/lib/inngest/functions/retry-failed-sync.ts` — handles `integration/retry-failed`; loads `sync_events` record; re-sends the appropriate domain event (`integration/slack-notify` or `integration/crm-sync-rfp`) with original payload; updates `sync_events.attemptCount`; function config: `{ retries: 3 }`
- [ ] T040 [US3] Register `slackNotify`, `crmSyncRfp`, and `retryFailedSync` Inngest functions in `src/app/api/inngest/route.ts`
- [ ] T041 [P] [US3] Create `GET /api/settings/integrations/route.ts` — require auth; query `integration_configs` for org; return array of `IntegrationConfigSummary` (no credentials); non-admins see same view (read-only)
- [ ] T042 [P] [US3] Create `PUT + DELETE /api/settings/integrations/[type]/route.ts` — require admin; PUT: validate `type` is `slack|salesforce|hubspot`, encrypt credentials via `upsertIntegrationConfig()`, return summary; DELETE: call `deleteIntegrationConfig()`, return 204
- [ ] T043 [P] [US3] Create `POST /api/settings/integrations/[type]/test/route.ts` — require admin; decrypt credentials; for Slack: POST test message to webhook URL; for HubSpot/Salesforce: call a lightweight read endpoint (e.g., list users) to verify auth; return `{ success, message }`
- [ ] T044 [P] [US3] Create `GET /api/settings/integrations/sync-events/route.ts` — require admin; query `sync_events` for org with optional `status` and `integrationType` filters; return `SyncEventSummary[]` (no request/response payloads in list view)
- [ ] T045 [P] [US3] Create `POST /api/settings/integrations/sync-events/[syncEventId]/retry/route.ts` — require admin; verify `sync_events.status === 'failed'`; send `integration/retry-failed` Inngest event; return 202
- [ ] T046 [P] [US3] Create `src/components/settings/SlackConfigForm.tsx` — form with webhook URL input, multi-select checkboxes for `notifyOnStatus` event types; "Send Test Message" button calls test route; "Save" calls PUT route; shows connection status badge
- [ ] T047 [P] [US3] Create `src/components/settings/CrmConfigForm.tsx` — form for HubSpot or Salesforce manual token entry (access token + instance URL fields; no OAuth flow in this phase); optional CRM deal field mapping section; "Test Connection" button calls test route; "Save" calls PUT route; "Disconnect" calls DELETE route; shows current connection status badge
- [ ] T048 [P] [US3] Create `src/components/settings/IntegrationCard.tsx` — card rendering for a single integration type (icon, name, status badge, last verified timestamp, Configure/Disconnect actions); used in both Slack and CRM cards
- [ ] T049 [P] [US3] Create `src/components/settings/SyncEventLog.tsx` — table of sync events with status badge, error message, and Retry button; Retry calls retry route then refetches; shows empty state when no events
- [ ] T050 [US3] Create integrations settings page `src/app/(auth)/settings/integrations/page.tsx` — renders `IntegrationCard` for Slack, HubSpot, Salesforce; admin sees configure/disconnect controls; non-admin sees read-only status; renders `SyncEventLog` below for admins
- [ ] T051 [US3] Add "Integrations" link to `src/app/(auth)/settings/page.tsx` settings navigation and `src/app/(auth)/layout.tsx` if not already present
- [ ] T052 [US3] Wire Slack notifications into existing routes and workflow functions — (1) add `inngest.send('integration/slack-notify', { eventType: 'rfp_assigned', ... })` to `src/app/api/rfps/[rfpId]/assign/route.ts` after `assignedUserId` is updated (assignment happens here, not in process-rfp.ts); (2) add Slack event to `src/app/api/rfps/[rfpId]/approve/route.ts` for `rfp_approved` and `rfp_returned` event types; (3) add Slack event to `src/app/api/rfps/[rfpId]/outcome/route.ts` for `rfp_won`/`rfp_lost`; each call first checks `getIntegrationConfig(orgId, 'slack')` and skips silently if not configured
- [ ] T053 [P] [US3] Write integration test for `slack-notify.ts` in `tests/integration/inngest/slack-notify.test.ts` — mock `integration-config.ts`, mock global fetch; verify Slack webhook POST is called with correct payload; verify `sync_events` record created with `status: 'success'`; verify `status: 'failed'` on non-2xx response
- [ ] T054 [P] [US3] Write integration test for `crm-sync-rfp.ts` in `tests/integration/inngest/crm-sync-rfp.test.ts` — mock CRM HTTP calls; verify HubSpot and Salesforce branches each called correctly; verify `integration_configs.status` set to `'error'` on 401; verify retry Inngest event sent from admin route

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, caching, and housekeeping across all stories

- [ ] T055 [P] Add Vercel KV caching to `GET /api/analytics` in `src/app/api/analytics/route.ts` — cache key `analytics:{orgId}:{period}:{filters-hash}`, TTL 30 minutes; follow existing caching pattern from `src/app/api/rfps/route.ts`
- [ ] T056 [P] Add accessible data-table fallbacks to `VolumeChart.tsx` and `WinLossBreakdown.tsx` in `src/components/analytics/` — `<table aria-hidden="false">` with same data as chart; visually hidden via CSS; ensures WCAG 2.1 AA compliance for screen readers
- [ ] T057 [P] Add ARIA labels to `PresenceIndicator.tsx` — `aria-label="Currently viewing: {names}"` on container; each avatar `<span aria-label="{displayName}">` for screen reader access
- [ ] T058 [P] Verify `ConflictResolver.tsx` keyboard navigation — focus trap inside modal; Escape closes; Tab cycles through "Keep mine", "Use theirs", "Cancel"; add Vitest + testing-library test in `tests/unit/components/conflict-resolver.test.tsx`
- [ ] T059 Update `CLAUDE.md` with Phase 5 (004-team-scaling-insights) status note

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002–T004 and T005–T006 parallelizable
- **Phase 2 (Foundational)**: Depends on T007 (schema index) and T008 (event types) from Phase 1
- **Phase 3 (US1 Analytics)**: Depends on Phase 1 + Phase 2 completion
- **Phase 4 (US2 Collaboration)**: Depends on Phase 1 + Phase 2 completion; independent of Phase 3
- **Phase 5 (US3 Integrations)**: Depends on Phase 1 + Phase 2 + T029 (outcome route) from Phase 4
- **Phase 6 (Polish)**: Depends on all user story phases complete

### User Story Dependencies

- **US1**: Independent after Phase 2 — no dependency on US2 or US3
- **US2**: Independent after Phase 2 — no dependency on US1 or US3 (outcome route T029 used by US3 but owned by US2)
- **US3**: Depends on T029 (outcome route) from US2 for CRM trigger wiring (T052)

### Parallel Opportunities

Within Phase 1: T002, T003, T004 can run in parallel (separate schema files)

Within Phase 3 (US1): T012, T013 parallelizable; T017–T020 parallelizable after services done

Within Phase 4 (US2): T026, T027, T029, T030, T031, T032, T033 all touch different files — parallelizable

Within Phase 5 (US3): T037, T038, T039 parallelizable; T041–T049 all touch different files — parallelizable

---

## Parallel Example: User Story 1 (Analytics)

```text
# Services (parallel):
Task T012: analytics.ts service
Task T013: compute-org-snapshot.ts Inngest function

# After T012 + T013:
Task T014: compute-snapshots.ts cron (depends on T013)
Task T015: GET /api/analytics route (depends on T012)

# UI components (parallel after T012):
Task T017: MetricCard.tsx
Task T018: VolumeChart.tsx
Task T019: WinLossBreakdown.tsx
Task T020: TopContributors.tsx

# After all components:
Task T021: AnalyticsDashboard.tsx
Task T022: analytics page
```

## Parallel Example: User Story 3 (Integrations)

```text
# Inngest functions (parallel):
Task T037: slack-notify.ts
Task T038: crm-sync-rfp.ts
Task T039: retry-failed-sync.ts

# API routes (parallel):
Task T041: GET /api/settings/integrations
Task T042: PUT + DELETE /api/settings/integrations/[type]
Task T043: POST /api/settings/integrations/[type]/test
Task T044: GET /api/settings/integrations/sync-events
Task T045: POST sync-events/[id]/retry

# UI components (parallel):
Task T046: SlackConfigForm.tsx
Task T047: CrmConfigForm.tsx
Task T048: IntegrationCard.tsx
Task T049: SyncEventLog.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T008)
2. Complete Phase 2: Foundational (T009–T011)
3. Complete Phase 3: US1 Analytics (T012–T025)
4. **STOP and validate**: Admin can answer "What is our win rate?" from dashboard in <30s
5. Deploy/demo analytics dashboard

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 Analytics → Dashboard live (MVP!)
3. US2 Collaboration → Real-time editing enabled
4. US3 Integrations → Slack + CRM connected
5. Polish → Accessibility, caching hardening

### Parallel Team Strategy

After Phase 1 + 2 complete:
- Developer A: US1 Analytics (T012–T025)
- Developer B: US2 Collaboration (T026–T036)
- Developer C: US3 Integrations (T037–T054) *(start after T029 from Dev B)*

---

## Task Summary

| Phase | Tasks | Parallelizable | Story |
|---|---|---|---|
| Phase 1: Setup | T001–T008 | T002, T003, T004 | — |
| Phase 2: Foundational | T009–T011 | T009, T010 | — |
| Phase 3: US1 Analytics | T012–T025 | T012, T013, T017–T020, T024, T025 | US1 |
| Phase 4: US2 Collaboration | T026–T036 | T026, T027, T029–T033 | US2 |
| Phase 5: US3 Integrations | T037–T054 | T037, T038, T039, T041–T049, T053, T054 | US3 |
| Phase 6: Polish | T055–T059 | T055–T058 | — |
| **Total** | **59 tasks** | **~38 parallelizable** | |

---

## Notes

- [P] tasks = different files, no incomplete-task dependencies
- [Story] label maps task to user story for traceability
- Each user story independently completable and testable after Phase 2
- Commit after each logical group (schema, service, route, component)
- Stop at each phase checkpoint to validate independently before proceeding
- No tests-first requirement specified — tests included at end of each story phase for confidence
