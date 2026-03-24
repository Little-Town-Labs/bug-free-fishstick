# Technology Research: KB-Driven Draft Intelligence

## Decision 1: Per-Field Search Strategy

**Context:** Pipeline 1 currently searches KB once using the RFP name. We need per-field search.

**Options Considered:**
1. **Call `searchSimilar` per field** — Reuse existing function, N separate embedding + query calls
2. **Extend `searchByRequirements`** — Add `customerId` param, batch embeddings, reuse for both pipelines
3. **New dedicated function** — Build from scratch with batching and customer scoping

**Chosen:** Option 2 — Extend `searchByRequirements`
**Rationale:** `searchByRequirements` already handles per-field fan-out, deduplication, and cap logic. Two gaps to fill: add `customerId` parameter for customer-scoped union filter, and switch from individual `generateEmbedding` calls to batch `generateEmbeddings` to cut API round-trips. Both pipelines can then use the same function.
**Tradeoffs:** Modifying existing function means Pipeline 2 behavior changes slightly (now supports customer filtering), but this is a strict improvement.

## Decision 2: Customer KB Boost Mechanism

**Context:** Customer-specific entries need to rank higher than org-wide entries.

**Options Considered:**
1. **Score multiplier** — Apply 1.3x to customer entries post-query
2. **Separate priority tier** — Always rank customer entries above org-wide
3. **Dual-pass search** — Separate queries for customer and org, merge

**Chosen:** Option 1 — Score multiplier (1.3x)
**Rationale:** Simple post-processing after query results return. Preserves relevance ranking — a highly relevant org doc still beats a weakly relevant customer doc. No additional DB queries needed.
**Tradeoffs:** The multiplier value (1.3x) is a tuning parameter that may need adjustment based on real usage.

## Decision 3: RFP Metadata Storage

**Context:** Need to store extracted title, issuing org, dates from inbound RFP.

**Options Considered:**
1. **Extend `parsedStructure` JSONB** — Add new keys, no migration
2. **New `extractedMetadata` JSONB column** — Clean separation, 1-line migration
3. **Auto-populate existing columns** — `dueDate`, `customerCompanyName`, etc. already exist on rfps table

**Chosen:** Option 3 (primary) + Option 2 (supplemental)
**Rationale:** The `rfps` table already has `dueDate`, `customerCompanyName`, `customerContactName`, `customerContactInfo` columns that are currently user-filled. Auto-populating these from document analysis fills them only when null (user data takes precedence). For metadata not covered by existing columns (extracted title, RFP reference number, issuing organization), add a lightweight `extractedMetadata` JSONB column.
**Tradeoffs:** One small migration needed. Auto-populate logic must respect user-entered values (don't overwrite).

## Decision 4: KB Pre-Fill for Clarifying Questions

**Context:** Need to check KB before generating questions and pre-fill answers.

**Options Considered:**
1. **Pre-search KB, inject context into LLM prompt** — Tell the LLM what KB covers so it asks fewer questions
2. **Post-generate match** — Generate all questions, then search KB per-question and attach suggestions
3. **Hybrid** — Both: give LLM KB context AND post-process to attach suggestions

**Chosen:** Option 3 — Hybrid
**Rationale:** The LLM already receives `knowledgeTopics` and `contentLibraryCategories` (currently empty arrays) to avoid asking about known topics. Populating these reduces redundant questions at generation time. Post-generation KB search per-question attaches concrete `suggestedAnswer` text to remaining questions. Belt-and-suspenders approach.
**Tradeoffs:** Two search passes (pre-generation topics + post-generation suggestions) add latency, but each is small (topics = simple DB query, suggestions = embedding search for 1-7 questions).

## Decision 5: ClarifyingQuestion Schema Extension

**Context:** Need to store KB pre-fill data alongside questions.

**Options Considered:**
1. **Extend TypeScript interface only** — JSONB column, no migration needed
2. **New DB column for suggestions** — Separate storage
3. **External lookup table** — Normalize suggestions into their own table

**Chosen:** Option 1 — Extend TypeScript interface
**Rationale:** `clarifyingQuestions` is already a JSONB column. Adding optional fields (`suggestedAnswer`, `kbSourceTitle`, `suggestionConfidence`) to the TypeScript interface is fully backward-compatible. No migration, no schema change, no data loss for existing drafts.
**Tradeoffs:** JSONB lacks schema enforcement at DB level, but Zod validation at API boundary provides equivalent safety.

## Decision 6: Embedding Batching

**Context:** Per-field search generates many embedding API calls.

**Options Considered:**
1. **Individual calls** — Current approach, simple but N round-trips
2. **Batch `generateEmbeddings`** — Already exists in codebase, one API call for all texts

**Chosen:** Option 2 — Batch embeddings
**Rationale:** `generateEmbeddings` already uses Vercel AI SDK `embedMany()`. For 20 fields, this reduces 20 API round-trips to 1. Significant latency improvement.
**Tradeoffs:** One large API call vs many small ones — if the batch call fails, all embeddings fail. Acceptable since we already have graceful degradation.
