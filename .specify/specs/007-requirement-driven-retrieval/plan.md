# Implementation Plan: F7 — Requirement-Driven Retrieval

**Feature ID:** F7
**Spec:** `.specify/specs/007-requirement-driven-retrieval/spec.md`
**Branch:** `main` (no feature branch; this feature is small, self-contained, and blocks F8)
**Depends on:** F1 (`001-data-model-foundation`) — schema and indexes must be present
**Blocks:** F8 (`008-revised-proposal-pipeline`)

---

## Executive Summary

The current proposal pipeline issues a single vector search against the RFP name, producing
undifferentiated context that does not map to individual requirements. F7 replaces this with a
dedicated, standalone read-only service module (`src/lib/services/proposal-retrieval.ts`) that
exports four focused retrieval functions:

| Function | Strategy | Embedding calls? |
|---|---|---|
| `searchByRequirements` | Per-requirement semantic search | Yes (1 per field, capped at 10) |
| `fetchTypedSupplierContext` | Direct DB queries filtered by type | No |
| `fetchCustomerContext` | Single row lookup by customerId + orgId | No |
| `fetchLearnings` | Ordered DB query with customer-first sort | No |

No new tables, columns, or migrations are required. The module is pure application-layer code that
queries three existing tables. It is fully testable in isolation via mocked DB and embedding
dependencies.

---

## Architecture Overview

```
F8 Pipeline (caller)
     │
     ├── searchByRequirements(fields, orgId, openaiKey)
     │         │
     │         ├── [fields slice to cap: 10]
     │         ├── Promise.allSettled([
     │         │     generateEmbedding(field.question) → pgvector similarity query
     │         │     ... (one per field)
     │         │   ])
     │         └── Map<id, entry> deduplication → KnowledgeEntryWithSimilarity[]
     │
     ├── fetchTypedSupplierContext(orgId, industryTags, rfpType, openaiKey)
     │         │
     │         ├── query: type = 'company_doc'               → companyDocs[]
     │         ├── query: type = 'certification'             → certifications[]
     │         ├── query: type = 'case_study'                → caseStudies[]
     │         └── query: type = 'past_rfp'
     │                   + metadata->>'outcome' = 'won'
     │                   [+ tags ?| industryTags if non-empty] → wonPastRfps[]
     │
     ├── fetchCustomerContext(customerId, orgId)
     │         └── SELECT settings FROM customers
     │               WHERE id = $1 AND organization_id = $2 LIMIT 1
     │                 → CustomerContext | null
     │
     └── fetchLearnings(orgId, customerId?)
               └── SELECT * FROM learnings
                     WHERE organization_id = $1
                     [AND (customer_id = $2 OR customer_id IS NULL)]
                     ORDER BY CASE WHEN customer_id = $2 THEN 0 ELSE 1 END ASC
                       → Learning[]
```

### Dependencies

```
src/lib/services/proposal-retrieval.ts
  imports:
    ├── @/lib/db                          (Drizzle db instance)
    ├── @/lib/db/schema/knowledge-entries (knowledgeEntries table, KnowledgeEntry type)
    ├── @/lib/db/schema/customers         (customers table, Customer type)
    ├── @/lib/db/schema/learnings         (learnings table, Learning type)
    ├── @/lib/ai/embeddings               (generateEmbedding)
    ├── @/lib/services/vector-search      (KnowledgeEntryWithSimilarity type only)
    └── drizzle-orm                       (eq, and, or, isNull, isNotNull, sql, desc, asc)
```

No circular dependencies. No new third-party packages required.

---

## Technology Stack

All technology choices inherit from the existing stack. No new dependencies are introduced.

| Concern | Choice | Rationale |
|---|---|---|
| Database ORM | Drizzle ORM (existing) | Consistent with entire codebase; type-safe queries |
| Vector search | pgvector via existing `generateEmbedding` + `sql` template | Reuse established pattern from `vector-search.ts` |
| Embedding model | `text-embedding-ada-002` via `@ai-sdk/openai` (existing) | Already configured in `src/lib/ai/embeddings.ts` |
| Concurrency | `Promise.allSettled` (Node 18+ native) | No extra dependency; correct failure isolation |
| Deduplication | In-memory `Map<string, KnowledgeEntryWithSimilarity>` | O(n), max 50 candidates, no SQL complexity |
| Tag overlap filter | Postgres `?|` JSONB operator via `sql` template | Pushes filter to DB, avoids over-fetching |
| Test framework | Vitest (existing) | Consistent with project test setup |
| Test mocking | `vi.mock` for `@/lib/db` and `@/lib/ai/embeddings` | Standard Vitest module mocking |

---

## Technical Decisions

### TD-001: `outcome = 'won'` Filter for `past_rfp` Entries

**Context:** `knowledge_entries` has no top-level `outcome` column. The spec requires filtering
`past_rfp` entries to those representing won proposals.

**Decision:** Filter using `sql\`${knowledgeEntries.metadata}->>'outcome' = 'won'\`` on the
existing `metadata` JSONB column.

**Rationale:** Adding a migration to add an `outcome` column is explicitly excluded by the spec
("No new schema migration needed"). The `metadata` JSONB column (`metadata.$type<{...}>()`) already
accepts arbitrary key-value pairs. The JSONB text-extraction operator `->>'outcome'` is standard
PostgreSQL, supported without any schema change. Ingestion of `past_rfp` entries must set
`metadata.outcome = 'won'` at upload time (responsibility of the knowledge upload flow, not F7).

**Tradeoff:** The convention is implicit and not enforced by a DB constraint. A `past_rfp` entry
uploaded without `metadata.outcome = 'won'` will be silently excluded from `wonPastRfps`. This is
the correct behaviour per the spec and is documented here.

---

### TD-002: Concurrency Model — `Promise.allSettled`

**Context:** Up to 10 independent embedding calls must run concurrently. A single failure must not
abort the remaining calls.

**Decision:** Use `Promise.allSettled(fields.slice(0, REQUIREMENT_SEARCH_CAP).map(async (field) => { ... }))`.
Each settled result is checked: `status === 'fulfilled'` → add results to accumulator;
`status === 'rejected'` → skip, log at debug level.

**Rationale:** `Promise.all` rejects on first failure, violating US-005. Sequential iteration
multiplies latency. `Promise.allSettled` is the only primitive that satisfies both concurrency and
graceful degradation.

---

### TD-003: Module-Level Constants

**Decision:** Define two module-level constants at the top of `proposal-retrieval.ts`:
```typescript
const REQUIREMENT_SEARCH_CAP = 10
const RESULTS_PER_REQUIREMENT = 5
```

**Rationale:** FR-020 explicitly requires the cap to be a named constant (not a magic number).
Having both constants together makes the cost/volume trade-off explicit and easy to adjust.

---

### TD-004: Tag Overlap SQL Strategy

**Decision:**
```typescript
// When industryTags is non-empty:
sql`${knowledgeEntries.tags}::jsonb ?| ${sql.raw(`ARRAY[${industryTags.map(() => '?').join(',')}]`)}`
```

Alternatively, use Drizzle's `sql` template with `arrayContains`-style or raw `?|` operator.
Since Drizzle does not have built-in JSONB `?|` support, the implementation uses:
```typescript
sql`${knowledgeEntries.tags} ?| array[${sql.join(industryTags.map(t => sql`${t}`), sql`, `)}]`
```

**Rationale:** The `?|` operator checks whether any of the provided string values exist as keys
(or array elements) in the JSONB value. For a JSONB column storing a `string[]`, this correctly
implements "any tag from the provided list matches any tag in the entry's tags".

**Tradeoff:** Using raw `sql` template means Drizzle cannot type-check the operator arguments.
The implementation must have a unit test verifying the filter behaviour with mock data.

---

### TD-005: `fetchCustomerContext` Return on Null Settings

**Decision:** When a customer row is found but `settings` is `null` (no settings configured),
return `null` — not an empty object. The `CustomerContext` type is `Customer['settings'] | null`,
which allows `null` when settings are absent.

**Rationale:** The spec (US-003 AC) says "returned with all optional fields absent" which can be
modelled as returning the `null` settings value directly rather than constructing an empty object.
This is simpler and consistent with the Drizzle-inferred `settings` type which is nullable.

**Spec/Plan alignment note:** spec US-003 AC states "customer context object is returned with all
optional fields absent (not an error)" — this is equivalent to returning `null` because the
`settings` column stores a JSONB object where all fields are optional. A null JSONB column means
no settings object exists at all, which satisfies "all optional fields absent". F8 callers must
treat a `null` `CustomerContext` return as "no customer preferences configured" and proceed with
default tone/style rather than erroring. The contract YAML documents this behaviour in the
`fetchCustomerContext` path description.

---

## Implementation Phases

### Phase 1: Module Skeleton and Types

**Goal:** Create the file, define all exported types and module constants. No implementation bodies.

**Files:**
- `src/lib/services/proposal-retrieval.ts` — create with type definitions and empty function stubs

**Tasks:**
1. Create `proposal-retrieval.ts` with:
   - Module constants: `REQUIREMENT_SEARCH_CAP`, `RESULTS_PER_REQUIREMENT`
   - Type exports: `RequirementField`, `TypedSupplierContext`, `CustomerContext` (re-export `Learning` from schema)
   - Re-export `KnowledgeEntryWithSimilarity` from `vector-search.ts`
   - Four `async function` stubs with correct signatures and `// TODO` bodies returning empty values

**Verification:** TypeScript compilation passes (`tsc --noEmit`).

---

### Phase 2: Test Suite (TDD — write tests before implementation)

**Goal:** Write all required unit tests (covering every acceptance criterion and edge case from
the spec's test coverage section). Tests fail until Phase 3 implementation.

**Files:**
- `tests/unit/services/proposal-retrieval.test.ts` — new test file

**Test structure:**

```
describe('searchByRequirements')
  - empty fields array → returns [], no embedding calls
  - single field → one embedding call, results returned
  - multiple fields → one call per field, up to cap
  - fields count > REQUIREMENT_SEARCH_CAP → only first N fields queried
  - duplicate entry IDs → deduplicated, highest similarity retained
  - same entry returned by two queries → higher score kept
  - OpenAI key absent → returns [] without throwing
  - single embedding call rejects → other queries continue

describe('fetchTypedSupplierContext')
  - returns four distinct groups populated from correctly-typed entries
  - past_rfp entries with outcome='won' in metadata → included in wonPastRfps
  - past_rfp entries with outcome='lost' or absent → excluded from wonPastRfps
  - company_doc entries never appear in other groups
  - non-empty industryTags → only entries with tag overlap returned
  - null/empty industryTags → all won past_rfp entries returned
  - empty knowledge base → all four groups return []

describe('fetchCustomerContext')
  - customer with settings → returns settings object
  - customer with null settings → returns null
  - customer ID not found → returns null
  - customer exists in different org → returns null (tenant isolation)

describe('fetchLearnings')
  - customer-specific learnings ordered before org-wide when customerId provided
  - only org-wide learnings returned when customerId not provided
  - no learnings → returns []
  - learnings from other orgs never included
```

**Mocking strategy:**
- `vi.mock('@/lib/db', () => ({ db: { select: vi.fn() ... } }))` — mock Drizzle query builder chain
- `vi.mock('@/lib/ai/embeddings', () => ({ generateEmbedding: vi.fn() }))` — mock embedding calls
- Use `vi.fn()` chain builders to simulate `.select().from().where().limit()` returning controlled
  fixture data

**Fixtures:**
- Create minimal `KnowledgeEntry` fixture objects with varied `type`, `tags`, and `metadata` fields
- Create `Learning` fixture objects with and without `customerId`
- Create `Customer` fixture with and without `settings`

**Verification:** Run `pnpm test tests/unit/services/proposal-retrieval.test.ts` — all tests should
FAIL (RED state) because stubs return empty values.

---

### Phase 3: Implementation

**Goal:** Implement all four functions to make Phase 2 tests pass.

**File:** `src/lib/services/proposal-retrieval.ts`

#### `searchByRequirements` implementation outline:

```typescript
export async function searchByRequirements(
  fields: RequirementField[],
  orgId: string,
  openaiApiKey?: string
): Promise<KnowledgeEntryWithSimilarity[]> {
  if (!fields.length) return []
  if (!openaiApiKey && !process.env.OPENAI_API_KEY) return []

  const cappedFields = fields.slice(0, REQUIREMENT_SEARCH_CAP)

  const settled = await Promise.allSettled(
    cappedFields.map(async (field) => {
      const embedding = await generateEmbedding(field.question, openaiApiKey)
      // NOTE: Use an explicit SELECT list that includes all KnowledgeEntry columns except
      // `embedding`, plus the similarity expression. Do NOT use the narrow select from
      // the existing searchSimilar function (which omits tags, chunkIndex, etc.).
      // The KnowledgeEntryWithSimilarity type includes `tags`, so the SELECT must too.
      return db
        .select({
          id: knowledgeEntries.id,
          organizationId: knowledgeEntries.organizationId,
          customerId: knowledgeEntries.customerId,
          type: knowledgeEntries.type,
          title: knowledgeEntries.title,
          content: knowledgeEntries.content,
          tags: knowledgeEntries.tags,
          metadata: knowledgeEntries.metadata,
          chunkIndex: knowledgeEntries.chunkIndex,
          totalChunks: knowledgeEntries.totalChunks,
          sectionHeading: knowledgeEntries.sectionHeading,
          sourceEntryId: knowledgeEntries.sourceEntryId,
          processingStatus: knowledgeEntries.processingStatus,
          createdAt: knowledgeEntries.createdAt,
          updatedAt: knowledgeEntries.updatedAt,
          similarity:
            sql<number>`1 - (${knowledgeEntries.embedding} <=> ${JSON.stringify(embedding)}::vector)`.as('similarity'),
        })
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.organizationId, orgId), isNotNull(knowledgeEntries.embedding)))
        .orderBy(sql`${knowledgeEntries.embedding} <=> ${JSON.stringify(embedding)}::vector`)
        .limit(RESULTS_PER_REQUIREMENT)
    })
  )

  const dedupeMap = new Map<string, KnowledgeEntryWithSimilarity>()
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    for (const entry of result.value) {
      const existing = dedupeMap.get(entry.id)
      if (!existing || entry.similarity > existing.similarity) {
        dedupeMap.set(entry.id, entry)
      }
    }
  }
  return Array.from(dedupeMap.values())
}
```

#### `fetchTypedSupplierContext` implementation outline:

```typescript
export async function fetchTypedSupplierContext(
  orgId: string,
  industryTags?: string[] | null,
  rfpType?: string | null,
  _openaiApiKey?: string   // accepted, not used
): Promise<TypedSupplierContext> {
  const orgFilter = eq(knowledgeEntries.organizationId, orgId)

  const [companyDocs, certifications, caseStudies, wonPastRfps] = await Promise.allSettled([
    db.select().from(knowledgeEntries)
      .where(and(orgFilter, eq(knowledgeEntries.type, 'company_doc'))),
    db.select().from(knowledgeEntries)
      .where(and(orgFilter, eq(knowledgeEntries.type, 'certification'))),
    db.select().from(knowledgeEntries)
      .where(and(orgFilter, eq(knowledgeEntries.type, 'case_study'))),
    buildWonPastRfpsQuery(orgId, industryTags),
  ])

  return {
    companyDocs:    companyDocs.status    === 'fulfilled' ? companyDocs.value    : [],
    certifications: certifications.status === 'fulfilled' ? certifications.value : [],
    caseStudies:    caseStudies.status    === 'fulfilled' ? caseStudies.value    : [],
    wonPastRfps:    wonPastRfps.status    === 'fulfilled' ? wonPastRfps.value    : [],
  }
}

function buildWonPastRfpsQuery(orgId: string, industryTags?: string[] | null) {
  const baseFilter = and(
    eq(knowledgeEntries.organizationId, orgId),
    eq(knowledgeEntries.type, 'past_rfp'),
    sql`${knowledgeEntries.metadata}->>'outcome' = 'won'`
  )
  const tagFilter =
    industryTags && industryTags.length > 0
      ? sql`${knowledgeEntries.tags} ?| array[${sql.join(
          industryTags.map((t) => sql`${t}`),
          sql`, `
        )}]`
      : undefined

  return db
    .select()
    .from(knowledgeEntries)
    .where(tagFilter ? and(baseFilter, tagFilter) : baseFilter)
}
```

#### `fetchCustomerContext` implementation outline:

```typescript
export async function fetchCustomerContext(
  customerId: string,
  orgId: string
): Promise<CustomerContext> {
  const [customer] = await db
    .select({ settings: customers.settings })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.organizationId, orgId)))
    .limit(1)

  return customer?.settings ?? null
}
```

#### `fetchLearnings` implementation outline:

```typescript
export async function fetchLearnings(
  orgId: string,
  customerId?: string
): Promise<Learning[]> {
  const customerFilter = customerId
    ? or(eq(learnings.customerId, customerId), isNull(learnings.customerId))
    : isNull(learnings.customerId)

  // Drizzle supports arbitrary sql<> expressions in .orderBy(). Embedding ASC in the
  // CASE expression is valid SQL and Drizzle 0.45+ passes it through as-is.
  const orderExpr = customerId
    ? sql`CASE WHEN ${learnings.customerId} = ${customerId} THEN 0 ELSE 1 END ASC`
    : undefined

  const query = db
    .select()
    .from(learnings)
    .where(and(eq(learnings.organizationId, orgId), customerFilter))

  return orderExpr ? query.orderBy(orderExpr) : query
}
```

**Verification:** Run `pnpm test tests/unit/services/proposal-retrieval.test.ts` — all tests should
PASS (GREEN state).

---

### Phase 4: Coverage Verification and Code Review

**Goal:** Verify 80%+ test coverage for the module; confirm TypeScript strict mode compliance.

**Tasks:**
1. Run `pnpm test --coverage` — verify `proposal-retrieval.ts` meets 80% threshold
2. Run `tsc --noEmit` — verify no TypeScript errors
3. Confirm no `any` types in the module or its test file
4. Confirm no `console.log` statements (NFR-005: no customer data in logs; `console.warn`/`debug`
   permitted for non-sensitive messages only)
5. Confirm all four exported function signatures are present and match the contract in
   `contracts/proposal-retrieval-api.yaml`

---

## Security Considerations

| Principle | Application to F7 |
|---|---|
| I. Tenant Isolation | Every DB query includes `AND organization_id = $orgId`. Verified by dedicated tenant-isolation unit tests for each function. |
| II. Type Safety | No `any`. All types derived from Drizzle schema inference or explicitly defined. Exported for F8. |
| III. Explicit Over Implicit | Function signatures explicitly accept `orgId` as a required parameter — tenant context is never inferred from request context or global state. |
| IV. Secure by Default | NFR-005: Customer settings values, learning content, and knowledge entry content are never logged. Module emits no log statements at INFO level or above. |

### OWASP Relevance

- **A01 Broken Access Control:** Mitigated by query-level `organizationId` enforcement. Tests verify
  cross-tenant isolation explicitly.
- **A03 Injection:** Drizzle parameterised queries used throughout. `sql` template literals bind
  values as parameters (not string concatenation). The `industryTags` array values are bound as
  individual parameters in `sql.join(...)`.
- **A09 Security Logging Failures:** NFR-005 compliance ensures no sensitive payload data enters
  logs. Non-sensitive structured logs (e.g., "cap exceeded, truncating to N") are permitted at
  debug level only.

---

## Performance Strategy

### Compliance with Constitution Principle XV (sub-500ms DB queries)

| Function | Expected latency | Index used |
|---|---|---|
| `searchByRequirements` per query | <200ms | pgvector HNSW/IVFFlat on `embedding` + `knowledge_org_idx` |
| `fetchTypedSupplierContext` per group | <50ms | `knowledge_org_idx` on `organization_id` |
| `fetchCustomerContext` | <10ms | Primary key lookup + `customers_org_idx` |
| `fetchLearnings` | <50ms | `learnings_org_idx` + `learnings_customer_idx` |

All four typed supplier context queries run concurrently via `Promise.allSettled`, so total wall
time for `fetchTypedSupplierContext` ≈ the single slowest group query, not the sum.

### API Cost Control

- `REQUIREMENT_SEARCH_CAP = 10` limits embedding API calls per invocation.
- `RESULTS_PER_REQUIREMENT = 5` limits per-query result set, controlling total working set size.
- `fetchTypedSupplierContext` uses zero embedding calls; its groups are bounded by the
  knowledge base size, not by API rate limits.

---

## Testing Strategy

**Framework:** Vitest with jsdom environment (existing project configuration).

**Coverage target:** 80% per Constitution Principle V, verified at module level.

**Test file:** `tests/unit/services/proposal-retrieval.test.ts`

**Mocking approach:**
- `generateEmbedding`: mocked via `vi.mock('@/lib/ai/embeddings')` to return controlled
  `number[]` vectors without network calls.
- `db` query chain: mocked via `vi.mock('@/lib/db')` using a chainable builder pattern
  where `.select().from().where().limit().orderBy()` returns a Promise resolving to fixture data.
  Each test configures the mock return value for the specific query under test.

**Fixture design:**
- `makeKnowledgeEntry(overrides)` — factory producing `KnowledgeEntry` with sensible defaults,
  accepting partial overrides for `type`, `tags`, `metadata`, `organizationId`.
- `makeLearning(overrides)` — factory for `Learning` with and without `customerId`.
- `makeCustomer(overrides)` — factory for `Customer` with configurable `settings`.

**Test categories:**
1. Happy path — correct data returned for each function
2. Empty state — all functions return defined empty values when DB has no rows
3. Graceful degradation — all embedding-dependent paths degrade when API key absent or call throws
4. Tenant isolation — cross-org data never leaks (explicitly verified with two-org fixture sets)
5. Edge cases — cap enforcement, deduplication correctness, tag filter with/without overlap

---

## Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `metadata->>'outcome'` convention not enforced at ingestion | Medium | Medium | Document convention in `data-model.md`; add comment in function; F8 or upload flow must set it |
| pgvector `?|` operator behaviour differs from application-side comparison | Low | Medium | Unit test with fixture data that verifies tag overlap semantics; integration test on real DB if available |
| Drizzle ORM `.orderBy(sql\`CASE WHEN...\`)` not supported in all Drizzle versions | Low | Low | Drizzle 0.45+ supports arbitrary `sql` in `orderBy`; version is pinned in project |
| F8 passes `fields` without `question` field | Low | Medium | `RequirementField` interface exported; TypeScript strict mode catches at compile time |
| `Promise.allSettled` resolves to `{status:'fulfilled', value: undefined}` if DB returns no rows | None | None | Drizzle `.select()` always returns an array (possibly empty); never undefined |

---

## Constitutional Compliance

| Principle | Status | Notes |
|---|---|---|
| I. Tenant Isolation | COMPLIANT | `organizationId` is a required WHERE predicate on all four functions. Verified by tests. |
| II. Type Safety | COMPLIANT | No `any`. All types derived from Drizzle inference or explicit interface definitions. |
| III. Explicit Over Implicit | COMPLIANT | `orgId` and `openaiApiKey` are explicit parameters. No ambient context used. |
| IV. Secure by Default | COMPLIANT | No customer content or learning text logged above debug level. |
| V. 80% Coverage | COMPLIANT | Full test suite defined in Phase 2; coverage verified in Phase 4. |
| VI. Test the Agents | N/A | This feature has no AI agents. |
| VII. Integration Tests for Workflows | DEFERRED | F8 will add integration tests for the full pipeline including F7. |
| VIII. Document Fidelity | N/A | No document output. |
| IX–XII. UX | N/A | No UI. |
| XIII. Sub-3s Parse | N/A | No document parsing. |
| XIV. Streaming | N/A | No streaming. |
| XV. Efficient Vector Search | COMPLIANT | Existing pgvector indexes used. Per-query target <200ms. |
| XVI. Graceful Degradation | COMPLIANT | All four functions return defined values under all failure conditions per US-005. |

---

## Deliverables Checklist

- [ ] `src/lib/services/proposal-retrieval.ts` — module with four exported functions and exported types
- [ ] `tests/unit/services/proposal-retrieval.test.ts` — full test suite (all scenarios from spec)
- [ ] TypeScript compilation passes with strict mode
- [ ] All unit tests pass
- [ ] Coverage ≥ 80% for the module
- [ ] No `any` types
- [ ] No `console.log` in module or test file
- [ ] All four function signatures match `contracts/proposal-retrieval-api.yaml`
