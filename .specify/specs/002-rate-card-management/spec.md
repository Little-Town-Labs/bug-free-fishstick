# Feature Specification: Rate Card Management

**Feature ID:** F2
**Branch:** `002-rate-card-management`
**PRD Source:** §5 US1, §6.1
**Depends on:** F1 (`001-data-model-foundation`)
**Blocks:** F5 (pricing engine), F6 (scope questions)
**Priority:** P0 — Critical
**Status:** Draft

---

## Overview

Org admins need a reliable, structured way to configure their organization's pricing information before generating proposals. Currently, proposals have no pricing section because there is nowhere to store rate data. This feature delivers the settings UI and API for the organization rate card — the single source of truth for how the supplier prices work.

A rate card holds: the billing mode (blended or by-role), the per-role or blended rates, the default margin percentage, the preferred pricing model, and any customer-specific discount rules. Once configured, this data feeds the deterministic pricing computation engine (F5) so that every proposal contains an accurate, automatically computed pricing table.

**What this feature is NOT:** It does not compute pricing (that is F5). It does not display pricing in proposals. It is exclusively the settings surface for storing and maintaining rate card configuration.

---

## User Stories

### US-001: View Rate Card Configuration

**As a** Supplier Admin
**I want to** see my current rate card configuration on the settings page
**So that** I can verify pricing is set up correctly before generating proposals

**Acceptance Criteria:**
- [ ] The settings page has a dedicated Rate Card section
- [ ] When a rate card is saved, all current values are displayed (mode, rates, margin, pricing model, payment terms, discounts)
- [ ] When no rate card has been configured, the section shows a clear empty state with an invitation to configure
- [ ] The display distinguishes between blended mode and by-role mode

**Priority:** High

---

### US-002: Configure Blended Rate

**As a** Supplier Admin
**I want to** configure a single blended rate that applies to all work
**So that** proposals quote a uniform rate without listing individual roles

**Acceptance Criteria:**
- [ ] Admin can select "Blended" mode
- [ ] Admin enters one rate value and selects a unit (hour, day, or fixed)
- [ ] The blended rate is validated as a positive number (zero is not allowed)
- [ ] Switching to blended mode from by-role mode discards the role list (a warning is shown before discarding)
- [ ] Saved blended rate is retrieved correctly on next page load

**Priority:** High

---

### US-003: Configure By-Role Rate Card

**As a** Supplier Admin
**I want to** define individual rates per role so proposals reflect actual staffing costs

**Acceptance Criteria:**
- [ ] Admin can select "By Role" mode
- [ ] Admin can add a role by entering a name, unit (hour/day/fixed), and rate
- [ ] Admin can edit the name, unit, or rate of an existing role
- [ ] Admin can remove a role (the system prevents saving with zero roles)
- [ ] Role names are required and must be unique within the rate card
- [ ] Each role rate is validated as a positive number (zero not allowed)
- [ ] Switching to by-role mode from blended mode preserves any previously entered roles

**Priority:** High

---

### US-004: Set Pricing Defaults

**As a** Supplier Admin
**I want to** configure the default pricing model, margin, payment terms, and warranty period
**So that** proposals are generated with the correct commercial structure

**Acceptance Criteria:**
- [ ] Admin can set default margin percentage (0–100%, saved internally as decimal 0–1)
- [ ] Admin can select default pricing model: Time & Materials, Fixed Price, or Cost-Plus
- [ ] Admin can set default payment terms in days (non-negative integer, e.g. 30 for Net 30)
- [ ] Admin can set default warranty period in days (non-negative integer)
- [ ] Admin can set the rate card currency (3-letter uppercase ISO 4217 code)
- [ ] All five defaults are saved and retrieved together with the rate card
- [ ] Invalid values (negative days, margin > 100, non-ISO currency) are rejected with a clear per-field error

**Priority:** High

---

### US-005: Manage Discount Rules

**As a** Supplier Admin
**I want to** define discount rules that are applied after margin in proposals
**So that** negotiated customer discounts are reflected automatically in pricing

**Acceptance Criteria:**
- [ ] Admin can add a discount rule with: name, type (percentage or fixed), value, applies-to (subtotal or total), and optionally a list of customer IDs the discount applies to
- [ ] Percentage discounts accept a value between 0% and 100% (stored internally as decimal fraction 0–1)
- [ ] Fixed discounts accept a non-negative currency amount
- [ ] Admin can edit an existing discount rule
- [ ] Admin can remove a discount rule
- [ ] Discount rules are displayed as an ordered list; admin can reorder them
- [ ] The order of discount rules determines the order they are applied during pricing computation
- [ ] A discount with no customer IDs applies to all proposals (universal discount)
- [ ] Saving a discount with customer IDs requires at least one customer ID to be entered

**Priority:** Medium

---

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-001 | The settings page exposes a Rate Card section accessible to authenticated org admins |
| FR-002 | Rate card has two modes: **blended** (single rate) and **by_role** (named roles) |
| FR-003 | In blended mode, the admin enters exactly one rate value and one unit (hour / day / fixed) |
| FR-004 | The blended rate value must be a positive number; zero is not valid |
| FR-005 | In by-role mode, the admin manages a list of roles; each role has a name (string), unit (hour / day / fixed), and rate (positive number) |
| FR-006 | At least one role is required when saving in by-role mode |
| FR-007 | Role names must be non-empty; uniqueness within the rate card is enforced |
| FR-008 | Admin can set default margin percentage, validated as a decimal fraction 0–1 (representing 0–100%) |
| FR-009 | Admin can set the rate card currency as a 3-letter uppercase string conforming to ISO 4217 (e.g. USD) |
| FR-010 | Admin can select the default pricing model from: time_and_materials, fixed_price, cost_plus |
| FR-011 | Admin can set default payment terms (integer ≥ 0, representing days) |
| FR-012 | Admin can set default warranty period (integer ≥ 0, representing days) |
| FR-013 | Admin can add discount rules; each has: name, type (percentage / fixed), value, appliesTo (subtotal / total), customerIds (array of strings or null) |
| FR-014 | Percentage discount value is validated as 0–1 (decimal fraction); values > 1 are rejected |
| FR-015 | Fixed discount value is validated as a non-negative number |
| FR-016 | Discount rules are persisted in an ordered array; order is preserved on save and retrieve |
| FR-017 | Rate card data is strictly tenant-isolated; one organization's data is never visible to or writable by another |
| FR-018 | Changes to the rate card take effect for new proposals only; proposals already in generation are not altered |
| FR-019 | The `GET` endpoint returns the current rate card for the authenticated org, or an empty/null structure if not yet configured |
| FR-020 | The `PATCH` endpoint validates and replaces the complete rate card for the authenticated org |
| FR-021 | Only users with org admin role may call the `PATCH` endpoint; non-admins receive 403 |
| FR-022 | The `GET` endpoint is accessible to all authenticated org members (not just admins) |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-001 | `PATCH` response completes within 2 seconds at the 90th percentile |
| NFR-002 | Rate card values (margin, rates, discount amounts) must not appear in error response bodies or server-side logs at a level visible to non-admins |
| NFR-003 | All API routes require a valid session; unauthenticated requests receive 401 |
| NFR-004 | Invalid payloads are rejected with a 422 response that includes per-field error messages |
| NFR-005 | The settings UI is usable on screens ≥ 1024px wide; responsive layout not required for initial release |

---

## Edge Cases & Error Handling

### Mode Switching
- **Blended → By-Role:** Any previously saved by-role data is preserved in the database; switching modes in the UI and saving does not destroy it until explicitly overwritten. The UI may show previously entered roles when switching back.
- **By-Role → Blended:** The blended rate field is shown; the roles list is hidden. Saving commits the new blended rate card; role data in the database is overwritten.
- **Unsaved changes:** If the admin edits the mode and leaves the page without saving, no change is persisted.

### Discount Customer IDs
- `customerIds: null` means the discount applies to all customers universally.
- `customerIds: []` is invalid — if scoped discounts are intended, at least one customer ID must be provided. The system rejects an empty array with a validation error.
- Customer IDs are stored as strings; no referential integrity enforced at the API layer in this feature.

### Currency
- The default currency is USD.
- The system does not validate that the currency code maps to an existing real-world currency beyond the regex `^[A-Z]{3}$`. No currency conversion is performed.

### Empty State
- If no rate card has ever been saved, `GET` returns `{ rateCard: null, proposalDefaults: null }`.
- The UI renders a helpful empty state with a "Configure Rate Card" prompt.
- Downstream features (F5) handle the null case with graceful degradation.

### Concurrent Saves
- If two admins save the rate card simultaneously, the last write wins. No optimistic locking is required in this version.

### Partial Updates
- `PATCH` replaces the entire `rateCard` and `proposalDefaults` objects. There is no partial-field update within those objects; callers must submit the full structure.

---

## Out of Scope

- Multi-currency support (USD-only in v1 per PRD §3)
- Real-time pricing preview while editing the rate card
- Version history or audit log for rate card changes
- Role-level discount rules (discounts apply to the overall pricing computation, not individual roles)
- Per-RFP rate card overrides
- Import/export of rate card from CSV or external system

---

## Success Metrics

- Org admin can configure a blended or by-role rate card from start to finish without errors
- Rate card data round-trips correctly (save → retrieve returns identical values)
- At least one complete rate card is configured in staging before F5 (pricing engine) testing begins
- Zero authentication bypass vulnerabilities found in security review

---

## Acceptance Criteria Summary

| Story | Done When |
|---|---|
| US-001 | Settings page shows Rate Card section with live data or empty state |
| US-002 | Admin can save blended rate; it round-trips via API |
| US-003 | Admin can add, edit, remove roles; saving with zero roles is blocked |
| US-004 | All five defaults (margin, model, terms, warranty, currency) save and retrieve correctly |
| US-005 | Discount rules save with correct order; reorder persists; empty customerIds array is rejected |
