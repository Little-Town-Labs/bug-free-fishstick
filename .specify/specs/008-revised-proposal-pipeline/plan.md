# Implementation Plan — F8: Revised Proposal Pipeline

**Feature ID:** F8
**Branch:** `008-revised-proposal-pipeline` (stay on `main` — no branch switch)
**Spec:** `.specify/specs/008-revised-proposal-pipeline/spec.md`
**PRD source:** `docs/prd-proposal-bid-engine.md` §6.4
**Depends on:** F1–F7 (all committed)
**Blocks:** F9 (`009-coverage-checker-agent`)

---

## Executive Summary

F8 rebuilds `src/lib/inngest/functions/generate-proposal.ts` from 6 steps to 11 steps, wiring together all Phase 1–2 deliverables. In addition to the pipeline rewrite, two supporting files change: `proposal-writer.ts` gets a new input interface and restructured prompt, and `proposal-draft.ts` gains an optional `coverageReport` parameter on `updateDraftContent`. One new file is introduced: `src/lib/services/scope-line-parser.ts` (pure heuristic parser, no I/O).

No new database tables. No new API routes. No new UI components. No new Inngest events.

---

## Architecture Overview

```
proposal/generate event
        │
        ▼
generate-proposal.ts (Inngest function)
        │
        ├─ Pre-step: decrypt openaiApiKey
        │
        ├─ Step 1: fetch-draft-and-rfp
        │     └─ DB: proposalDrafts + rfps (tenant-scoped)
        │
        ├─ Steps 2–6 [PARALLEL via Promise.all]:
        │     ├─ Step 2: fetch-customer-context
        │     │     └─ fetchCustomerContext(rfp.customerId, orgId)  [F7]
        │     ├─ Step 3: search-requirements
        │     │     └─ searchByRequirements(rfp.parsedStructure.fields, orgId, key)  [F7]
        │     ├─ Step 4: fetch-typed-supplier-context
        │     │     ├─ fetchTypedSupplierContext(orgId, rfp.industryTags, rfp.rfpType)  [F7]
        │     │     ├─ fetchLearnings(orgId, rfp.customerId)  [F7]
        │     │     └─ DB: tenantSettings.companyProfile
        │     ├─ Step 5: fetch-required-templates
        │     │     └─ DB: proposalTemplates WHERE isRequired=true
        │     └─ Step 6: fetch-situational-templates
        │           └─ DB: proposalTemplates WHERE isRequired=false → TypeScript filter
        │
        ├─ Step 7: compute-pricing
        │     ├─ DB: tenantSettings.rateCard + proposalDefaults
        │     ├─ parseScopeLines(draft.clarifyingQuestions)  [new]
        │     └─ computePricingEstimate(rateCard, scopeLines, pricingModel)  [F5]
        │
        ├─ Step 8: generate-proposal-content
        │     └─ writeProposal({ rfpSections, requirementResults, supplierContext,
        │                         companyProfile, customerContext, learnings,
        │                         pricingMarkdown, clarifyingAnswers, organizationId })
        │
        ├─ Step 9: check-requirement-coverage (STUB)
        │     └─ generateCoverageReportStub(rfp) → CoverageReport (all false)
        │
        ├─ Step 10: inject-required-templates
        │     └─ sortAndRenderTemplates([...required, ...situational])
        │           → llmOutput + '\n\n---\n\n## Supplier Terms & Conditions\n\n' + templatesBlock
        │
        └─ Step 11: save-proposal-content
              └─ updateDraftContent(draftId, orgId, finalMarkdown, coverageReport)
```

---

## Technology Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Scope line parser | Pure TypeScript regex | No LLM calls (spec FR-006); deterministic; failure → empty array → placeholder pricing |
| Pipeline parallelism | `Promise.all([step.run(...)])` | Inngest v3 supported pattern; parallel steps in dashboard; reduces wall time for steps 2–6 |
| Template ordering | `proposalTemplateSections` array index | Schema-driven canonical order; no magic strings |
| Coverage stub | Inline function in generate-proposal.ts | F9 replaces one call site; no exported interface needed yet |
| DB update | Extended `updateDraftContent` (optional 4th param) | Backward-compatible; all existing callers unchanged |

---

## Technical Decisions

### TD-1: Scope Line Parser — Heuristic
- **Decision:** Pure TypeScript regex parsing, no LLM call
- **Chosen:** Heuristic (see research.md TD-1)
- **Failure mode:** Returns `[]` → `computePricingEstimate` returns placeholder markdown

### TD-2: Steps 2–6 Parallelization
- **Decision:** `Promise.all([step.run('step-2', ...), step.run('step-3', ...), ...])`
- **Chosen:** Inngest parallel step pattern (see research.md TD-2)
- **Effect:** Wall time for steps 2–6 = max(individual step times), not sum

### TD-3: `updateDraftContent` optional 4th param
- **Decision:** Add `coverageReport?: CoverageReport` as optional parameter
- **Chosen:** Option 1 (see research.md TD-3)
- **Backward compat:** All existing 3-arg callers continue to work

### TD-4: Situational template matching in TypeScript
- **Decision:** Fetch all non-required templates, filter in app code
- **Chosen:** TypeScript filter (see research.md TD-4)

### TD-5: Template section ordering
- **Decision:** Use `proposalTemplateSections` array index
- **Implementation:** `proposalTemplateSections.indexOf(template.section)` as primary sort key; `sortOrder` as secondary

### TD-6: `writeProposal` signature update
- **Decision:** New `WriteProposalInput` interface; old `knowledgeContext`/`contentLibraryEntries` removed
- **Breaking change:** Contained — the only caller is `generate-proposal.ts`, which is being rewritten

### TD-7: Coverage stub interface
- **Decision:** `generateCoverageReportStub` inline private function in generate-proposal.ts
- **F9 migration:** F9 replaces the call with `await generateCoverageReport(rfp, proposalMarkdown, orgId)`

---

## Implementation Phases

### Phase 1: Scope Line Parser (TDD — tests first)

**File:** `src/lib/services/scope-line-parser.ts` (new)
**Test file:** `tests/unit/services/scope-line-parser.test.ts` (new)

The parser is a pure function with no I/O — ideal for TDD. Write tests first, confirm RED, then implement.

```typescript
// Public API
export function parseScopeLines(
  clarifyingQuestions: ClarifyingQuestion[],
): ScopeLineItem[]
```

**Parser algorithm:**
1. Find question with `id === MANDATORY_QUESTION_IDS.DELIVERABLES` (i.e. `'scope-deliverables'`)
2. If no such question, or answer is null/empty, return `[]`
3. Split answer text on newlines, semicolons, and bullet markers (`-`, `*`, `•`)
4. For each candidate line:
   a. Extract quantity: first numeric value in the line (integer or decimal)
   b. Identify unit: look for keywords `hour`/`hours`/`hr`/`hrs` → `'hour'`; `day`/`days`/`d` (standalone) → `'day'`; `fixed` → `'fixed'`; if no unit found, skip this line
   c. Extract description: the remaining text after removing the quantity + unit tokens; trim
   d. Extract role (optional): look for ` by [Word(s)]` or `([Role])` pattern; remove from description
5. Cap at 20 line items; return empty array if zero parseable items

**Tests required (before implementation):**
- `[]` when question not found in array
- `[]` when answer is null
- `[]` when answer is empty string
- `[]` when answer has text but no parseable quantities/units
- Single line: `"Requirements Analysis: 40 hours"` → 1 item (qty=40, unit=hour)
- Single line with role: `"Development by Senior Developer: 120 hrs"` → role populated
- Multi-line with newlines: 3 lines → 3 items
- Day unit: `"2 days of workshops"` → unit=day
- Fixed unit: `"1 fixed deliverable"` → unit=fixed
- Mixed units in one answer
- Cap at 20: answer with 25 lines → 20 items
- Skips lines with no unit: mixed parseable and unparseable → only parseable returned

---

### Phase 2: `updateDraftContent` Extension (TDD)

**File:** `src/lib/services/proposal-draft.ts` (modify)
**Test file:** `tests/unit/services/proposal-draft.test.ts` (extend)

Add optional 4th parameter:
```typescript
export async function updateDraftContent(
  draftId: string,
  orgId: string,
  markdownContent: string,
  coverageReport?: CoverageReport,
): Promise<ProposalDraft>
```

When `coverageReport` is provided, include it in the `set()` payload. When absent, do not include (existing behavior preserved).

**New tests (before implementation):**
- Calls DB update with coverageReport when 4th arg provided
- Does NOT include coverageReport in set payload when 4th arg omitted (existing tests unchanged)

---

### Phase 3: `writeProposal` Update (TDD)

**File:** `src/lib/ai/agents/proposal-writer.ts` (modify)
**Test file:** `tests/unit/agents/proposal-writer.test.ts` (rewrite)

**New `WriteProposalInput` interface:**
```typescript
export interface WriteProposalInput {
  rfpSections: Array<{ id: string; title: string; content: string }>
  requirementResults: KnowledgeEntryWithSimilarity[]
  supplierContext: TypedSupplierContext
  companyProfile: string | null
  customerContext: CustomerContext
  learnings: Learning[]
  pricingMarkdown: string
  clarifyingAnswers: ClarifyingQuestion[]
  organizationId: string
}
```

**Updated system prompt** (excerpt):
```
You are an expert proposal writer generating a complete, professional first-pass proposal.

IMPORTANT RESTRICTIONS:
- Do NOT generate Terms & Conditions, Assumptions, Exclusions, Payment Terms, Change Management, IP Ownership, Liability, Force Majeure, or Warranty sections. These will be added separately by the system.
- Do NOT perform any pricing calculations. The pricing section is pre-computed and provided to you.

FORMATTING RULES:
1. Create one section per RFP requirement (## Heading for each).
2. Immediately after each heading, add a source blockquote: > *Source: [source]*
3. Insert the pre-computed PRICING SECTION exactly as provided — do not modify it.
4. Use [PLACEHOLDER: brief description] for any section with insufficient evidence.
5. Start with # Proposal.
```

**Updated prompt structure:**
```
## RFP Requirements
${rfpSections}

## Company Profile
${companyProfile}  (omit block if null/empty)

## Knowledge Base Context
${requirementResults grouped by type}

## Certifications
${supplierContext.certifications}

## Case Studies
${supplierContext.caseStudies}

## Past Winning Proposals
${supplierContext.wonPastRfps}

## Customer Preferences
Tone: ${customerContext?.preferredTone}
Industry: ${customerContext?.industryContext}
Instructions: ${customerContext?.customInstructions}
(omit block if null)

## Learnings
${learnings}

## Scope & Clarifying Question Answers
${clarifyingAnswers}

## PRE-COMPUTED PRICING SECTION (insert verbatim)
${pricingMarkdown}
```

**Tests required:**
- `generateText` called with new input shape
- System prompt contains "Do NOT generate Terms & Conditions"
- Prompt includes pricingMarkdown verbatim
- Company profile block omitted when null
- Customer context block omitted when null
- Returns `{ markdownContent: text }` unchanged

---

### Phase 4: Pipeline Rewrite — Tests First (Integration Test)

**File:** `tests/integration/inngest/generate-proposal.test.ts` (rewrite)

This is the key TDD gate. The existing test file mocks the old dependencies. Rewrite it to mock all F7 + F5 services and verify the 11-step pipeline.

**New mocks needed:**
```typescript
vi.mock('@/lib/services/proposal-retrieval', () => ({
  searchByRequirements: vi.fn().mockResolvedValue([]),
  fetchTypedSupplierContext: vi.fn().mockResolvedValue({ companyDocs: [], certifications: [], caseStudies: [], wonPastRfps: [] }),
  fetchCustomerContext: vi.fn().mockResolvedValue(null),
  fetchLearnings: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/rate-card', () => ({
  getRateCard: vi.fn().mockResolvedValue({ rateCard: null, proposalDefaults: null }),
}))

vi.mock('@/lib/services/scope-line-parser', () => ({
  parseScopeLines: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/services/pricing-computation', () => ({
  computePricingEstimate: vi.fn().mockReturnValue({
    formattedMarkdown: '[PLACEHOLDER: pricing details required]',
    isPlaceholder: true,
    total: 0,
  }),
}))
```

**Tests required (before pipeline implementation):**
| Test | Assertion |
|------|-----------|
| All 11 step names called | `step.run` called with each of the 11 step name strings |
| `fetchCustomerContext` called with rfp.customerId | Called with `('customer-1', 'org-1')` |
| `searchByRequirements` called with parsed structure fields | Called with the fields array |
| `fetchTypedSupplierContext` called | Called with orgId, industryTags, rfpType |
| Templates fetched for org | DB select on proposalTemplates |
| `parseScopeLines` called with draft.clarifyingQuestions | Called with array |
| `computePricingEstimate` called with rateCard + scopeLines | Called with correct args |
| `writeProposal` called with new input shape | `expect.objectContaining({ pricingMarkdown: ... })` |
| Templates appended post-LLM | `updateDraftContent` called with markdown containing template content |
| `updateDraftContent` called with coverageReport | 4-arg call with CoverageReport |
| No pricing in LLM prompt when rate card null | `pricingMarkdown` is placeholder string, not rate values |
| LLM failure sets draft to error | DB update called with `status: 'error'` |
| Required template content verbatim in output | Exact string match in final markdown |
| Situational template with matching rfpType included | Template content appears in output |
| Situational template with non-matching type excluded | Template content NOT in output |

---

### Phase 5: Pipeline Implementation

**File:** `src/lib/inngest/functions/generate-proposal.ts` (rewrite)

Implement to make all Phase 4 tests pass. Full file structure:

```typescript
import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { rfps, proposalDrafts, tenantSettings, proposalTemplates } from '@/lib/db/schema'
import { proposalTemplateSections } from '@/lib/db/schema/proposal-templates'
import type { ProposalTemplate } from '@/lib/db/schema/proposal-templates'
import type { CoverageReport } from '@/lib/db/schema/proposal-drafts'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/services/encryption'
import { getRateCard } from '@/lib/services/rate-card'
import {
  searchByRequirements,
  fetchTypedSupplierContext,
  fetchCustomerContext,
  fetchLearnings,
} from '@/lib/services/proposal-retrieval'
import { parseScopeLines } from '@/lib/services/scope-line-parser'
import { computePricingEstimate } from '@/lib/services/pricing-computation'
import { writeProposal } from '@/lib/ai/agents/proposal-writer'
import { updateDraftContent } from '@/lib/services/proposal-draft'

// Private helper: coverage stub (F9 replaces this call site)
function generateCoverageReportStub(rfp: Rfp): CoverageReport {
  return {
    coverageScore: 0,
    evaluatedAt: new Date().toISOString(),
    requirements: rfp.parsedStructure?.fields.map(f => ({
      requirementId: f.id,
      question: f.question,
      addressed: false,
      evidence: null,
      gap: 'Coverage check pending — re-evaluate after F9 is implemented',
    })) ?? [],
  }
}

// Private helper: sort and render templates block
function renderTemplatesBlock(templates: ProposalTemplate[]): string {
  if (templates.length === 0) return ''
  const sorted = [...templates].sort((a, b) => {
    const aIdx = proposalTemplateSections.indexOf(a.section as typeof proposalTemplateSections[number])
    const bIdx = proposalTemplateSections.indexOf(b.section as typeof proposalTemplateSections[number])
    if (aIdx !== bIdx) return aIdx - bIdx
    return a.sortOrder - b.sortOrder
  })
  const body = sorted.map(t => `### ${t.title}\n\n${t.content}`).join('\n\n')
  return `\n\n---\n\n## Supplier Terms & Conditions\n\n${body}`
}

// Private helper: situational template matching
function matchesSituational(template: ProposalTemplate, rfpType: string | null, industryTags: string[] | null): boolean {
  const hasRfpTypeTrigger = template.triggerRfpTypes !== null && template.triggerRfpTypes.length > 0
  const hasTagTrigger = template.triggerIndustryTags !== null && template.triggerIndustryTags.length > 0
  if (!hasRfpTypeTrigger && !hasTagTrigger) return true  // null/null = match all
  if (hasRfpTypeTrigger && rfpType && template.triggerRfpTypes!.includes(rfpType)) return true
  if (hasTagTrigger && industryTags?.some(tag => template.triggerIndustryTags!.includes(tag))) return true
  return false
}

export const generateProposal = inngest.createFunction(
  { id: 'generate-proposal', name: 'Generate Proposal Draft' },
  { event: 'proposal/generate' },
  async ({ event, step }) => {
    const { draftId, rfpId, organizationId } = event.data

    // Pre-step: decrypt BYOK OpenAI key (never serialized by Inngest)
    const openaiApiKey = await (async () => {
      const [row] = await db.select({ k: tenantSettings.openaiApiKeyEncrypted })
        .from(tenantSettings).where(eq(tenantSettings.organizationId, organizationId)).limit(1)
      return row?.k ? decrypt(row.k) : undefined
    })()

    try {
      // Step 1: Fetch draft and RFP
      const { draft, rfp } = await step.run('fetch-draft-and-rfp', async () => { ... })
      if (!draft || !rfp) throw new Error('Draft or RFP not found')

      // Steps 2–6: Parallel fetches
      const [customerContext, requirementResults, { supplierContext, companyProfile, learnings },
             requiredTemplates, allSituationalTemplates] = await Promise.all([
        step.run('fetch-customer-context', async () => {
          try { return await fetchCustomerContext(rfp.customerId, organizationId) }
          catch { return null }
        }),
        step.run('search-requirements', async () => {
          const fields = rfp.parsedStructure?.fields ?? []
          try { return await searchByRequirements(fields, organizationId, openaiApiKey) }
          catch { return [] }
        }),
        step.run('fetch-typed-supplier-context', async () => {
          const [ctx, learns, [settings]] = await Promise.all([
            fetchTypedSupplierContext(organizationId, rfp.industryTags, rfp.rfpType),
            fetchLearnings(organizationId, rfp.customerId),
            db.select({ cp: tenantSettings.companyProfile }).from(tenantSettings)
              .where(eq(tenantSettings.organizationId, organizationId)).limit(1),
          ])
          return { supplierContext: ctx, learnings: learns, companyProfile: settings?.cp ?? null }
        }),
        step.run('fetch-required-templates', async () => {
          return db.select().from(proposalTemplates)
            .where(and(eq(proposalTemplates.organizationId, organizationId),
                       eq(proposalTemplates.isRequired, true)))
        }),
        step.run('fetch-situational-templates', async () => {
          return db.select().from(proposalTemplates)
            .where(and(eq(proposalTemplates.organizationId, organizationId),
                       eq(proposalTemplates.isRequired, false)))
        }),
      ])

      // Filter situational templates to matching ones (OR logic)
      const situationalTemplates = allSituationalTemplates.filter(t =>
        matchesSituational(t, rfp.rfpType, rfp.industryTags)
      )

      // Step 7: Compute pricing
      const { pricingMarkdown } = await step.run('compute-pricing', async () => {
        const { rateCard, proposalDefaults } = await getRateCard(organizationId)
        const scopeLines = parseScopeLines(draft.clarifyingQuestions ?? [])
        const estimate = computePricingEstimate(
          rateCard,
          scopeLines,
          proposalDefaults?.pricingModel ?? 'time_and_materials',
        )
        return { pricingMarkdown: estimate.formattedMarkdown }
      })

      // Step 8: Generate proposal content
      const rfpSections = rfp.parsedStructure
        ? rfp.parsedStructure.fields.map(f => ({ id: f.id, title: f.question, content: f.question }))
        : [{ id: 'default', title: rfp.name, content: rfp.name }]

      const { markdownContent } = await step.run('generate-proposal-content', async () => {
        return writeProposal({
          rfpSections,
          requirementResults,
          supplierContext,
          companyProfile,
          customerContext,
          learnings,
          pricingMarkdown,
          clarifyingAnswers: draft.clarifyingQuestions ?? [],
          organizationId,
        })
      })

      // Step 9: Coverage check (STUB — F9 replaces this)
      const coverageReport = await step.run('check-requirement-coverage', async () => {
        return generateCoverageReportStub(rfp)
      })

      // Step 10: Inject templates verbatim post-LLM
      const finalMarkdown = await step.run('inject-required-templates', async () => {
        const allTemplates = [...requiredTemplates, ...situationalTemplates]
        return markdownContent + renderTemplatesBlock(allTemplates)
      })

      // Step 11: Save content + coverage report
      await step.run('save-proposal-content', async () => {
        return updateDraftContent(draftId, organizationId, finalMarkdown, coverageReport)
      })

      return { draftId, status: 'draft' }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error during generation'
      await db.update(proposalDrafts)
        .set({ status: 'error', generationError: msg, updatedAt: new Date() })
        .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, organizationId)))
      return { draftId, status: 'error', error: msg }
    }
  }
)
```

---

## File Change Summary

| File | Change | Lines (est.) |
|------|--------|------|
| `src/lib/services/scope-line-parser.ts` | New | ~80 |
| `src/lib/services/proposal-draft.ts` | Extend `updateDraftContent` (optional 4th param) | +10 |
| `src/lib/ai/agents/proposal-writer.ts` | New interface + restructured prompt | ~140 (was 97) |
| `src/lib/inngest/functions/generate-proposal.ts` | Complete rewrite (6→11 steps) | ~180 (was 117) |
| `tests/unit/services/scope-line-parser.test.ts` | New | ~120 |
| `tests/unit/services/proposal-draft.test.ts` | Extend (2 new tests) | +30 |
| `tests/unit/agents/proposal-writer.test.ts` | Rewrite for new interface | ~100 |
| `tests/integration/inngest/generate-proposal.test.ts` | Rewrite (new mocks, 14+ tests) | ~280 |

**Total new/modified files:** 8

---

## Security Considerations

**NFR-002 — Rate card data not in LLM context:**
`rateCard` values (blendedRate, role rates, margins, discount amounts) are never passed to `writeProposal`. Only `pricingMarkdown` (a pre-formatted table) is included. This prevents the LLM from having access to commercially sensitive pricing parameters.

**NFR-006 — Templates not in LLM prompt:**
Template content is concatenated to the output string after `generateText` returns. The LLM system prompt explicitly instructs not to generate T&C sections, and template text is never in the prompt context.

**Tenant isolation (Constitution Article I):**
- Every DB query includes `organizationId` filter
- `fetchCustomerContext`, `fetchTypedSupplierContext`, `fetchLearnings` all accept and enforce `orgId`
- Template queries filter by `organizationId`
- Rate card fetch via `getRateCard(organizationId)` is tenant-scoped

**OWASP A03 (Injection):**
- All DB queries use Drizzle's parameterized API — no string interpolation
- `parseScopeLines` operates on string input but produces structured TypeScript objects — no SQL, no shell commands
- `pricingMarkdown` is output of `computePricingEstimate` (pure function) — no user-controlled string interpolated into SQL

---

## Performance Considerations

**NFR-001 — 60s ceiling:**
Steps 2–6 run in parallel. Each is a lightweight DB query or the F7 retrieval call. The dominant latency is step 8 (LLM generation, typically 15–30s). Parallel steps add ~2–5s for the slowest of steps 2–6 rather than ~15s total if sequential. Comfortable within the 60s budget.

**No new LLM calls added:**
- `parseScopeLines` is pure TypeScript — 0ms
- Coverage stub is pure TypeScript — 0ms
- Template injection is string concatenation — 0ms

---

## Testing Strategy

### Unit tests (scope-line-parser, proposal-draft, proposal-writer)
- Pure functions: no mocking needed for scope-line-parser
- `proposal-draft.ts` extension: minimal mock update (db.update chain)
- `proposal-writer.ts`: mock `generateText` (existing pattern), verify new input structure and prompt content

### Integration tests (generate-proposal)
- Mock: `db`, `writeProposal`, `updateDraftContent`, `searchByRequirements`, `fetchTypedSupplierContext`, `fetchCustomerContext`, `fetchLearnings`, `getRateCard`, `parseScopeLines`, `computePricingEstimate`
- Pattern: extend existing `mockSelectSequence` helper or replace with simpler per-step mock
- Critical assertions:
  1. Step execution order (via `step.run` call sequence)
  2. Template content verbatim in final output (string equality)
  3. `updateDraftContent` called with 4-arg signature including CoverageReport
  4. Rate card values NOT present in `writeProposal` call (only `pricingMarkdown`)

### Coverage target
- `scope-line-parser.ts`: 100% (pure function, exhaustive unit tests)
- `generate-proposal.ts` (via integration test): ≥80% branch coverage
- `proposal-writer.ts`: ≥80%

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Scope line parser too fragile for real-world answers | Medium | Failure → empty array → placeholder path. Never throws. Preparer sees placeholder and can note scope manually. |
| Inngest parallel steps cause unexpected ordering | Low | Steps 2–6 have no inter-dependencies; results collected into named variables via destructuring. |
| `writeProposal` prompt too long (context window limit) | Low | Rich context blocks are capped: 10 requirement results (F7 cap), supplier context from DB (typically small), learnings (DB result, typically <20 rows). |
| Template injection produces malformed markdown | Low | `renderTemplatesBlock` returns a string constant prefix + template bodies. Tested with fixture content. |
| Existing `generate-proposal.test.ts` mocks conflict with new mocks | Medium | Test file is fully rewritten as part of Phase 4 — existing mock structure is replaced entirely. |

---

## Constitutional Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Tenant Isolation | Compliant | Every query/call scoped by organizationId |
| II. Type Safety | Compliant | All new interfaces use existing exported types; no `any` |
| III. Explicit Over Implicit | Compliant | Pricing explicitly computed; templates explicitly injected; coverage explicitly stored |
| IV. Secure by Default | Compliant | Rate values excluded from LLM prompt; template content excluded from LLM prompt |
| V. 80% Coverage | Compliant | Integration test covers all 11 steps; unit tests cover scope-line-parser 100% |
| VI. Test the Agents | Compliant | `writeProposal` unit-tested with new interface |
| VII. Integration Tests for Workflows | Compliant | Full pipeline integration test required (Phase 4 is TDD gate) |
| XVI. Graceful Degradation | Compliant | Every step has a catch path returning empty/null; generation never fails due to missing optional context |

---

## Next Steps After This Plan

1. Run `/speckit-tasks` to generate executable task breakdown
2. Run `/speckit-analyze` to validate consistency
3. Implement via TDD (Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5)
4. Run `pnpm vitest run` to verify 80% coverage threshold maintained
5. Commit: `feat: revised proposal pipeline — 11-step bid-ready generation`
