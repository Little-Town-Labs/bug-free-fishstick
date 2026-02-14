# Feature Specification: Team Scaling & Business Insights

**Feature Branch**: `004-team-scaling-insights`
**Created**: 2026-02-14
**Status**: Draft
**Input**: User description: "P2 — Medium (team scaling & business insight): Analytics dashboard, real-time collaboration, CRM/Slack integrations"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analytics Dashboard (Priority: P1)

A team manager or admin wants to understand team performance, RFP win rates, and proposal quality trends over time. They navigate to an analytics dashboard that shows key metrics: number of RFPs processed, win/loss rates by customer or RFP type, average time-to-completion per stage, and top-performing team members. They can filter by date range, customer, or RFP type to drill into specific segments.

**Why this priority**: Business insight is the primary value driver of this P2 phase. Managers need data to make staffing, process, and pricing decisions. This is high-value, relatively self-contained, and has no real-time dependencies.

**Independent Test**: Can be tested by navigating to `/analytics` as an admin and verifying metric cards, charts, and filters render with accurate data derived from existing RFPs.

**Acceptance Scenarios**:

1. **Given** I am an admin with at least 5 completed RFPs, **When** I visit the analytics dashboard, **Then** I see summary cards for total RFPs, win rate %, average days to completion, and count of active team members.
2. **Given** the analytics dashboard is visible, **When** I apply a date-range filter (e.g., last 30 days), **Then** all metrics and charts update to reflect only RFPs within that range.
3. **Given** I filter by customer, **When** I select a specific customer, **Then** I see RFP history, win rate, and average response time for that customer only.
4. **Given** I am a non-admin member, **When** I visit the analytics dashboard, **Then** I see only metrics scoped to my own assignments (not org-wide data).
5. **Given** the analytics dashboard has no completed RFPs yet, **When** I visit it, **Then** I see an empty-state message guiding me to complete my first RFP.

---

### User Story 2 - Real-Time Collaboration (Priority: P2)

Multiple team members are working on the same RFP simultaneously. When one user edits a response field and saves, other users viewing the same RFP see the update appear without refreshing the page. A presence indicator shows which colleagues are currently viewing the RFP. Changes are attributed to the user who made them, and a simple activity log shows recent edits.

**Why this priority**: Reduces version conflicts and "who has the latest copy" confusion, which is a major pain point for distributed teams working on shared RFPs. Depends on the existing RFP editing infrastructure.

**Independent Test**: Can be tested by opening the same RFP in two browser sessions, editing a response in one, and verifying the change appears in the other within 5 seconds without a page reload.

**Acceptance Scenarios**:

1. **Given** two users have the same RFP open, **When** User A saves a change to a response, **Then** User B sees the updated content within 5 seconds without refreshing.
2. **Given** I am viewing an RFP, **When** another user opens the same RFP, **Then** I see their avatar/name appear in a presence indicator area.
3. **Given** two users edit different response fields simultaneously, **When** both save, **Then** both changes persist with no data loss and each is attributed to the correct user.
4. **Given** two users edit the same response field simultaneously, **When** the second user saves, **Then** the system warns of a conflict and presents both versions for manual resolution.
5. **Given** I am viewing the activity log, **When** any edit is made by any collaborator, **Then** I see a timestamped entry with the editor's name and field changed.

---

### User Story 3 - CRM/Slack Integrations (Priority: P3)

A team member configures the platform to send Slack notifications for key events (new RFP assigned, approval required, RFP won/lost). Separately, an admin connects a CRM (HubSpot or Salesforce) so that when an RFP is marked won, the linked deal is automatically updated in the CRM. Both integrations are configured per-organization from the Settings page.

**Why this priority**: Integrations reduce context-switching and manual data entry, but are lower priority because they depend on external services, have higher implementation complexity, and the core workflow functions without them.

**Independent Test**: Slack integration can be tested independently by configuring a webhook URL and triggering an RFP status change to verify a Slack message is sent. CRM integration can be tested by connecting a sandbox CRM account and marking an RFP as won.

**Acceptance Scenarios**:

1. **Given** I am an admin, **When** I enter a Slack webhook URL in settings and save, **Then** the platform sends a test message to confirm the connection.
2. **Given** Slack notifications are enabled, **When** a new RFP is assigned to me, **Then** I receive a Slack message with the RFP name and a deep link.
3. **Given** Slack notifications are enabled, **When** an RFP I submitted is approved or returned, **Then** the submitter receives a Slack notification with the outcome and any return comments.
4. **Given** CRM integration is configured, **When** an RFP is marked as won, **Then** the linked CRM deal is updated to "Closed Won" status automatically.
5. **Given** CRM integration is configured but the external service is unreachable, **When** an RFP is marked won, **Then** the platform records the pending sync and retries, and the user sees a non-blocking warning.
6. **Given** I am an admin, **When** I disconnect an integration, **Then** all future events stop being sent and existing data is unaffected.

---

### Edge Cases

- What happens when a user views the analytics dashboard with zero completed RFPs? → Display empty-state guidance.
- What happens if two users edit the same field at the exact same moment? → The second save is rejected with a conflict warning; the later saver is shown both versions (their own and the current saved version) and must manually choose which to keep. No automatic resolution occurs (see FR-010).
- What happens if the Slack webhook URL is invalid or revoked? → Notify the admin via in-app alert; disable the integration until reconfigured.
- What happens when CRM sync fails after all retries? → Mark the sync as permanently failed, surface an action item for the admin, and do not block the RFP workflow.
- What happens when a non-admin tries to configure integrations? → Settings page shows integrations as view-only with a note that admin rights are required.
- What if a user's CRM credentials expire mid-session? → Integration status shows "requires reconnection"; events queue until reconnected or integration is disabled.

## Requirements *(mandatory)*

### Functional Requirements

**Analytics Dashboard**

- **FR-001**: The system MUST display an analytics dashboard accessible to all authenticated users, with admin users seeing org-wide data and non-admin users seeing only metrics for their own assignments.
- **FR-002**: The dashboard MUST display summary metrics: total RFPs processed, win rate percentage, average days to completion, and count of active team members.
- **FR-003**: The dashboard MUST include visualizations showing RFP volume over time and win/loss breakdown by RFP type.
- **FR-004**: Users MUST be able to filter all dashboard metrics by date range, customer, and RFP type.
- **FR-005**: The dashboard MUST show top contributors ranked by RFPs completed (admin view only).
- **FR-006**: Analytics data displayed MUST be no more than 1 hour stale.

**Real-Time Collaboration**

- **FR-007**: The system MUST reflect edits saved by one user to all other users currently viewing the same RFP within 5 seconds, without requiring a page reload.
- **FR-008**: The system MUST display a presence indicator on the RFP detail page showing the names or avatars of all users currently viewing that RFP.
- **FR-009**: Each saved change MUST be attributed to the user who made it and appear in a chronological activity log on the RFP.
- **FR-010**: When two users attempt to save conflicting edits to the same response field, the system MUST warn the later saver and present both versions for manual resolution.

**CRM/Slack Integrations**

- **FR-011**: Admin users MUST be able to configure a Slack webhook URL per organization and select which event types trigger notifications (new assignment, approval required, RFP won/lost).
- **FR-012**: The system MUST send a Slack notification for each enabled event type to the configured webhook within 30 seconds of the triggering event.
- **FR-013**: Admin users MUST be able to connect and disconnect a CRM integration (HubSpot or Salesforce) from the organization settings page.
- **FR-014**: When an RFP is marked won, the system MUST attempt to update the linked CRM deal status to "Closed Won".
- **FR-015**: The system MUST retry failed CRM sync attempts up to 3 times with increasing delays and surface a persistent admin alert if all retries fail.
- **FR-016**: Non-admin users MUST NOT be able to create, modify, or delete integration configurations.

### Key Entities

- **AnalyticsSnapshot**: Aggregated org-level metrics (win rate, volume, avg completion time) computed periodically; scoped by date range, customer, RFP type.
- **CollaborationSession**: Tracks which users are currently viewing a given RFP; expires on navigation away or inactivity timeout.
- **ActivityLogEntry**: A record of a field change on an RFP — who changed it, when, previous value, and new value.
- **IntegrationConfig**: Per-organization configuration for an external integration (type: slack | crm, credentials/webhook URL, enabled event list, connection status).
- **SyncEvent**: A pending or completed outbound event to an external integration, with retry count and last-attempt timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Managers can answer "What is our win rate this quarter?" by visiting the analytics dashboard in under 30 seconds without exporting data to a spreadsheet.
- **SC-002**: Teams with 3 or more simultaneous RFP editors experience zero data loss — all concurrent edits are either merged or surfaced for manual resolution.
- **SC-003**: 90% of Slack notifications are delivered within 30 seconds of the triggering event under normal load.
- **SC-004**: CRM deal status updates succeed on first attempt for at least 95% of "RFP won" events under normal conditions.
- **SC-005**: Admin users can configure a new Slack or CRM integration end-to-end in under 5 minutes.
- **SC-006**: All displayed analytics metrics are no more than 1 hour stale.

## Assumptions

- CRM integration scope is limited to HubSpot and Salesforce for this phase; other CRMs are out of scope.
- Real-time collaboration is scoped to the response-editing view on the RFP detail page; the proposal draft wizard is out of scope for this phase.
- Analytics data is computed from the existing `rfps`, `responses`, and `customers` tables; no separate data warehouse is introduced at this stage.
- Slack integration uses incoming webhooks (not a Slack App with per-user OAuth); notifications are org-level, not per-user DMs.
- CRM deal linking assumes a CRM deal ID is stored on the RFP record (manually entered); auto-discovery of deals is out of scope.
- Win/loss outcome tracking requires new "won" and "lost" RFP statuses to be added to the existing workflow beyond the current approve/finalize states.

## Dependencies

- Existing RFP workflow (approve/finalize states) — needs "won/lost" outcome states added.
- Existing customer profiles (P0, `002-p0-critical-gaps`) — analytics customer filter depends on the customer entity.
- Existing user/role system (US5) — admin vs. member permission checks reused for analytics scoping and integration config guards.
- Existing Inngest event pipeline — CRM sync retries and async Slack delivery will use Inngest background functions.
