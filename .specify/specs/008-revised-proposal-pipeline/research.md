# Technology Research — F8: Revised Proposal Pipeline

**Feature:** F8 — Revised Proposal Pipeline
**Date:** 2026-02-26

---

## TD-1: Scope Line Parser — Heuristic vs. LLM-Assisted

**Context:** The scope-deliverables clarifying question collects free-text answers like:
> "Requirements Analysis: 40 hours, System Design: 20 hrs, Implementation by Developer: 120 hours"

The parser must convert this to `ScopeLineItem[]` for `computePricingEstimate`.

**Options Considered:**

1. **Heuristic regex/text parsing** — Pure TypeScript. Split on delimiters, extract quantity/unit/description with regex patterns. Zero API calls, zero latency.
   - Pros: No cost, no latency, no external dependency, deterministic
   - Cons: Fragile for unusual phrasing; may miss edge cases

2. **LLM-assisted parsing** — Use `generateObject` with a Zod schema to extract structured data from the freeform text.
   - Pros: More robust for unusual phrasing
   - Cons: Adds one extra LLM call per generation (~500ms, ~$0.001), increases cost, violates spec FR-006 ("no additional LLM calls")

**Chosen:** Option 1 — Heuristic regex
**Rationale:** Spec FR-006 explicitly mandates no additional LLM calls. Failure produces an empty array which triggers the placeholder path — a safe, specified fallback. The mandatory scope question (F6) is phrased to encourage structured answers (lists, table-like formats), making heuristic parsing reliable for well-formatted input.
**Tradeoffs:** Will miss unusual/conversational answers. Accepted — the alternative (placeholder) is better than hallucinated pricing.

---

## TD-2: Pipeline Step Parallelization

**Context:** Steps 2–6 are all independent fetches (customer context, requirements search, supplier context, required templates, situational templates). Running them sequentially adds unnecessary latency.

**Options Considered:**

1. **Sequential steps** — Each `step.run` awaited in sequence. Simple, but ~4–5 network round trips in serial.

2. **`Promise.all` over `step.run` calls** — Inngest v3 supports parallel steps via `Promise.all([step.run(...), step.run(...)])`. Steps execute concurrently on the Inngest worker. The overall wall time equals the slowest step rather than the sum.

3. **Grouped single step with internal `Promise.allSettled`** — Combine steps 3, 4, 5, 6 into one `step.run` call using `Promise.allSettled` internally.

**Chosen:** Option 2 — `Promise.all` over `step.run` for steps 2–6
**Rationale:** Inngest's documented parallel execution pattern. Steps retain their individual names in the Inngest dashboard for observability. Failure in one step does not abort others (each catches internally and returns a graceful empty result). Net latency for steps 2–6 equals the slowest of the five rather than their sum.
**Tradeoffs:** Inngest charges by step execution count, not wall time. No impact — step count is unchanged.

---

## TD-3: `updateDraftContent` Extension

**Context:** The current `updateDraftContent(draftId, orgId, markdownContent)` saves markdown and sets status to `'draft'`. F8 also needs to save `coverageReport` (JSONB) atomically in step 11.

**Options Considered:**

1. **Add optional 4th parameter** — `updateDraftContent(draftId, orgId, markdown, coverageReport?)`. The set payload includes `coverageReport` when provided.
2. **New `updateDraftWithCoverage` function** — Separate function signature, no backward compat concern.
3. **Use existing `updateDraft` generic patch** — Call `updateDraft(draftId, orgId, { markdownContent, status: 'draft', coverageReport })`. But `updateDraft` currently doesn't accept `coverageReport` in its patch type.

**Chosen:** Option 1 — Extend `updateDraftContent` with optional 4th parameter
**Rationale:** Minimal diff. All existing callers (5 test cases in the existing integration test) pass 3 arguments and continue to work unchanged. The function's single responsibility (set draft to 'draft' status with content) is not changed. `coverageReport` is additive.
**Tradeoffs:** Slightly wider function signature. Acceptable — the alternative of a new function would require adding a new import in generate-proposal.ts.

---

## TD-4: Situational Template Matching — DB Query vs. Application Filter

**Context:** Situational templates have `triggerRfpTypes: string[] | null` and `triggerIndustryTags: string[] | null`. The matching rule (FR-EC-010) is OR logic: a template matches if its rfpType list includes the RFP's type OR its industryTags list overlaps with the RFP's tags. Null on either field means "match all".

**Options Considered:**

1. **Complex JSONB DB query** — Use `?|` operator in WHERE clause with OR conditions. Accurate at DB level but requires complex conditional SQL (null checks + JSONB array intersection with OR).

2. **Fetch all non-required org templates, filter in TypeScript** — Simple WHERE clause (`organizationId = $1 AND is_required = false`), then apply matching logic in TypeScript.

**Chosen:** Option 2 — Fetch all, filter in TypeScript
**Rationale:** An organization typically has fewer than 50 templates. Network transfer of a small result set is negligible. TypeScript filter logic is far easier to test and reason about than conditional JSONB SQL. The `?|` operator approach would require generating dynamic SQL fragments and is harder to verify correct for the null-as-match-all semantics.
**Tradeoffs:** Returns all non-required templates to the application layer before filtering. Acceptable for expected data volumes.

---

## TD-5: Template Section Ordering

**Context:** FR-014 specifies canonical section order. `proposalTemplateSections` is already an ordered tuple in `src/lib/db/schema/proposal-templates.ts`.

**Decision:** Use `proposalTemplateSections` array index as the sort key. Templates with lower index in that array appear first. Within each section, `sortOrder` ascending applies.

```typescript
import { proposalTemplateSections } from '@/lib/db/schema/proposal-templates'
// Sort: (sectionIndex * 1000) + sortOrder — deterministic, no duplicates
```

**Rationale:** Reuses the canonical enum order already defined in the schema. No magic strings.

---

## TD-6: `writeProposal` Signature Update

**Context:** Current signature accepts `rfpSections, knowledgeContext, contentLibraryEntries, clarifyingAnswers, organizationId`. F8 needs to pass: `companyProfile`, `supplierContext` (TypedSupplierContext), `customerContext`, `learnings`, and `pricingMarkdown`. The old fields `knowledgeContext` and `contentLibraryEntries` are replaced by `requirementResults` (searchByRequirements output) and `supplierContext`.

**Decision:** Add new fields to `WriteProposalInput`, deprecate `knowledgeContext` and `contentLibraryEntries` in the same change. All fields needed by the new prompt are explicit in the interface.

**New interface shape:**
```typescript
interface WriteProposalInput {
  rfpSections: Array<{ id: string; title: string; content: string }>
  requirementResults: KnowledgeEntryWithSimilarity[]     // replaces knowledgeContext
  supplierContext: TypedSupplierContext                   // replaces contentLibraryEntries
  companyProfile: string | null
  customerContext: CustomerContext
  learnings: Learning[]
  pricingMarkdown: string                                // pre-computed pricing table
  clarifyingAnswers: ClarifyingQuestion[]
  organizationId: string
}
```

**Rationale:** Single clean interface update. The old `knowledgeContext`/`contentLibraryEntries` fields are removed since the caller (`generate-proposal.ts`) is being fully rewritten. The existing `proposal-writer.test.ts` will need updating to the new signature — this is expected.

---

## TD-7: Coverage Report Stub Interface

**Context:** F9 will un-stub step 9. The stub must produce a `CoverageReport` object that F9 can replace by calling a real agent. The stub interface should match the real output type so F9 only needs to replace the implementation, not the type.

**Decision:** Stub is a named function `generateCoverageReportStub(rfp): CoverageReport` in `generate-proposal.ts`. It is not exported (private to the pipeline). F9 will replace the call site with `import { generateCoverageReport } from '@/lib/ai/agents/proposal-coverage-checker'`.

**Stub output:**
```typescript
{
  coverageScore: 0,
  evaluatedAt: new Date().toISOString(),
  requirements: rfp.parsedStructure?.fields.map(f => ({
    requirementId: f.id,
    question: f.question,
    addressed: false,
    evidence: null,
    gap: 'Coverage check pending — re-evaluate after F9 is implemented'
  })) ?? []
}
```

**Rationale:** Clear contract for F9. The stub produces a valid `CoverageReport` that the UI can render (all requirements shown, all flagged as unaddressed). The gap message makes the stub state visible in the UI during testing.
