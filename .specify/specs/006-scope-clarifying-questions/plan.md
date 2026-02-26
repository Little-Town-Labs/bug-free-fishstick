# Implementation Plan — F6: Scope Clarifying Questions

**Feature ID:** F6
**Branch:** `006-scope-clarifying-questions` (stay on `main` — no branch switch)
**Spec:** `.specify/specs/006-scope-clarifying-questions/spec.md`
**PRD source:** `docs/prd-proposal-bid-engine.md` §5 US4
**Depends on:** F1 (`001-data-model-foundation`), F2 (`002-rate-card-management`)
**Blocks:** F8 (`008-revised-proposal-pipeline`)

---

## Executive Summary

The existing `generateClarifyingQuestions` agent generates questions entirely from LLM output,
which means the three commercially critical question categories (scope/effort, exclusions, timeline)
may or may not appear depending on the RFP content. This plan modifies the agent to guarantee those
three questions are always present and to phrase the scope/effort question according to the
organization's configured pricing model.

The implementation is a **contained modification** of two existing files and their tests:

1. `src/lib/ai/agents/proposal-question-generator.ts` — core changes
2. `src/lib/services/proposal-draft.ts` — call-site changes to fetch and forward pricing model

No schema migration is required. No new route, component, or infrastructure is introduced.

---

## Architecture Overview

```
createDraft (proposal-draft.ts)
  │
  ├─► getRateCard(orgId)           ← NEW: fetch proposalDefaults.pricingModel
  │     └─ try/catch → null on failure (T&M fallback)
  │
  └─► generateClarifyingQuestions({
        ...existingInputs,
        pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus' | null  ← NEW field
      })
        │
        ├─► buildMandatoryQuestions(pricingModel)   ← NEW pure function
        │     returns: [scope-deliverables, scope-exclusions, scope-timeline]
        │
        ├─► generateObject(...)                      ← MODIFIED system prompt
        │     LLM generates ≤7 context questions
        │     (instructed to skip the 3 mandatory topics)
        │
        └─► merge(mandatoryQuestions, llmQuestions.slice(0, 7))
              returns: 3–10 questions total
```

The question generator remains a pure async function with no side effects beyond the LLM call.
Settings fetching is the caller's responsibility (Constitution Article III: Explicit Over Implicit).

---

## Technology Stack

All technology choices reuse existing project infrastructure.

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript (strict) | Project standard; Constitution Article II |
| LLM call | `generateObject` from Vercel AI SDK | Existing pattern in this agent; structured output with Zod schema |
| Settings fetch | `getRateCard` from `src/lib/services/rate-card.ts` | Already exists; returns `proposalDefaults` |
| Pricing model type | `ProposalDefaults['pricingModel']` imported from schema | Single source of truth; avoids type drift |
| Tests | Vitest with vi.mock pattern | Existing test infrastructure |

---

## Technical Decisions

### TD-1: New input parameter `pricingModel`

**Decision:** Add `pricingModel?: ProposalDefaults['pricingModel'] | null` to
`GenerateClarifyingQuestionsInput`. The field is optional (TypeScript `?:`) which makes the type
`ProposalDefaults['pricingModel'] | null | undefined` at the call site — both `null` (explicit
absence) and `undefined` (field omitted by existing callers) are treated identically as T&M
fallback inside the agent.

**Rationale:** FR-015 — "The question generator input accepts the organization's pricing model as a
parameter; callers are responsible for fetching and passing this value." This is the explicit
interface the spec mandates.

**Null semantics:** `null` means no pricing model is configured. The agent falls back to
`'time_and_materials'` phrasing internally, but the type records that the caller explicitly passed
the absence of configuration. This is more informative than a string default at the call site.

---

### TD-2: `buildMandatoryQuestions` — pure function, exported for testing

**Decision:** Extract a named pure function `buildMandatoryQuestions(pricingModel:
ProposalDefaults['pricingModel'] | null | undefined): ClarifyingQuestion[]` that returns the three
mandatory questions. Export it from the agent module.

**Rationale:** This function has deterministic, branch-heavy logic (4 pricing model variants × 3
questions). Exporting it allows it to be tested directly without mocking the LLM. It is not a
public API — it is exported only for testability (Constitution Articles V and VI).

**Constants declared alongside this function:**
```typescript
export const MANDATORY_QUESTION_IDS = {
  DELIVERABLES: 'scope-deliverables',
  EXCLUSIONS:   'scope-exclusions',
  TIMELINE:     'scope-timeline',
} as const
```

These constants are the F8 contract. Exporting them prevents the downstream pipeline from having
magic strings.

---

### TD-3: Modified system prompt

**Decision:** Two changes to the `generateObject` system prompt:

1. **Cardinality reduction:** Change "Return between 3 and 10 questions" to "Return between 1 and 7
   questions." (The minimum of 1 is chosen rather than 0 because the LLM should always add at least
   one context-specific question alongside the mandatory scaffold.)

2. **Deduplication instruction:** Add to the Rules section:
   > "Do NOT ask about: deliverables, effort, hours, pricing, cost, budget, timeline, milestones,
   > or explicit exclusions. Those questions will be added separately."

**Rationale:** FR-012 (instruct LLM to skip mandatory topics) and FR-013 (cap at 7 to reserve 3
slots). The wording uses concrete nouns (hours, budget, milestones) rather than abstract categories
so the LLM reliably skips those domains.

---

### TD-4: Post-generation merge and trim logic

**Decision:** After `generateObject` resolves:
1. Trim LLM questions: `llmQuestions.slice(0, 7)`
2. Build mandatory questions: `buildMandatoryQuestions(pricingModel)`
3. Final output: `[...mandatoryQuestions, ...trimmedLlmQuestions]`

Mandatory questions occupy index 0–2. LLM questions follow. Total: 3–10.

**Rationale:** Mandatory questions at the front ensures they appear first in the UI's question list,
which is the natural user expectation for commercial scaffolding questions. Trimming happens before
merge so the ceiling is enforced deterministically.

---

### TD-5: Call-site changes in `createDraft`

**Decision:** In `src/lib/services/proposal-draft.ts`, `createDraft` gains the following before the
`generateClarifyingQuestions` call:

```typescript
let pricingModel: ProposalDefaults['pricingModel'] | null = null
try {
  const { proposalDefaults } = await getRateCard(orgId)
  pricingModel = proposalDefaults?.pricingModel ?? null
} catch (err) {
  // FR-016: settings read failure → T&M fallback; do not propagate
  // warn-level log only (no sensitive data)
}
```

Then pass `pricingModel` to `generateClarifyingQuestions`.

**Rationale:** FR-016 mandates graceful degradation. The try/catch here catches DB/network failures
and leaves `pricingModel` as `null`, which the agent will treat as T&M. The draft creation is not
blocked by a settings fetch failure.

---

### TD-6: Pricing model context in system prompt

**Decision:** The system prompt includes the pricing model label before the Rules section:

```
Organization pricing model: ${pricingModelLabel}
When phrasing questions about effort or cost, use this model's terminology.
```

Where `pricingModelLabel` is a map:
- `time_and_materials` → `"Time & Materials"`
- `fixed_price` → `"Fixed Price"`
- `cost_plus` → `"Cost-Plus"`
- `null` → `"Time & Materials (default — no model configured)"`

**Rationale:** FR-009 — the system prompt must include the pricing model label. This surfaces the
model to any LLM-generated questions that do touch on commercial matters (though they are instructed
not to duplicate the mandatory topics, they may still reference pricing terminology in other
contexts, e.g. "What budget approval process does your organization use?").

---

## Implementation Phases

### Phase 1: Core agent changes (no call-site yet)

Files modified:
- `src/lib/ai/agents/proposal-question-generator.ts`

Steps:
1. Add `pricingModel: ProposalDefaults['pricingModel'] | null` to `GenerateClarifyingQuestionsInput`
2. Export `MANDATORY_QUESTION_IDS` constants
3. Implement and export `buildMandatoryQuestions(pricingModel)` pure function
4. Modify the `generateObject` system prompt (cardinality + deduplication instruction + pricing
   model label)
5. Add post-generation trim and merge logic
6. Update return value construction to include mandatory questions

**No database calls added to the agent.** The agent remains pure relative to its inputs.

---

### Phase 2: Call-site changes

Files modified:
- `src/lib/services/proposal-draft.ts`

Steps:
1. Import `getRateCard` from `@/lib/services/rate-card`
2. Import `ProposalDefaults` type from `@/lib/db/schema/tenant-settings`
3. In `createDraft`, add the try/catch pricing model fetch before `generateClarifyingQuestions`
4. Forward `pricingModel` in the `generateClarifyingQuestions` call

---

### Phase 3: Tests — question generator

File: `tests/unit/agents/proposal-question-generator.test.ts`

New test cases (added to existing file, new `describe` block: `mandatory question injection`):

| Test | Assertion |
|------|-----------|
| All three mandatory IDs always present (T&M model) | `result.questions.map(q => q.id)` contains all 3 IDs |
| All three mandatory IDs always present (fixed_price) | Same assertion, different input |
| All three mandatory IDs always present (cost_plus) | Same assertion |
| All three mandatory IDs present when pricingModel is null | T&M fallback — same IDs present |
| `scope-deliverables` wording differs across T&M, fixed_price, cost_plus | Three distinct question strings |
| `scope-deliverables` wording for null falls back to T&M wording | String equality with T&M variant |
| `scope-exclusions` wording is identical across all pricing models | Same string for all 4 inputs |
| `scope-timeline` wording is identical across all pricing models | Same string for all 4 inputs |
| Mandatory questions appear before LLM questions | First 3 elements have `scope-*` IDs |
| LLM generating 10 questions is trimmed to 7 before merge (total = 10) | `result.questions.length === 10` |
| LLM generating 3 questions produces total of 6 | `result.questions.length === 6` |
| LLM generating 0 questions (edge case) produces total of 3 | `result.questions.length === 3` |
| `buildMandatoryQuestions` unit test — T&M | Direct call, check IDs and text |
| `buildMandatoryQuestions` unit test — fixed_price | Direct call, check IDs and text |
| `buildMandatoryQuestions` unit test — cost_plus | Direct call, check IDs and text |
| System prompt includes pricing model label | Check prompt string passed to `generateObject` |

**Existing tests remain unchanged.** The new `pricingModel` parameter defaults allow existing test
fixtures to pass `null` or omit it with a typed default.

> Note on backward compatibility: To avoid breaking existing tests, the `pricingModel` field on
> `GenerateClarifyingQuestionsInput` should be typed as optional (`pricingModel?:
> ProposalDefaults['pricingModel'] | null`) with an internal default of `null`. Existing test
> fixtures do not need updating.

---

### Phase 4: Tests — call-site (`proposal-draft.ts`)

File: `tests/unit/services/proposal-draft.test.ts`

New mocks needed:
- `vi.mock('@/lib/services/rate-card', () => ({ getRateCard: vi.fn() }))`

New test cases (in existing `createDraft` describe block):

| Test | Setup | Assertion |
|------|-------|-----------|
| Passes `pricingModel` from settings to question generator | Mock `getRateCard` → `{ proposalDefaults: { pricingModel: 'fixed_price', ... } }` | `generateClarifyingQuestions` called with `pricingModel: 'fixed_price'` |
| Passes null when `proposalDefaults` is null | Mock `getRateCard` → `{ proposalDefaults: null }` | `generateClarifyingQuestions` called with `pricingModel: null` |
| Passes null when `getRateCard` throws | Mock `getRateCard` → `rejects(new Error(...))` | `generateClarifyingQuestions` still called with `pricingModel: null`; `createDraft` does not throw |

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/ai/agents/proposal-question-generator.ts` | Modify | Add `pricingModel` param, `MANDATORY_QUESTION_IDS`, `buildMandatoryQuestions`, updated prompt, trim/merge logic |
| `src/lib/services/proposal-draft.ts` | Modify | Add `getRateCard` call in `createDraft`, forward `pricingModel` |
| `tests/unit/agents/proposal-question-generator.test.ts` | Extend | New describe block: `mandatory question injection` |
| `tests/unit/services/proposal-draft.test.ts` | Extend | New test cases in `createDraft` describe |

**No other files change.** No new files are created.

---

## Security Considerations

**FR-002 / NFR-002 — Prompt injection prevention:**

The `pricingModel` value is a TypeScript union literal (`'time_and_materials' | 'fixed_price' |
'cost_plus'`). It is read from a JSONB column that is validated at write time by `upsertRateCard`
using the Zod schema. The value injected into the system prompt is mapped through a hardcoded lookup
table (not interpolated directly from user input). This prevents any prompt injection through a
crafted `pricingModel` value.

**Tenant isolation (Constitution Article I):**

The `pricingModel` is fetched via `getRateCard(orgId)` where `orgId` is the authenticated
organization ID from the Clerk session, passed through `createDraft`. No cross-tenant access is
possible.

**No secrets in logs:**

The catch block for the `getRateCard` failure uses a single `console.warn` (or the project's
logger, if one exists) with only the error message — not the orgId or any settings data.

---

## Performance Considerations

**NFR-001 — No additional LLM calls:**

The mandatory questions are built synchronously in `buildMandatoryQuestions`. The only LLM call
is the existing `generateObject`. No latency increase.

**`getRateCard` in `createDraft`:**

One additional indexed DB query (`WHERE organization_id = $1`) on `tenant_settings` which already
has a primary key index on `organization_id`. Expected latency: <5ms. No measurable impact on the
overall `createDraft` flow.

---

## Testing Strategy

**Pattern:** Extends the existing project pattern in `tests/unit/agents/`.

- All new tests use `vi.mock` to mock `generateObject` and return controlled fixtures
- `buildMandatoryQuestions` is tested as a pure function (no mocking needed)
- The `pricingModel` parameter is the only new input; tests vary it across all 4 values
  (`'time_and_materials'`, `'fixed_price'`, `'cost_plus'`, `null`)
- No integration tests required — the agent is already fully unit-tested and the call site has
  existing integration coverage via `tests/integration/inngest/generate-proposal.test.ts`
- All tests must pass before the feature is considered complete (Constitution Article V: 80%
  coverage)

**Backward compatibility guarantee:** Adding `pricingModel?` as an optional parameter means all
existing tests continue to pass without modification.

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| LLM ignores the "don't ask about timeline" instruction and generates a duplicate | Medium | Exact deduplication by `question.id` is not needed (IDs are distinct); semantic duplication is accepted per spec Decision 1. Tests only verify mandatory IDs are present, not that LLM questions are semantically unique. |
| LLM returns fewer than 1 context question despite the minimum | Low | Minimum in the updated prompt is 1; the merge still works if the LLM returns 0 (total = 3, which is within spec). |
| `proposalDefaults.pricingModel` in DB is a stale value from before F2 was deployed | Low | The Zod schema at write time validates the enum; stale values would have to predate the migration. No mitigation needed beyond the existing schema validation. |
| `getRateCard` latency spike in prod causing `createDraft` to slow down | Very Low | `tenant_settings` is a small table with PK index. Monitored by existing Vercel analytics. |

---

## Constitutional Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Tenant Isolation | Compliant | `pricingModel` sourced via `getRateCard(orgId)` where `orgId` is session-scoped |
| II. Type Safety | Compliant | `ProposalDefaults['pricingModel']` reused from schema; no `any` types introduced |
| III. Explicit Over Implicit | Compliant | Pricing model passed as input parameter, not fetched inside the agent |
| IV. Secure by Default | Compliant | Prompt uses hardcoded label map, not raw user input; no PII logged |
| V. 80% Coverage | Compliant | All new branches covered by targeted unit tests |
| VI. Test the Agents | Compliant | `buildMandatoryQuestions` tested directly; `generateClarifyingQuestions` with all model variants mocked |
| VII. Integration Tests for Workflows | Compliant | Existing `generate-proposal.test.ts` integration test covers the full flow; no new integration tests needed for this contained change |
| VIII. Document Fidelity Tests | N/A | No document output changes |
| IX–XII. UX Principles | N/A | No UI changes |
| XIII–XVI. Performance | Compliant | No LLM calls added; one indexed DB query added |

---

## Next Steps After This Plan

1. Run `/speckit-tasks` to generate the executable task breakdown
2. Run `/speckit-analyze` to validate consistency with F1, F2, and F8 contracts
3. Implement via TDD (write tests first, then implementation)
4. Run `pnpm vitest run` to verify 80% coverage threshold is maintained
5. Commit: `feat: guaranteed scope clarifying questions with pricing model awareness`
