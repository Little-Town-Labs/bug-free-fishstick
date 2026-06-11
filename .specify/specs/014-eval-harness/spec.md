# Feature Specification: Three-Layer Eval Harness for Proposal Outputs

**Feature Branch**: `014-eval-harness`
**Created**: 2026-04-15
**Status**: Draft
**Input**: Quantifiable, testable scoring of generated RFP proposals via (1) deterministic gates, (2) LLM council / mixture-of-experts rubric judging, and (3) outcome correlation against real win/loss data.

---

## Overview

The proposal pipeline today produces drafts whose quality can only be judged by hand. There is no mechanism to detect regressions when prompts, models, templates, or retrieval change — and no way to tell whether a "better" draft actually wins business.

This feature introduces an **offline, batch eval harness** that scores any generated proposal along three independent layers. Each layer answers a distinct question and operates on a different timescale:

| Layer | Question Answered | Timescale | Cost |
|---|---|---|---|
| 1. Deterministic Gates | Is the draft mechanically valid? | Seconds | Free |
| 2. LLM Council Rubric | Is the draft qualitatively good? | Minutes | Moderate (multiple LLM calls) |
| 3. Outcome Correlation | Do our scores predict wins? | Weeks/months | Free (computed over existing data) |

Together they give a quantifiable score with pass/fail gates, qualitative dimension scores with cross-judge agreement, and long-term calibration against real business outcomes.

**Business value:**
- Safely iterate on prompts, models, and templates with a regression signal
- Quantify the effect of changes before shipping
- Identify which quality dimensions actually correlate with winning business
- Lay groundwork for CI gates that run the harness on a golden set before merging

---

## User Scenarios & Testing

### User Story 1 — Run Deterministic Gates on a Draft (Priority: P1)

An engineer or automated pipeline runs layer 1 against a finished proposal draft to catch mechanical defects before the draft is ever shown to a customer.

**Why this priority**: Layer 1 is the foundation — it is cheap, deterministic, and catches the majority of the failure modes observed in Sunday testing (placeholder leakage, missing sections, broken pricing math, invalid citations). Without layer 1, there is no reliable floor on draft quality.

**Independent Test**: Feed a known-bad draft (e.g., one containing `[TBD]` tokens and a pricing math error) into the harness and confirm it emits specific, named gate failures with human-readable reasons. Feed a known-good draft and confirm all gates pass.

**Acceptance Scenarios**:

1. **Given** a proposal draft containing unfilled placeholder tokens, **When** the harness runs layer 1, **Then** it reports a `placeholder_tokens` gate failure with the specific tokens and locations found.
2. **Given** a proposal draft whose pricing line items do not sum to the stated subtotal, **When** the harness runs layer 1, **Then** it reports a `pricing_reconciliation` gate failure including the expected and actual values.
3. **Given** a proposal draft that cites a content library entry id which does not exist for the tenant, **When** the harness runs layer 1, **Then** it reports a `citation_integrity` gate failure listing the invalid citation(s).
4. **Given** a proposal draft that omits a section marked `isRequired=true` in `proposal_templates`, **When** the harness runs layer 1, **Then** it reports a `required_section_missing` failure naming the section.
5. **Given** a fully valid proposal draft, **When** the harness runs layer 1, **Then** all gates return `pass` and the overall layer 1 result is `pass`.
6. **Given** the same draft is scored twice with the same rubric version, **When** comparing the two results, **Then** layer 1 outputs are byte-identical.

---

### User Story 2 — Score a Draft with an LLM Council (Priority: P1)

A reviewer wants qualitative scores on dimensions that cannot be checked deterministically (persuasiveness, grounding, tone match). The harness submits the draft to a council of multiple judges and aggregates their scores.

**Why this priority**: Layer 2 captures the quality signal that humans actually care about. The council (rather than a single judge) is required because single-model rubric judging is known to be biased and brittle — multiple judges expose disagreement that would otherwise be hidden.

**Independent Test**: Score a single draft with a 3-judge council and verify that (a) each judge produces scores on every rubric dimension, (b) aggregation produces a defensible combined score per dimension, (c) high-disagreement dimensions are flagged for human review.

**Acceptance Scenarios**:

1. **Given** an eval run configured with 3 judges and a rubric with 6 dimensions, **When** layer 2 executes, **Then** the run produces 3 × 6 = 18 individual dimension scores plus 6 aggregated dimension scores.
2. **Given** judges disagree by more than 2 points on a given dimension, **When** aggregation runs, **Then** that dimension is flagged with `requires_human_review = true` in the EvalReport.
3. **Given** a rubric version is pinned to an EvalRun, **When** the rubric is later updated, **Then** historical EvalRuns still reference and render against the original rubric version.
4. **Given** a judge's LLM call fails (timeout, provider error), **When** the harness continues, **Then** the EvalRun records the failure per-judge and aggregation proceeds using the remaining judges (with a minimum quorum configurable; below quorum the run is marked `incomplete`).
5. **Given** two eval runs on the same draft with temperature=0 and identical council + rubric versions, **When** comparing scores, **Then** aggregated dimension scores are within a configured tolerance band (near-identical, allowing for minor provider nondeterminism).

---

### User Story 3 — Curate and Use a Golden Set (Priority: P1)

A domain expert curates a golden set of real RFPs paired with human-approved "good" proposals and human-assigned dimension scores. The harness uses this golden set to calibrate and to detect regressions when prompts or models change.

**Why this priority**: Without a golden set, rubric scores are ungrounded opinions. The golden set is what turns an LLM council from a vibe-check into a calibrated instrument. It is also the corpus against which CI-style regression runs will execute.

**Independent Test**: Add 3 RFP + approved-proposal pairs with human scores to the golden set, then run the harness against all three and compare the council's aggregated scores to the human scores. Confirm that per-RFP deltas are recorded and the aggregate bias (mean delta) is surfaced.

**Acceptance Scenarios**:

1. **Given** a user adds a new golden set entry with an RFP, an approved proposal, and human-assigned dimension scores, **When** the entry is saved, **Then** it is stored tenant-scoped and linked to the RFP by id.
2. **Given** a golden set of N entries exists for a tenant, **When** a user triggers a calibration run, **Then** the harness scores every entry with the configured council and produces a delta report (per-dimension bias and variance vs. human scores).
3. **Given** a golden set entry's human score is updated, **When** a new calibration run executes, **Then** the delta report reflects the updated human scores without modifying any prior EvalRun records.
4. **Given** two rubric versions (v1 and v2), **When** the same golden set is scored against each, **Then** the harness can surface which dimensions changed meaningfully between versions.

---

### User Story 4 — Produce an EvalReport (Priority: P2)

A reviewer opens an EvalReport for a specific draft and sees gate pass/fail, aggregated dimension scores with judge variance, and comparisons against the golden set baseline.

**Why this priority**: The raw data from layers 1 and 2 is only useful if it can be consumed quickly. A structured report (JSON now, UI later) is the primary interface for humans and for CI.

**Independent Test**: Execute one EvalRun end-to-end and confirm the resulting EvalReport contains all gate results, per-judge dimension scores, aggregated dimension scores, variance flags, and a comparison block against a selected golden-set baseline.

**Acceptance Scenarios**:

1. **Given** a completed EvalRun, **When** the EvalReport is generated, **Then** it includes an overall gate verdict (`pass` / `fail`), a per-gate breakdown with reasons, per-judge raw scores, aggregated scores, agreement metrics, and total cost/token usage.
2. **Given** an EvalReport and a selected golden-set baseline, **When** the report renders, **Then** it shows the delta between this draft's dimension scores and the baseline's expected scores.
3. **Given** multiple EvalRuns exist for the same RFP over time, **When** a user requests a history view, **Then** the harness returns dimension scores over time suitable for trend analysis.

---

### User Story 5 — Batch Evaluate via Worker (Priority: P2)

An engineer triggers a batch evaluation over a set of drafts (the full golden set, or all drafts produced in the last week) using a background worker. Results stream back as each run completes.

**Why this priority**: Council calls are too expensive and slow to run inline during drafting. Batch execution against golden sets is the primary use case — especially for regression runs triggered by prompt or model changes.

**Independent Test**: Submit a batch of 5 drafts to the harness worker and confirm each produces an independent EvalRun, failures are isolated, and overall batch status reports `completed` / `partial` / `failed` with per-draft detail.

**Acceptance Scenarios**:

1. **Given** a batch of N drafts is submitted, **When** the worker runs, **Then** N EvalRuns are created, each independently retryable.
2. **Given** one run in the batch fails, **When** the batch completes, **Then** the remaining runs are unaffected and the batch status is `partial`.
3. **Given** a batch of identical drafts + rubric + council is submitted and a response cache is enabled, **When** subsequent runs hit the cache, **Then** cached judge responses are reused and cost is recorded as cache-hit.

---

### User Story 6 — Correlate Scores with Outcomes (Priority: P3)

An analyst wants to know whether drafts with higher council scores actually win more business. The harness produces a periodic outcome-correlation report.

**Why this priority**: This is the north star — it validates the rubric itself. But it requires accumulated outcome data and is therefore the slowest-moving layer. P3 because it is not required for the harness to deliver value in the short term; it is the calibration feedback loop for the long term.

**Independent Test**: Given a set of RFPs with both EvalRun scores and recorded `rfps.outcome` values, generate a correlation report and confirm it surfaces per-dimension correlation with wins, overall score correlation with wins, and sample size caveats.

**Acceptance Scenarios**:

1. **Given** at least M RFPs have both eval scores and final outcomes recorded (M configurable, e.g., 30), **When** a correlation run is triggered, **Then** the report includes per-dimension correlation coefficients with win rate and confidence intervals.
2. **Given** fewer than M data points are available, **When** a correlation run is triggered, **Then** the report clearly states "insufficient data" and does not produce misleading statistics.
3. **Given** the correlation report identifies that one dimension is weakly or inversely correlated with wins, **When** the report is reviewed, **Then** it suggests a rubric weight adjustment for future runs without automatically applying it.

---

### Edge Cases

- **Empty draft**: A draft with no response text should fail every gate with clear reasons, not crash the harness.
- **Draft larger than judge context window**: The harness must chunk, summarize, or reject drafts that exceed the configured context limit, and must document which strategy was applied.
- **Judge returns malformed JSON**: A single judge returning invalid output must be treated as a judge-level failure and not poison the whole run.
- **Tenant has no golden set**: Layer 2 still runs; calibration-based views degrade gracefully with a "no baseline available" indicator.
- **Rubric version removed or deprecated**: Historical runs still render against the snapshotted rubric; new runs refuse to use removed versions.
- **Placeholder tokens appear inside legitimate content** (e.g., user writes about a feature literally called "TBD"): Layer 1 must distinguish leftover-template placeholders from legitimate prose — likely by scoping placeholder detection to known template token syntax rather than substring match.
- **Pricing math uses multiple currencies or rounding modes**: The reconciliation gate must apply a configurable tolerance and respect currency precision.
- **Golden set entry's human scores are stale**: The harness should record the timestamp on which human scores were assigned so delta reports can flag stale baselines.
- **A citation points to a content-library entry that exists but was archived / soft-deleted**: The integrity gate must treat "exists but archived" distinctly from "does not exist" and surface a separate warning class.
- **Judge provider rate-limiting during a batch**: The worker must backoff, not fail the whole batch, and distinguish transient from permanent failures.

---

## Requirements

### Functional Requirements

#### Layer 1 — Deterministic Gates
- **FR-001**: System MUST evaluate each configured deterministic gate against a proposal draft and return a structured result per gate: `pass | fail | not_applicable`, a human-readable reason, and machine-readable evidence (e.g., offending tokens, expected vs. actual totals).
- **FR-002**: System MUST include the following gates at minimum: placeholder-token detection, required-section presence, pricing-reconciliation, citation-integrity, and tone-surface-check.
- **FR-003**: System MUST produce a top-level layer-1 verdict (`pass | fail`) that is `fail` if any individual gate fails.
- **FR-004**: System MUST evaluate gates deterministically such that identical inputs produce byte-identical layer-1 outputs.
- **FR-005**: System MUST allow gates to be configured per tenant (enable/disable, parameter overrides such as placeholder-token vocabularies and pricing tolerance).
- **FR-006**: Layer 1 MUST execute end-to-end for a single draft in under 2 seconds on typical draft sizes (≤ 20 pages), to satisfy fast-feedback use cases.

#### Layer 2 — LLM Council
- **FR-007**: System MUST support defining a **Judge** as a configured model endpoint, a role/persona prompt, and a judge-level prompt template.
- **FR-008**: System MUST support defining a **Council** as an ordered set of 3–5 Judges.
- **FR-009**: System MUST score each draft against every rubric dimension by every configured judge, at temperature 0 (or the lowest determinism setting the provider exposes).
- **FR-010**: System MUST record the raw response of every judge call verbatim, including refusals, errors, and malformed output.
- **FR-011**: System MUST aggregate per-dimension scores across judges using a configured aggregation function (default: trimmed mean with median fallback), and record the aggregation function used.
- **FR-012**: System MUST compute a per-dimension inter-judge-agreement metric and flag dimensions where disagreement exceeds a configurable threshold.
- **FR-013**: System MUST support a configurable minimum quorum of successful judges; runs below quorum are marked `incomplete` rather than aggregated.
- **FR-014**: System MUST version rubrics immutably; an EvalRun references a specific rubric version and continues to render against that version indefinitely.
- **FR-015**: System MUST cache judge responses keyed by (draft content hash, rubric version, judge id, prompt version) so repeat runs do not re-pay for identical work.

#### Layer 3 — Outcome Correlation
- **FR-016**: System MUST be able to join historical EvalRuns with the corresponding RFP outcomes and produce a correlation report per tenant.
- **FR-017**: Correlation reports MUST include overall score vs. win-rate, per-dimension correlation, sample size, and a confidence or significance indicator.
- **FR-018**: Correlation reports MUST refuse to produce point estimates when sample size is below a configurable floor and MUST state this explicitly.

#### Golden Set
- **FR-019**: System MUST support curating a Golden Set: a tenant-scoped collection of (RFP reference, approved-proposal reference, human dimension scores, human notes, curated-at timestamp, curated-by user).
- **FR-020**: System MUST support calibration runs that score every golden-set entry with the configured council and compute deltas against human scores.
- **FR-021**: Golden-set entries MUST be editable: human scores can be updated, and the timestamp of the latest human-score change MUST be preserved for staleness reporting.

#### Reporting
- **FR-022**: System MUST produce an **EvalReport** per EvalRun containing: layer-1 results, layer-2 per-judge and aggregated scores, agreement flags, linked golden-set baseline delta (if any), rubric version, council configuration snapshot, and cost/token totals.
- **FR-023**: System MUST produce EvalReports in a stable JSON schema suitable for CLI consumption and CI pipelines.
- **FR-024**: System MUST support retrieving EvalRun history for a given RFP or draft for trend views.

#### Execution Model
- **FR-025**: System MUST support synchronous single-draft eval runs for ad-hoc use.
- **FR-026**: System MUST support batch eval runs executed as background jobs, with per-run isolation (a single failing run does not abort the batch).
- **FR-027**: System MUST record cost, token usage, and latency per judge call and roll those up to the EvalRun and batch level.

#### Access & Tenancy
- **FR-028**: System MUST enforce tenant isolation on all Golden Sets, Rubrics, Councils, EvalRuns, and EvalReports.
- **FR-029**: System MUST restrict rubric and council creation/modification to administrators; running evals MAY be available to non-admin reviewers.
- **FR-030**: System MUST redact or avoid persisting raw customer-sensitive content beyond what is strictly needed for reproducibility; judge-response caches MUST be encrypted at rest.

### Key Entities

- **EvalRun**: One execution of the harness against one proposal draft. Carries a rubric version, a council configuration snapshot, layer-1 gate results, layer-2 per-judge scores and aggregated scores, an optional golden-set baseline id, cost/latency metrics, status (`pending | running | completed | incomplete | failed`), and timestamps.
- **Rubric**: A versioned definition of scoring dimensions. Each dimension has a name, description, scale (e.g., 1–5), weight (for composite scoring), and a judge-facing prompt fragment describing what "good" looks like.
- **Judge**: A named configuration binding a model endpoint, a persona/role prompt, and a prompt template to a judge identity that can participate in Councils.
- **Council**: A named, ordered collection of Judges plus aggregation settings (function, trim, quorum, disagreement threshold).
- **GoldenSetEntry**: A curated tuple of (RFP reference, approved-proposal reference, human dimension scores, human notes, curator, curated-at, last-score-updated-at). Tenant-scoped.
- **EvalReport**: The human- and machine-readable output of an EvalRun. Stable JSON schema; serves CLI and CI today and a UI later.
- **CorrelationReport**: Periodic analysis output joining EvalRuns with RFP outcomes, per tenant.
- **Gate**: A named deterministic check (e.g., `placeholder_tokens`, `pricing_reconciliation`). Has tenant-level enable/disable and parameter overrides.

### Non-Functional Requirements

- **NFR-001 Determinism**: Layer 1 is byte-identical run-to-run. Layer 2 is within a configured tolerance band run-to-run given identical inputs and temperature 0.
- **NFR-002 Reproducibility**: Every EvalRun can be re-rendered in full given its rubric version, council snapshot, and cached judge responses, with no dependency on "current" config state.
- **NFR-003 Performance**: Layer 1 ≤ 2s per draft (p95). Layer 2 ≤ configured council-call timeout per judge (default 60s). Batch throughput is worker-scaled.
- **NFR-004 Cost Awareness**: Judge-response caching is on by default. Each EvalRun records token and dollar cost. Batch runs support sampling (e.g., "score 20% of the draft corpus").
- **NFR-005 Security**: Tenant isolation enforced at every persistence and retrieval boundary (per constitution I). Secrets (judge API keys) never in logs. Judge caches encrypted at rest.
- **NFR-006 Observability**: Every EvalRun is auditable: which judges ran, what they returned, which gate triggered which failure, which rubric version applied.
- **NFR-007 Graceful Degradation**: Per-judge failures and transient provider errors do not fail whole runs; quorum logic applies.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A single-draft layer-1 run completes end-to-end in ≤ 2 seconds for drafts up to 20 pages.
- **SC-002**: A single-draft layer-2 run against a 3-judge council completes end-to-end in ≤ 3 minutes (p95) and records per-judge latency.
- **SC-003**: Given a known-bad draft from past Sunday testing, layer 1 correctly identifies at least 90% of the mechanical defects already cataloged by human review.
- **SC-004**: On a golden set of ≥ 20 entries, the aggregated layer-2 score correlates with the curator's human score at ρ ≥ 0.6 per dimension (Spearman) for at least 4 of the 6 dimensions.
- **SC-005**: Re-running the same EvalRun configuration on the same draft produces aggregated dimension scores within ±0.3 points of each other on the 1–5 scale (p95).
- **SC-006**: Cost per EvalRun is visible in the EvalReport, and batch runs can reuse cached judge responses for unchanged (draft, rubric, judge) tuples with a cache hit rate ≥ 80% on repeat runs of the same golden set.
- **SC-007**: Once ≥ 30 RFPs have both eval scores and final outcomes, the correlation report produces non-trivial per-dimension correlation coefficients with stated confidence intervals.
- **SC-008**: CI can run the harness on the golden set and gate a PR on an overall regression threshold (configured per-dimension drop ≤ X points vs. last green run).

---

## Clarifications

### [NEEDS CLARIFICATION: Judge provider portfolio]
**Options:**
1. Start with Claude + OpenAI + Gemini (3-judge council, mixed providers) — maximum provider diversity, tests AI Gateway integration, higher cost.
2. Start with Claude-only multi-role council (Opus + Sonnet playing different personas) — cheaper, uses AI Gateway minimally, risks shared-model bias.
3. Start with 2 providers (Claude + OpenAI), add a third later — pragmatic middle ground.

**Recommendation:** Option 3. Provider diversity is the whole point of the council; two is the minimum to realize that benefit. Add a third once the harness is stable and costs are observed. Route all calls through Vercel AI Gateway so provider swaps do not require code changes.

### [NEEDS CLARIFICATION: Golden-set minimum size for calibration confidence]
**Options:**
1. 20 entries — per the input brief; fast to curate but weak statistical power per dimension.
2. 50 entries — stronger per-dimension signal; longer curation lead time.
3. Tiered: seed with 20, require 50 before correlation reports are considered statistically meaningful.

**Recommendation:** Option 3. Ship with a 20-entry floor for usability, but the correlation and calibration reports explicitly gate their confidence indicators until 50+ entries exist. Aligns with FR-018.

### [NEEDS CLARIFICATION: Where rubric & golden-set persistence lives]
**Options:**
1. New Drizzle tables inside the primary Neon Postgres (same DB as rfps, content_library) — consistent with existing architecture, simplest joins for correlation.
2. Separate eval-specific schema or database — clean isolation from production data paths, harder joins.
3. Blob storage for rubric/prompt artifacts + Postgres for run metadata — separation of versioned text from relational metadata.

**Recommendation:** Option 1 for MVP — same Neon instance, new tables (`eval_rubrics`, `eval_judges`, `eval_councils`, `eval_runs`, `eval_golden_entries`, `eval_reports`). Keeps tenant isolation boilerplate consistent and makes the layer-3 correlation queries straightforward joins against `rfps` and `rfp_responses`. Revisit if table sizes become a problem.
