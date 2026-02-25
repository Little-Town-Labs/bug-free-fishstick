# PRD: Structured Proposal Bid Engine

**Version:** 1.1
**Date:** 2026-02-25
**Status:** Resolved — Ready for Roadmap Extraction
**Project:** RFP Automator

---

## 1. Background & Problem Statement

The current proposal generation system produces narrative text from an RFP but has three fundamental gaps that make it unsuitable for real bid submission:

1. **No pricing.** A proposal that doesn't say what the work will cost is not a bid. Pricing is the core commercial commitment in any supplier proposal.

2. **No commercial protection.** Suppliers need standard contractual language — assumptions, exclusions, change management terms, payment terms, liability limits — to protect them if scope shifts after bid submission. This language must appear verbatim; it cannot be paraphrased or softened by an AI model.

3. **No quality guarantee.** The system cannot confirm that the generated proposal actually addresses every requirement the customer asked for. A proposal that misses a requirement is a disqualified proposal.

Additionally, the proposal writer currently has poor access to the supplier's own context: it queries the knowledge base with just the RFP title, ignores the supplier's past winning proposals, doesn't use the customer's tone preferences, and has no concept of who the supplier is as a company.

This PRD specifies the Structured Proposal Bid Engine: a complete rebuild of the proposal generation pipeline that addresses all of these gaps.

---

## 2. Goals

- A generated proposal draft is ready for human review and editing, not just a starting point requiring heavy rewriting
- Pricing is computed deterministically from a supplier-managed rate card and scope estimates — never hallucinated by the model
- Required legal and commercial clauses appear verbatim in every proposal, immune to LLM paraphrasing
- The proposal is validated against the RFP requirements before it is marked as ready for review
- The proposal writer has rich, structured access to the supplier's capabilities, past performance, certifications, and company profile
- Retrieval is driven by actual RFP requirements, not just the RFP title

## 3. Non-Goals

- Automatic bid/no-bid decision making
- Integration with external pricing systems or ERP
- Electronic signature or contract execution
- Public-facing proposal portal for customers
- Multi-currency support (USD only in v1)

---

## 4. Users & Personas

**Supplier Admin** — Sets up the organization's rate card, company profile, and template library. Does this once, keeps it maintained. Usually operations/management.

**Proposal Preparer** — Uses the system to generate and refine proposals for specific RFPs. Answers clarifying questions, reviews the draft, finalizes for submission. Usually sales/business development.

**Reviewer** — Reviews the coverage report and draft before approval. May be the same person as the Preparer in smaller organizations.

---

## 5. User Stories

### US1 — Rate Card Setup

**As a Supplier Admin**, I can define the organization's rate card (roles, hourly rates, default margin) and default pricing preferences (pricing model, payment terms) so that all proposals automatically include accurate, consistent pricing.

**Acceptance Criteria:**
- Admin can choose between **Blended** mode (one rate for all work) or **By Role** mode (rate per role)
- In Blended mode, admin sets a single hourly/daily rate used for all line items
- In By Role mode, admin can add, edit, and remove roles with a name, unit (hour/day/fixed), and rate
- Admin can set a default margin percentage applied to all proposals
- Admin can set the default pricing model: Time & Materials, Fixed Price, or Cost-Plus
- Admin can set the default payment terms in days (e.g. Net 30)
- Admin can define discount rules: name, type (percentage or fixed), value, applies-to (subtotal or total), and optionally restrict to specific customers
- Discounts are listed and reorderable; they are applied in order after margin
- Rate card is scoped per organization (tenant-isolated)
- Rate card is accessible from the settings page
- All rate values are validated as positive numbers
- Changes take effect immediately on new proposals; in-progress drafts are not retroactively changed

### US2 — Proposal Template Library

**As a Supplier Admin**, I can create and manage a library of contract clauses and boilerplate text so that every proposal includes the organization's standard legal and commercial language verbatim.

**Acceptance Criteria:**
- Admin can create templates assigned to one of these standard section types: Assumptions, Exclusions, Payment Terms, Change Management, IP Ownership, Liability, Force Majeure, Warranty
- Each template has: section type, title, body text (markdown), required flag, and optional trigger tags (rfpType, industryTags)
- Templates marked `required: true` are appended to every proposal without exception
- Templates with trigger tags are appended only when the RFP matches those tags
- Admin can reorder templates within a section type; order determines output order
- Template body text is injected verbatim — it is never passed through the LLM
- Admin can toggle `evaluateCoverage` per template; defaults to false; required templates cannot have this enabled (UI enforces)
- CRUD operations are available in the settings UI
- Changes take effect immediately on new proposals

### US3 — Company Profile

**As a Supplier Admin**, I can write and maintain a company profile that describes our organization's capabilities, value proposition, and differentiators so that every proposal opens with a consistent, accurate "Who We Are" statement.

**Acceptance Criteria:**
- Company profile is a free-text markdown field in organization settings
- It is included as the first supplier context block in every proposal prompt
- It is clearly labelled so the model understands it as foundational identity context
- An empty profile does not break proposal generation; the section is omitted gracefully

### US4 — Scope-Driven Clarifying Questions

**As a Proposal Preparer**, I am asked targeted questions about scope, effort, and pricing assumptions so that the system has what it needs to compute an accurate pricing estimate.

**Acceptance Criteria:**
- Clarifying questions always include at least one question requesting deliverables and estimated hours per deliverable (or confirmation of fixed price)
- At least one question asks what is explicitly excluded from the scope
- At least one question asks for target delivery timeline
- The pricing model question adapts based on the org's `proposalDefaults.pricingModel`: if T&M, ask for hours; if fixed price, ask for total; if cost-plus, ask for cost and target margin
- Answers to pricing questions are structured enough for the computation engine to parse

### US5 — Deterministic Pricing Section

**As a Proposal Preparer**, the proposal I generate automatically includes a properly formatted pricing section based on my rate card and the scope I described in the clarifying questions so that I do not have to calculate pricing manually.

**Acceptance Criteria:**
- The pricing section shows a line-item table: role, description, quantity (hours/days), unit rate, line subtotal
- The table shows: subtotal, margin amount, and total
- All math is computed deterministically in code — the LLM does not perform arithmetic
- The pricing model (T&M, Fixed Price, Cost-Plus) is reflected in the table structure
- If the preparer skips scope questions, a `[PLACEHOLDER: pricing details required]` is inserted
- The pricing section in the proposal matches the computed figures exactly
- The currency is shown on all monetary values

### US6 — Requirement-Driven Proposal Generation

**As a Proposal Preparer**, the generated proposal addresses every requirement from the RFP and draws on our company's relevant capabilities, past performance, certifications, and content library so that the draft is substantive rather than generic.

**Acceptance Criteria:**
- The proposal has one section per RFP requirement (from `parsedStructure.fields`)
- Retrieval for each requirement uses the requirement's question text as the search query, not just the RFP name
- The system separately queries the knowledge base by entry type: company_doc (company profile), certification (credentials), case_study (past performance), and past_rfp with outcome=won (winning examples) filtered by industry tag overlap with the current RFP
- Customer context is used: preferred tone, industry context, and custom instructions from the customer record
- Learnings for the organization and customer are included in the prompt context
- Each section includes a source annotation blockquote indicating where the content came from
- Sections with no available evidence include a `[PLACEHOLDER]` rather than fabricated content

### US7 — Verbatim Template Injection

**As a Supplier Admin**, I am confident that the standard legal clauses I have written appear in every proposal exactly as written, without modification by the AI, so that our commercial protections are never weakened.

**Acceptance Criteria:**
- Required templates are appended to the proposal markdown after the LLM generation step completes
- The LLM is explicitly instructed not to generate Terms & Conditions sections
- Templates are never included in the LLM prompt context — they are concatenated to the output
- The order of templates follows the section type order: Assumptions → Exclusions → Payment Terms → Change Management → IP Ownership → Liability → Force Majeure → Warranty
- A visual separator (`---`) precedes the terms section in the output
- The injected content is marked in the coverage report as supplier-controlled (not evaluated for requirement coverage)

### US8 — Requirement Coverage Report

**As a Proposal Preparer**, after a proposal is generated I can see a coverage report showing which RFP requirements my proposal addresses and which have gaps, so that I know exactly what to review before submitting.

**Acceptance Criteria:**
- Every generated proposal draft has a coverage report stored alongside it
- The report shows an overall coverage score (0–100)
- The report lists every RFP requirement with: addressed (true/false), evidence (quote from proposal if addressed), and gap description (if not addressed)
- A requirement is "addressed" if the relevant proposal section contains substantive content (not just a placeholder)
- The coverage report is computed by a dedicated AI agent (separate from the proposal writer) using `generateObject` with a structured schema
- Low coverage (below 70%) is visually flagged in the UI
- Coverage report is shown on the proposal view page alongside the draft
- Coverage report **re-evaluation is on demand** — a "Re-check Coverage" action is available in the UI; it does not trigger automatically on every edit
- Whether situational (triggered) templates count toward coverage is configurable per template via an `evaluateCoverage` boolean flag; required templates always have `evaluateCoverage: false` (they are supplier-controlled, not requirement responses)

### US9 — Coverage Report UI

**As a Proposal Preparer**, I can see the coverage report inline with the proposal draft so that I can navigate directly from a gap to the relevant section and fix it.

**Acceptance Criteria:**
- Coverage score is displayed as a prominent badge/meter on the proposal page
- The requirements list shows pass/fail icons with expandable evidence or gap details
- Clicking a requirement scrolls to or highlights the relevant section in the draft
- Requirements with `[PLACEHOLDER]` content are marked as gaps automatically
- A "Re-check Coverage" button triggers a new coverage evaluation on demand and updates the stored report
- The timestamp of the last coverage check is shown so the preparer knows if it is stale relative to their edits
- Supplier-controlled template sections are visually distinguished from requirement-response sections (e.g. labelled "Supplier Terms") and excluded from the coverage score by default unless their `evaluateCoverage` flag is set to true

---

## 6. Functional Requirements

### 6.1 Rate Card & Pricing Defaults (Data)

The `tenant_settings` table gains two new JSONB columns:

```
rateCard: {
  mode: 'blended' | 'by_role'           // blended = single rate for all work
  blendedRate: number | null            // used when mode = 'blended'
  roles: [{ name, unit: 'hour'|'day'|'fixed', rate: number }]  // used when mode = 'by_role'
  defaultMarginPct: number              // e.g. 0.20 for 20%
  currency: string                      // 'USD' (v1 only)
  discounts: [{                         // optional customer or volume discounts
    name: string                        // e.g. "Government rate", "Preferred partner"
    type: 'percentage' | 'fixed'
    value: number                       // pct off (0.10 = 10%) or fixed USD reduction
    appliesTo: 'subtotal' | 'total'
    customerIds: string[] | null        // null = applies to all customers
  }]
}

proposalDefaults: {
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: number              // e.g. 30
  warrantyPeriodDays: number            // e.g. 90
}
```

The pricing computation engine supports both modes. In `blended` mode, a single rate is applied to all hours regardless of role. In `by_role` mode, line items use the matched role rate, with an optional fallback to the first defined role if no match is found. Discounts are applied after margin in the order they are listed; applicable discounts are shown as separate line items in the pricing table.

### 6.2 Proposal Template Library (Data)

New `proposal_templates` table:

```
id: uuid (PK)
organizationId: text (FK, indexed)
section: enum [assumptions, exclusions, payment_terms, change_management,
               ip_ownership, liability, force_majeure, warranty]
title: text
content: text (markdown — injected verbatim)
isRequired: boolean
triggerRfpTypes: text[]    // ['technical', 'compliance'] — null means all types
triggerIndustryTags: text[] // null means all industries
evaluateCoverage: boolean  // false = excluded from coverage scoring (default false)
sortOrder: integer
createdBy: text
createdAt, updatedAt: timestamps
```

`evaluateCoverage` defaults to `false` for all templates. Required templates (`isRequired: true`) should always remain `false`. A situational template can be set to `true` if the admin wants the coverage checker to verify the clause is present (e.g. a "Project Timeline" template that should be counted as addressing a delivery requirement).

### 6.3 Pricing Computation (Non-LLM)

A pure TypeScript function `computePricingEstimate(rateCard, scopeLines, pricingModel, customerId?)` produces:

```ts
interface PricingEstimate {
  mode: 'blended' | 'by_role'
  model: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  lineItems: Array<{
    description: string
    role: string | null          // null in blended mode
    quantity: number
    unit: 'hour' | 'day' | 'fixed'
    unitRate: number
    lineTotal: number
  }>
  subtotal: number
  marginPct: number
  marginAmount: number
  discountsApplied: Array<{
    name: string
    amount: number
  }>
  total: number
  currency: string
  formattedMarkdown: string      // ready-to-inject table
}
```

When `customerId` is provided, the computation engine checks `rateCard.discounts` for entries where `customerIds` includes that customer or is `null` (universal). Applicable discounts are applied after margin and rendered as separate deduction rows in the formatted table.

### 6.4 Revised Inngest Pipeline (generate-proposal)

```
Step 1: fetch-draft-and-rfp
Step 2: fetch-customer-context          (NEW — customer settings, tone, industry)
Step 3: search-knowledge-base           (IMPROVED — per-requirement queries)
Step 4: fetch-typed-supplier-context    (NEW — typed queries: company_doc, cert, case_study, past_rfp won)
Step 5: fetch-required-templates        (NEW — query proposal_templates where isRequired=true)
Step 6: fetch-situational-templates     (NEW — query by triggerRfpTypes/triggerIndustryTags)
Step 7: compute-pricing                 (NEW — deterministic, non-LLM)
Step 8: generate-proposal-content       (IMPROVED — narrative only, pricing pre-injected)
Step 9: check-requirement-coverage      (NEW — coverage checker agent)
Step 10: inject-required-templates      (NEW — verbatim append post-generation)
Step 11: save-proposal-content          (IMPROVED — saves coverage report alongside draft)
```

### 6.5 Coverage Checker Agent

New agent `src/lib/ai/agents/proposal-coverage-checker.ts` using `generateObject`:

Input: requirements array + proposal markdown
Output schema:
```ts
{
  coverageScore: number,
  requirements: [{
    requirementId: string,
    question: string,
    addressed: boolean,
    evidence: string | null,
    gap: string | null,
  }]
}
```

### 6.6 Schema Change: proposal_drafts

Add `coverageReport` JSONB column:
```ts
coverageReport: jsonb.$type<{
  coverageScore: number
  evaluatedAt: string
  requirements: Array<{
    requirementId: string
    question: string
    addressed: boolean
    evidence: string | null
    gap: string | null
  }>
}>()
```

### 6.7 Settings UI Pages

Three new settings UI sections:
1. **Rate Card** — Table of roles/rates, margin input, pricing model selector, payment terms
2. **Proposal Templates** — List by section type, add/edit/delete/reorder, required toggle, trigger tags
3. **Company Profile** — Markdown editor for the organization's profile text

### 6.8 Coverage Report UI

The proposal view page gains a collapsible coverage panel showing score, per-requirement status, and evidence/gap details.

---

## 7. Data Model Summary

| Change | Type | Rationale |
|---|---|---|
| `tenant_settings.rateCard` | New JSONB column | Rate card and pricing defaults |
| `tenant_settings.proposalDefaults` | New JSONB column | Pricing model, payment terms |
| `tenant_settings.companyProfile` | New text column | Supplier identity context |
| `proposal_templates` | New table | Verbatim contract clause library |
| `proposal_drafts.coverageReport` | New JSONB column | Requirement coverage validation result |

Migration: single Drizzle migration file covering all changes.

---

## 8. Non-Functional Requirements

- **Tenant isolation:** All rate card, template, and coverage data is scoped by `organizationId`. No cross-tenant access.
- **Pricing accuracy:** Computed totals must be arithmetically correct. Unit tests verify computation logic with known inputs.
- **Template verbatim integrity:** Integration tests verify template content appears in proposal output unchanged (character-for-character).
- **Coverage checker reliability:** Agent must be tested with mocked LLM responses. Edge cases: empty proposal, all placeholders, fully addressed proposal.
- **Performance:** The additional Inngest steps must not increase end-to-end proposal generation time beyond 60 seconds for a 20-field RFP.
- **Graceful degradation:** If rate card is not configured, a `[PLACEHOLDER: pricing details required]` is inserted. Generation does not fail.
- **Type safety:** All new data structures fully typed with TypeScript interfaces and Zod validation at API boundaries.

---

## 9. Out of Scope (v1)

- Automatic negotiation or pricing adjustment based on competitor analysis
- Multi-currency support
- Approval workflow for pricing before proposal generation
- AI-assisted rate card suggestions based on market data
- Proposal versioning with diff comparison (existing version field is sufficient)
- Template version history
- Bulk import of rate cards from spreadsheet

---

## 10. Success Metrics

- Generated proposals include a pricing section in 100% of cases where rate card is configured
- Required template content appears verbatim in 100% of generated proposals
- Coverage score ≥ 80 for proposals generated against RFPs with well-populated knowledge bases
- Proposal preparer spends less time on manual additions after generation (qualitative)
- Zero pricing arithmetic errors in generated proposals

---

## 11. Dependencies

- Existing RFP processing pipeline (`process-rfp`) must have already run before proposal generation; `parsedStructure` must be populated
- OpenAI API key required for per-requirement vector search (graceful degradation if absent)
- LLM provider key required for proposal writer and coverage checker agents
- Existing content library, knowledge base, and learnings infrastructure unchanged

---

## 12. Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Blended vs by-role pricing? | **Build flexibility.** Rate card has a `mode` switch: `blended` (single rate, simpler for small orgs) or `by_role` (per-role rates, for organizations with differentiated labor categories). Both modes are fully supported. |
| 2 | Coverage re-evaluation: automatic or on demand? | **On demand.** A "Re-check Coverage" button in the UI triggers re-evaluation. This avoids unnecessary LLM calls on every keystroke and gives the preparer control over when to re-assess. The UI shows the timestamp of the last check so staleness is visible. |
| 3 | Situational templates and coverage scoring? | **Build flexibility.** Each template has an `evaluateCoverage` boolean flag (default false). Admin can opt specific situational templates into coverage scoring if they serve as requirement responses (e.g. a delivery timeline template). Required templates cannot be opted in. |
| 4 | Discount structures in rate card? | **Yes.** The rate card supports discount rules with name, type (percentage or fixed), value, applies-to (subtotal or total), and optional customer scope. Discounts are applied after margin and shown as line items in the pricing table. |
