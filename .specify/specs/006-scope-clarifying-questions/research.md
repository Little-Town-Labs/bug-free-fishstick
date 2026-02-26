# Technology Research — F6: Scope Clarifying Questions

## Context

This feature modifies a single existing module (`proposal-question-generator.ts`) and its call site
(`proposal-draft.ts` → `createDraft`). No new infrastructure is introduced. The research decisions
below concern internal design patterns, not external library choices.

---

## Decision 1: Where to inject the pricing model value

**Context:** The question generator needs `proposalDefaults.pricingModel` to phrase the mandatory
scope-deliverables question. Two architectural approaches exist for getting that value into the agent.

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A — Caller fetches, passes as param | `createDraft` calls `getRateCard`, extracts `pricingModel`, passes it into `generateClarifyingQuestions` | Explicit dependency; agent is pure; testable without DB | Caller must know to fetch it; slightly more code at call site |
| B — Agent fetches internally | Agent calls `getRateCard(organizationId)` internally using the already-available `organizationId` | Call site unchanged | Hidden side effect; harder to test in isolation; violates Constitution III (explicit over implicit) |

**Chosen:** Option A — Caller fetches and passes as a typed parameter.

**Rationale:** Constitution Article III ("Explicit Over Implicit") is the deciding factor. The agent's
input interface should declare every input it uses. Hidden DB reads inside the agent make it harder
to test deterministically (Constitution Article VI) and obscure the dependency in code review. The
call site already has `orgId` and `getRateCard` is a one-line service call.

**Tradeoffs accepted:** The call site (`createDraft`) gains one extra async step. This is a minor
readability cost with no performance implication since `getRateCard` is a single indexed DB query.

---

## Decision 2: Mandatory question construction — code constants vs. database-driven templates

**Context:** The spec (Decision 4 in §Clarifications Resolved) already settled this as code
constants. Research confirms this is correct.

**Options considered:**

| Option | Description |
|--------|-------------|
| A — Code constants | Three question objects built in TypeScript, exported as `MANDATORY_SCOPE_QUESTIONS` |
| B — DB-driven templates | Questions stored in `proposal_templates` table, fetched at generation time |

**Chosen:** Option A — Code constants.

**Rationale:** The spec explicitly states "mandatory questions are code constants, not
admin-configurable." Stable IDs (`scope-deliverables`, `scope-exclusions`, `scope-timeline`) are a
contract with F8's scope-line parser. Making them DB-driven would require a migration, seeding logic,
and admin protection to prevent accidental deletion, adding significant complexity for zero benefit.

---

## Decision 3: Pricing model type — reuse vs. redeclare

**Context:** `ProposalDefaults.pricingModel` is already typed as
`'time_and_materials' | 'fixed_price' | 'cost_plus'` in `src/lib/db/schema/tenant-settings.ts`.

**Options considered:**

| Option | Description |
|--------|-------------|
| A — Reuse existing type | Import `ProposalDefaults` (or just the union type) from the schema file |
| B — Redeclare locally | Inline the union string literal type in the question generator's interface |

**Chosen:** Option A — Import and reuse `ProposalDefaults['pricingModel']` from the schema.

**Rationale:** Avoids type drift. If a new pricing model variant is added to `ProposalDefaults` in a
future feature, the question generator automatically handles it (or produces a TypeScript error
that makes the gap explicit). Constitution Article II (Type Safety) supports single-source-of-truth
for domain types.

---

## Decision 4: Question trimming when LLM over-generates

**Context:** The spec (Decision 3, §Clarifications) establishes that the LLM is instructed to
generate up to 7 questions (reserving 3 for mandatory). If it returns more, trimming is needed.

**Options considered:**

| Option | Description |
|--------|-------------|
| A — Trim after receiving LLM output | Slice LLM questions to 7, then append 3 mandatory |
| B — Trust the LLM prompt | Rely on the prompt instruction; don't add code to trim |
| C — Trim to maintain a configurable max | Pass `maxQuestions` as a parameter |

**Chosen:** Option A — Trim defensively after receiving LLM output.

**Rationale:** LLMs do not always respect cardinality instructions precisely. Option B is fragile and
would let the contract with the rest of the system (max 10 total questions) be broken silently.
Option C adds unnecessary parameterization for a constant that is unlikely to change. A simple
`.slice(0, 7)` after the LLM call is the minimal, predictable implementation.

---

## Decision 5: Error handling for `getRateCard` failure in the caller

**Context:** FR-016 states that if tenant settings read fails, question generation proceeds with T&M
fallback rather than failing. The spec places this responsibility at question-generation time.

**Options considered:**

| Option | Description |
|--------|-------------|
| A — Try/catch in `createDraft`, pass null on failure | Caller catches the settings fetch error, passes `null` as the pricing model, and logs a warning |
| B — Try/catch inside `generateClarifyingQuestions` | The agent function itself catches a `getRateCard` failure internally |

**Chosen:** Option A — try/catch in `createDraft`.

**Rationale:** Consistent with Decision 1 above (caller-fetched value). If the agent does not fetch
settings, it cannot catch the failure either. The caller catches the error, logs it with context,
and passes `null` to the agent. The agent's fallback for `null` is T&M phrasing. This keeps the
agent a pure function relative to its declared inputs.

---

## Decision 6: Test file location and naming convention

**Context:** The existing test for the question generator is at
`tests/unit/agents/proposal-question-generator.test.ts`. This feature adds tests to that file.
The `proposal-draft.ts` service already has a test at `tests/unit/services/proposal-draft.test.ts`.

**Chosen:**
- New tests for the question generator modifications → extend existing
  `tests/unit/agents/proposal-question-generator.test.ts`
- New tests for `createDraft` call-site changes → extend existing
  `tests/unit/services/proposal-draft.test.ts`

**Rationale:** Matches the project's one-file-per-module convention. Creating new test files for
additions to existing modules would fragment test coverage reports and conflict with the established
pattern.
