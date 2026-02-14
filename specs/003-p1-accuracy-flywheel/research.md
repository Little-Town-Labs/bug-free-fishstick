# Research: P1 — Accuracy Flywheel

## R1: Customer-Specific System Prompts

**Decision**: Inject customer settings into the response generator's system prompt via a template string. No separate agent per customer.

**Rationale**: Creating separate AI agents per customer adds orchestration complexity with minimal benefit. A template-based approach (interpolating `preferredTone`, `industryContext`, `customInstructions` into the system prompt) achieves the same personalization. The existing `generateResponses()` function already accepts structured input — we add a `customerContext` field.

**Alternatives Considered**:
- Fine-tuning per customer: Too expensive, slow iteration, requires significant data volume
- Separate agent config per customer: Over-engineered; same model, just different prompts
- RAG-only approach (no prompt changes): Misses tone/style preferences that RAG can't capture

## R2: Learning Capture Architecture

**Decision**: Use Inngest events for all learning capture (accept/edit/reject). Fire-and-forget from API routes.

**Rationale**: The existing `captureCorrection()` service writes directly to DB. For real-time learning from UI actions, we need non-blocking capture. Inngest events are already the pattern for async work. New event: `rfp/capture-learning` with payload `{ type, rfpId, fieldId, organizationId, customerId, data }`.

**Alternatives Considered**:
- Direct DB writes from API routes: Adds latency to user actions (~50-100ms)
- Client-side batching: Complex, unreliable if user closes tab
- Background queue (Bull/BullMQ): Adds a dependency; Inngest already handles this

**Key Insight**: Edit actions should be debounced server-side. The API already has a PUT endpoint for responses (`/api/rfps/${rfpId}/responses/${fieldId}`). We add a learning event send after successful save, only when the response was previously AI-generated (`auto_filled` → `manually_filled`).

## R3: RFP Classification Approach

**Decision**: Add a classification step to the existing `process-rfp` Inngest function, between document analysis (step 4) and response generation (step 5). Uses the same LLM with a classification prompt.

**Rationale**: Classification needs the parsed document structure and extracted fields — both available after step 4. Running it as a separate Inngest step within the same function avoids a second job and keeps the pipeline linear. The LLM outputs a structured JSON (Zod-validated) with type, complexity, industry tags.

**Schema Changes**:
```
rfps table additions:
  - rfpType: text (nullable) — 'technical' | 'commercial' | 'compliance' | 'mixed'
  - complexity: text (nullable) — 'simple' | 'medium' | 'complex'
  - industryTags: jsonb (nullable) — string[]
  - suggestedAssigneeId: text (nullable) — FK to users
```

**Assignee Suggestion Algorithm**:
1. Find org members with `admin` or `member` role
2. Score each by: (a) count of past RFPs with same type, (b) inverse of current in-progress RFP count
3. Return top suggestion; null if no clear winner

**Alternatives Considered**:
- Separate classification service: Extra HTTP hop, no benefit
- Rule-based classification: Too brittle, can't handle varied RFP formats
- Client-side classification: Requires document access on client, slow

## R4: Content Library Embeddings

**Decision**: Add `embedding` vector column to `proposalContentLibrary` table. Reuse existing `generateEmbedding()` from `src/lib/ai/embeddings.ts`. Add batch migration Inngest function.

**Rationale**: The knowledge entries system already has this exact pattern (embedding column + async generation + vector search). We replicate it for content library entries.

**Migration Strategy**:
1. Add nullable `embedding` column via Drizzle migration
2. Create Inngest function `content-library/generate-embeddings` (processes one entry)
3. Create Inngest function `content-library/batch-embed` (fans out to per-entry jobs)
4. On content library create/update, send embedding event (same as KB upload pattern)
5. During proposal generation, use vector search if embeddings exist, fall back to category filter

**Alternatives Considered**:
- Separate embeddings table: Adds join complexity, no benefit
- Inline embedding at write time: Blocks the API response
- External embedding service: Adds dependency; current OpenAI embeddings work fine

## R5: Document Chunking Strategy

**Decision**: Heading-based chunking with paragraph fallback. Max chunk size: 1500 tokens. Overlap: 200 tokens between chunks.

**Rationale**: RFP-related documents (policies, past proposals, technical specs) are typically structured with headings. Heading-based splitting preserves semantic coherence better than fixed-size windows. For unstructured documents, fall back to paragraph splitting. Each chunk gets its own knowledge entry with source metadata.

**Chunking Algorithm**:
1. Parse document to text (existing `parsePdf`/`parseWord`)
2. Split by headings (H1-H3) if detected
3. If no headings or chunks > 1500 tokens, split by paragraphs (double newline)
4. If paragraphs still > 1500 tokens, split at sentence boundaries
5. Add 200-token overlap between adjacent chunks for context continuity
6. Tag each chunk with: `{ sourceFile, chunkIndex, totalChunks, sectionHeading?, pageNumber? }`

**Auto-Tagging**: Run a lightweight LLM call per chunk to extract up to 5 topic tags. Batch this with the embedding generation to minimize LLM calls.

**Alternatives Considered**:
- Fixed-size chunking (e.g., 512 tokens): Splits mid-sentence, loses context
- Recursive character splitting (LangChain style): Over-engineered for our document types
- No chunking (embed full document): Poor retrieval quality for long documents — current behavior

## R6: Dependencies & New Packages

**Decision**: No new npm packages needed.

**Rationale**:
- Embeddings: Already have `@ai-sdk/openai` for `text-embedding-ada-002`
- PDF/DOCX parsing: Already have in `src/lib/document-parser.ts`
- Vector search: Already have pgvector + Drizzle
- Chunking: Implement in-house (~100 lines of string splitting)
- Classification: Use existing AI SDK + Zod for structured output

## R7: Performance Considerations

**Learning Capture**: All events are fire-and-forget via Inngest. No user-visible latency increase.

**Classification**: Adds one LLM call (~1-2s) to the process-rfp pipeline. Since this already takes 10-30s, classification adds <10% overhead. Runs as a pipeline step, not blocking.

**Content Library Search**: Vector search on content library is O(n) with pgvector but n is small (typically <1000 entries per org). Sub-100ms query time expected.

**Document Chunking**: Chunking is CPU-bound (string splitting). Even 200-page documents chunk in <1s. Embedding generation is the bottleneck but runs async via Inngest fan-out.
