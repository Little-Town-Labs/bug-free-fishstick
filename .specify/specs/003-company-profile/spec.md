# Feature Specification: Company Profile

**Feature:** 003-company-profile
**Branch:** 003-company-profile
**PRD Reference:** §5 US3, §6.7, §7
**Status:** Draft
**Created:** 2026-02-25

---

## Overview

The Company Profile feature allows a Supplier Admin to maintain a markdown-formatted description of the organization — its capabilities, value proposition, and key differentiators. This profile is stored per organization and surfaced to the proposal generation pipeline as foundational identity context, ensuring every generated proposal reflects an accurate and consistent "Who We Are" narrative.

The feature consists of two parts:
1. A settings UI section where admins can read and update the profile
2. An API that persists and retrieves the profile text with appropriate access control

The profile field already exists in the data model (added in Feature 1). This feature builds the surface layer: the management UI and API routes.

**Business Value:** Without a company profile, the proposal writer has no information about who the supplier is. It either omits an introduction entirely or fabricates generic company language. With a maintained profile, every proposal opens with accurate, supplier-approved identity content — eliminating a manual post-generation editing step.

---

## User Stories

### User Story 1: Write and Maintain the Company Profile
**As a** Supplier Admin
**I want** to write a markdown description of my organization in the Settings area
**So that** every generated proposal includes an accurate introduction to our company

**Acceptance Criteria:**
- [ ] A "Company Profile" section is accessible from the Settings navigation
- [ ] The section contains a multi-line text area where the admin can write or edit the profile
- [ ] The profile field accepts markdown syntax (bold, bullet lists, headings, etc.)
- [ ] A character count or length indicator is visible while editing
- [ ] Saving the profile persists it and shows a success confirmation
- [ ] The saved profile is retrieved and pre-populated when the admin returns to the page

**Priority:** High

---

### User Story 2: View a Preview of the Profile
**As a** Supplier Admin
**I want** to see a rendered preview of my markdown profile alongside the raw text editor
**So that** I can verify formatting before saving

**Acceptance Criteria:**
- [ ] A rendered preview of the markdown content is displayed alongside or below the text editor
- [ ] The preview updates as the admin types (live preview)
- [ ] The preview correctly renders common markdown elements: bold, italic, bullet lists, numbered lists, headings (h1–h3), and line breaks
- [ ] When the profile is empty, the preview area shows a placeholder message (e.g. "Preview will appear here")

**Priority:** Medium

---

### User Story 3: Clear the Company Profile
**As a** Supplier Admin
**I want** to clear the company profile field entirely
**So that** I can remove outdated content and either leave it blank or start fresh

**Acceptance Criteria:**
- [ ] The admin can delete all content from the text area and save an empty profile
- [ ] Saving an empty profile is accepted without a validation error
- [ ] After saving an empty profile, the next page load shows the field empty
- [ ] Proposals generated after clearing the profile do not include a company profile section (graceful omission)

**Priority:** Medium

---

### User Story 4: Non-Admin View (Read-Only)
**As an** authenticated organization member (non-admin)
**I want** to view the company profile that the admin has configured
**So that** I can understand what context is being included in proposals

**Acceptance Criteria:**
- [ ] Non-admin members can view the current company profile content
- [ ] The profile is displayed in rendered markdown (read-only)
- [ ] Non-admin members cannot edit or save changes to the profile
- [ ] The edit controls (text area, Save button) are hidden or disabled for non-admins

**Priority:** Low

---

## Functional Requirements

### FR-1: Company Profile Storage
The organization's company profile is stored as a per-organization text field. It is tenant-isolated: one organization cannot access or modify another organization's profile.

### FR-2: Profile Length Constraint
The profile text must not exceed 10,000 characters. Attempts to save a profile exceeding this limit must be rejected with a validation error indicating the limit.

### FR-3: Markdown Input
The profile field accepts free-form text including markdown syntax. No sanitization removes markdown formatting characters. The system treats the content as raw markdown for downstream use.

### FR-4: Admin-Only Write Access
Only users with the organization's admin role can save changes to the company profile. Authenticated non-admin members may read the profile. Unauthenticated requests are rejected.

### FR-5: Graceful Empty State
An empty or absent company profile is a valid state. When the profile is empty, the settings page displays a prompt encouraging the admin to write one. The proposal generation pipeline omits the profile section cleanly — it does not insert a placeholder or error.

### FR-6: Settings Navigation Integration
The Company Profile is accessible as a section within the existing Settings area, consistent with the navigation structure used for other settings sections (Rate Card, LLM Configuration, etc.).

### FR-7: Immediate Effect
Changes to the company profile take effect immediately on the next proposal generated after saving. In-progress proposal drafts that have already been generated are not retroactively updated.

### FR-8: API Availability
The company profile is readable and writable via API:
- Read endpoint: returns current profile text (or null/empty when not set)
- Write endpoint: accepts new profile text, validates length, persists and returns success

---

## Non-Functional Requirements

### Performance
- Profile save (PATCH) must complete and return a response in under 2 seconds under normal conditions
- Profile load (GET) must complete in under 500ms

### Security
- Write operations require admin role; read operations require authentication
- Profile text is stored as plain text; no executable content is injected or interpreted server-side
- Profile length validation prevents excessively large payloads from reaching the database

### Reliability
- A network error during save must surface a clear error message to the user; the editor must retain the unsaved content so the user can retry
- A failed save must not clear the previous saved value in the database

### Accessibility
- The text area must have an accessible label
- The character count indicator must be associated with the text area (e.g. via `aria-describedby`)
- The Save button must be reachable via keyboard navigation
- Success and error messages must be announced to screen readers

### Browser Support
- All modern browsers (Chrome, Firefox, Safari, Edge — last 2 major versions)
- No dependency on browser extensions or clipboard APIs

---

## Edge Cases & Error Handling

### EC-1: Profile Exactly at Length Limit
A profile of exactly 10,000 characters must be accepted. A profile of 10,001 characters must be rejected with a clear message stating the limit.

### EC-2: Save While Another Save Is In Progress
If the user clicks Save while a previous save request is still in-flight, the second click is ignored (button is disabled during the request). Only one save request is outstanding at a time.

### EC-3: Network Failure During Save
If the save request fails due to a network error or server error, the error is shown to the user. The text area retains the content the user was trying to save. The previously saved value in the database is unchanged.

### EC-4: Page Load When Profile Is Not Yet Set
When the organization has never saved a company profile, the GET endpoint returns an empty/null value. The settings page renders with an empty text area (not an error state).

### EC-5: Concurrent Edits by Two Admins
If two admins save the profile concurrently, the last write wins. No merge conflict UI is required. This is an acceptable trade-off given the low frequency of concurrent admin edits.

### EC-6: Markdown With Potentially Sensitive Content
The system does not scan profile content for sensitive data. The admin is responsible for what they write. No content policies are enforced beyond the character limit.

### EC-7: Session Expiry During Edit
If the user's session expires while they are editing the profile and they attempt to save, the API returns 401. The user is prompted to re-authenticate. The unsaved content in the editor must be preserved in the UI so it is not lost.

### EC-8: Profile Contains Only Whitespace
A profile containing only whitespace characters (spaces, newlines) is treated as functionally empty. It is saved as-is (not auto-trimmed in the spec — the implementation may trim but is not required to). The proposal pipeline treats a whitespace-only profile the same as empty (omits the section).

---

## Out of Scope

- Rich text editor (WYSIWYG) — a plain markdown textarea is sufficient
- Image embedding within the profile
- Version history or audit log for profile changes
- Per-user or per-customer profile variants — one profile per organization only
- Auto-save or draft functionality — explicit save action only
- Spell-check or grammar assistance
- Export of the profile as a standalone document

---

## Success Metrics

- Admin can save a company profile and it appears rendered in subsequent proposal outputs
- Empty profile does not cause proposal generation errors (verified by pipeline tests)
- Profile save and load round-trips without data loss or encoding issues for profiles containing markdown special characters
- Non-admin users cannot modify the profile (verified by API authorization tests)

---

## Dependencies

- **Feature 1 (Data Model Foundation):** The `companyProfile` text column on `tenant_settings` must exist. ✅ Complete.
- **Feature 8 (Revised Proposal Pipeline):** Reads the saved profile and injects it as supplier context. F3 must be complete before F8 wires it in.
