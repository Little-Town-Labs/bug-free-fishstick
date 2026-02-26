# Technology Research: F7 — Requirement-Driven Retrieval

## Decision 1: Concurrency Strategy for Per-Requirement Embedding Calls

**Context:**
`searchByRequirements` must fire up to 10 independent embedding API calls and 10 independent database
queries. The choice of sequential vs concurrent execution has a direct impact on latency under load.

**Options Considered:**

1. **`Promise.allSettled` with per-item try/catch** — fire all embedding calls concurrently, collect
   resolved and rejected results independently, treat rejected slots as empty.
2. **Sequential `for…await` loop** — iterate over requirement fields one at a time; simpler but
   additive latency (~300–600ms/call × 10 = 3–6 s at worst).
3. **`Promise.all` with outer catch** — one rejection aborts all in-flight promises, contradicting
   US-005 (single query failure must not abort the rest).

**Chosen:** `Promise.allSettled`

**Rationale:**
- Satisfies FR-019 (individual embedding failure → that requirement contributes no results; others
  continue).
- Satisfies NFR-002 (API calls are concurrent, not sequential, keeping total API time bounded by the
  slowest single call rather than the sum).
- `Promise.allSettled` is native in Node 18+ (no extra dependency).
- `Promise.all` is eliminated because one network error would cancel all concurrent requests.
- Sequential loop is eliminated because it would multiply latency by the number of requirements.

**Tradeoffs:** Concurrent embedding calls briefly saturate the single OpenAI connection; at max 10
parallel calls against `text-embedding-ada-002` this is well within rate limits (3,000 RPM on Tier 1).

---

## Decision 2: Deduplication Approach for Multi-Query Results

**Context:**
Multiple requirement queries may return the same knowledge entry (e.g., a company certification
matches both a compliance question and a technical capability question). The spec mandates that the
highest-similarity copy is retained (FR-004).

**Options Considered:**

1. **`Map<string, KnowledgeEntryWithSimilarity>` keyed by entry ID** — O(1) per entry; update only
   when incoming similarity is higher. Final output is `Array.from(map.values())`.
2. **Sort + `Array.reduce` deduplication** — sort all results by similarity descending, then reduce
   keeping first occurrence of each ID. Equivalent correctness; slightly more code.
3. **SQL `DISTINCT ON (id)` with `ORDER BY similarity DESC`** — would require a SQL-level merge of
   all per-requirement result sets, not feasible in Drizzle without raw SQL.

**Chosen:** `Map<string, KnowledgeEntryWithSimilarity>` keyed by entry ID.

**Rationale:**
- Single-pass, O(n) where n = total results across all queries (max 10 queries × 5 results = 50
  candidates).
- Directly models the spec's "highest similarity wins" rule: update the map entry only when the
  incoming similarity is strictly higher.
- No raw SQL required; all merging happens in application code.
- Consistent with the existing `vector-search.ts` pattern which also processes results in
  application code.

**Tradeoffs:** All per-requirement result sets must fit in memory simultaneously; at max 50 entries
this is negligible.

---

## Decision 3: Tag Overlap Filter Implementation for `wonPastRfps`

**Context:**
FR-008 requires that when `industryTags` is a non-empty array, the `past_rfp` query filters
knowledge entries to those whose `tags` JSONB field contains at least one matching tag.
`knowledge_entries.tags` is a `jsonb` column typed as `string[]`.

**Options Considered:**

1. **Postgres `?|` (jsonb contains-any-key) operator via `sql` template** — single DB operation;
   pushes filter to the DB engine.
2. **Postgres `&&` array overlap via `sql` template** — requires casting JSONB to `text[]`; works
   but less idiomatic for JSONB.
3. **Application-side filter** — fetch all won `past_rfp` entries then filter in JS. Simple but
   fetches unnecessary rows; violates NFR-001 (sub-500ms goal).

**Chosen:** Postgres `?|` operator via Drizzle `sql` template literal.

**Rationale:**
- `?|` (any-key exists) on a JSONB array column checks whether any of the provided keys/values
  exist; for a `string[]`-typed JSONB column, tags stored as JSON array strings are checked in one
  DB round-trip.
- Consistent with the existing `vector-search.ts` pattern of using `sql<T>\`...\`` for
  pgvector-specific operators.
- Application-side filtering rejected because it over-fetches and cannot use the index.
- `&&` array overlap requires `CAST(tags AS text[])` which is fragile if the JSONB structure varies.

**Tradeoffs:** The `?|` operator on JSONB is slightly less well-known; behaviour is documented in
the plan and in inline code comments. The spec also documents this resolution (edge-case §Industry
Tag Comparison).

**Note on `outcome = 'won'` for `past_rfp` entries:**
`knowledge_entries` has no dedicated `outcome` column. The `past_rfp` type entries represent
uploaded past-proposal documents; their "won" status must be stored in the `metadata` JSONB field
(`metadata.outcome = 'won'`). The query filter uses
`sql\`${knowledgeEntries.metadata}->>'outcome' = 'won'\``. This is the only path consistent with
the existing schema — adding a top-level `outcome` column to `knowledge_entries` would require a
migration, which the spec explicitly excludes. This decision is documented here and referenced in
`plan.md`.

---

## Decision 4: Module Organisation — Single File vs Split Files

**Context:**
The module exports exactly four functions (FR-018). Each function has a different primary dependency
(embedding API vs pure DB). Options exist for splitting by function type.

**Options Considered:**

1. **Single file `src/lib/services/proposal-retrieval.ts`** — all four functions in one module;
   simple import surface for F8.
2. **Split into `retrieval-semantic.ts` and `retrieval-db.ts`** — separates embedding-dependent
   code from pure DB reads; cleaner unit testing.
3. **Re-export barrel `index.ts`** — split implementation files, single import path.

**Chosen:** Single file `src/lib/services/proposal-retrieval.ts`.

**Rationale:**
- The spec explicitly names one file (FR-018 export contract).
- Four functions and their types fit within the project's 800-line file limit.
- F8 imports from one path, reducing dependency surface.
- Unit tests can still mock `generateEmbedding` and `db` at the module level without needing split
  files.

**Tradeoffs:** If the module grows significantly beyond F7 scope, it should be refactored in a
future feature.

---

## Decision 5: Exported Type Design

**Context:**
NFR-003 mandates all types are exported for F8 consumption. The types for input and output of each
function must be defined without `any`.

**Approach:**
- Reuse `KnowledgeEntryWithSimilarity` from `vector-search.ts` (already typed, already exported).
- `KnowledgeEntry` from `knowledge-entries` schema — used for non-similarity typed context results.
- `Customer['settings']` from customers schema — used as the return type for `fetchCustomerContext`.
- `Learning` from learnings schema — used for `fetchLearnings` return.
- New exported interfaces: `TypedSupplierContext`, `CustomerContext`, `RequirementField`.

**Rationale:** Reusing existing Drizzle-inferred types is preferred over redefining them (Constitution
Principle II: Type Safety; Principle III: Explicit over Implicit).
