# Technology Research — Feature 9

## TD-1: LLM Call Strategy

**Options:**
1. Single `generateObject` call with all requirements
2. Per-requirement `generateObject` calls
3. Batched calls (groups of 10 requirements)

**Chosen:** Option 1 — Single call
**Rationale:** NFR-002 mandates exactly one LLM call. Up to 50 requirements fits within context window. Simplest implementation.
**Tradeoffs:** Very large RFPs (100+ requirements) may hit token limits — acceptable given PRD scope.

## TD-2: Score Computation Location

**Options:**
1. LLM computes score in the structured output
2. Application code computes score from the per-requirement results

**Chosen:** Option 2 — Application code
**Rationale:** FR-005 explicitly requires `Math.round((addressedCount / evaluatedCount) * 100)`. Deterministic, testable, no LLM variance.
**Tradeoffs:** None — strictly better for deterministic scoring.

## TD-3: Template Coverage Evaluation

**Options:**
1. Send template content to LLM alongside requirements
2. Check template presence with string matching in app code
3. Hybrid: include evaluateCoverage templates as additional requirements for LLM

**Chosen:** Option 3 — Hybrid
**Rationale:** Templates with `evaluateCoverage: true` should be treated as requirements the LLM evaluates against the proposal. This avoids brittle string matching while keeping non-evaluated templates out of the LLM context.
**Tradeoffs:** Slightly larger prompt when evaluateCoverage templates exist.

## TD-4: Model Selection

**Options:**
1. Use `getLanguageModelForOrg` (same as proposal-writer — respects tenant BYOK key)
2. Hardcoded to a specific model

**Chosen:** Option 1 — `getLanguageModelForOrg`
**Rationale:** FR-009 requires same BYOK key. Consistent with existing agent pattern.

## TD-5: API Route Location

**Options:**
1. `POST /api/rfps/[rfpId]/proposals/[draftId]/coverage`
2. `POST /api/proposals/[draftId]/coverage`

**Chosen:** Option 1 — nested under rfpId
**Rationale:** Matches existing route structure (`/api/rfps/[rfpId]/proposals/[draftId]/`). Both rfpId and draftId needed for re-evaluation.
