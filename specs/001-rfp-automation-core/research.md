# Research: RFP Automation Core Platform

**Feature**: 001-rfp-automation-core
**Date**: 2026-02-04

## Technology Decisions

### 1. Multi-Tenancy with Clerk Organizations

**Decision**: Use Clerk Organizations as the tenant model

**Rationale**:
- Organizations map directly to tenants (1:1 relationship)
- Built-in role management with customizable permissions
- Handles invitation flow, membership, and organization switching
- JWT includes `org_id` claim for easy tenant context extraction
- Webhook support for syncing organization data to Neon

**Implementation Pattern**:
```typescript
// Middleware extracts tenant context
import { auth } from "@clerk/nextjs/server";

export async function getTenantContext() {
  const { userId, orgId, orgRole } = await auth();
  if (!orgId) throw new Error("No organization context");
  return { userId, orgId, orgRole };
}

// All DB queries scoped by orgId
const rfps = await db.query.rfps.findMany({
  where: eq(rfps.organizationId, orgId)
});
```

**Role Mapping**:
| PRD Role | Clerk Role | Permissions |
|----------|------------|-------------|
| Super Admin | `org:super_admin` (custom) | Full access, tenant management |
| Admin | `org:admin` | Full tenant access, approve RFPs |
| User | `org:member` | Assigned RFPs only |

**Alternatives Considered**:
- Custom auth + tenant table: More control but significant development effort
- Auth0 Organizations: Similar feature but Clerk has better Next.js integration

---

### 2. Vector Search with pgvector on Neon

**Decision**: Use pgvector extension in Neon for semantic search

**Rationale**:
- Single database for both relational and vector data
- Native PostgreSQL, works with Drizzle ORM
- HNSW index for fast approximate nearest neighbor search
- Neon serverless scales automatically
- No need for separate vector database (Pinecone, etc.)

**Implementation Pattern**:
```typescript
// Drizzle schema with vector column
import { pgTable, text, vector } from "drizzle-orm/pg-core";

export const knowledgeEntries = pgTable("knowledge_entries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  customerId: text("customer_id").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI ada-002
});

// Create HNSW index for fast search
// In migration: CREATE INDEX ON knowledge_entries
//   USING hnsw (embedding vector_cosine_ops);

// Semantic search query
const results = await db.execute(sql`
  SELECT *, 1 - (embedding <=> ${queryEmbedding}::vector) as similarity
  FROM knowledge_entries
  WHERE organization_id = ${orgId}
    AND customer_id = ${customerId}
  ORDER BY embedding <=> ${queryEmbedding}::vector
  LIMIT 10
`);
```

**Performance Target**: <500ms for similarity search with 100k entries per tenant

**Alternatives Considered**:
- Pinecone: Dedicated vector DB but adds complexity and cost
- Supabase: Good alternative but Neon has better serverless characteristics
- Weaviate: Self-hosted, more operational overhead

---

### 3. Document Processing Pipeline

**Decision**: Use pdf-parse + pdf-lib for PDF, mammoth + docx for Word

**Rationale**:
- Pure JavaScript libraries work in Vercel serverless
- pdf-parse extracts text and structure
- pdf-lib allows overlay without modifying original
- mammoth reads Word to HTML/text
- docx library creates Word documents

**Implementation Pattern**:
```typescript
// PDF parsing
import pdfParse from "pdf-parse";
import { PDFDocument, rgb } from "pdf-lib";

async function parsePdf(buffer: Buffer) {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pages: data.numpages,
    // Extract form fields if present
    fields: extractFormFields(data),
  };
}

// PDF overlay output
async function createPdfWithOverlay(
  originalBuffer: Buffer,
  responses: Response[]
) {
  const pdfDoc = await PDFDocument.load(originalBuffer);

  for (const response of responses) {
    const page = pdfDoc.getPage(response.position.page);
    page.drawText(response.text, {
      x: response.position.x,
      y: response.position.y,
      size: response.position.fontSize,
    });
  }

  return pdfDoc.save();
}
```

**Challenges & Mitigations**:
- Complex layouts: Use heuristics to identify form fields by position
- Scanned PDFs: Defer OCR to future phase; flag as unsupported initially
- Large files: Process in chunks via Inngest steps

**Alternatives Considered**:
- PyMuPDF: Python-based, would require separate service
- Adobe PDF Services: Paid API, adds latency and cost
- pdf.js: Good for rendering, less suitable for extraction

---

### 4. AI Agent Orchestration with Inngest

**Decision**: Use Inngest for multi-step AI workflow orchestration

**Rationale**:
- Long-running workflows without timeout issues
- Built-in retries and error handling
- Step-based execution with durability
- Event-driven architecture
- Good observability and debugging
- Native Vercel integration

**Implementation Pattern**:
```typescript
import { inngest } from "@/lib/inngest/client";

export const processRfp = inngest.createFunction(
  { id: "process-rfp", retries: 3 },
  { event: "rfp/uploaded" },
  async ({ event, step }) => {
    const { rfpId, organizationId } = event.data;

    // Step 1: Parse document
    const parsed = await step.run("parse-document", async () => {
      const rfp = await getRfp(rfpId);
      return parseDocument(rfp.originalFile);
    });

    // Step 2: Extract fields
    const fields = await step.run("extract-fields", async () => {
      return extractFields(parsed);
    });

    // Step 3: Generate embeddings for questions (parallel)
    const embeddings = await step.run("generate-embeddings", async () => {
      return Promise.all(
        fields.map(f => generateEmbedding(f.question))
      );
    });

    // Step 4: Query knowledge base (parallel per field)
    const contexts = await step.run("query-knowledge", async () => {
      return Promise.all(
        fields.map((f, i) =>
          searchKnowledgeBase(organizationId, f.customerId, embeddings[i])
        )
      );
    });

    // Step 5: Generate AI responses (can be parallelized)
    const responses = await step.run("generate-responses", async () => {
      return generateResponses(fields, contexts);
    });

    // Step 6: Quality check and score
    const scored = await step.run("quality-check", async () => {
      return scoreResponses(responses);
    });

    // Step 7: Save results
    await step.run("save-results", async () => {
      return saveRfpResponses(rfpId, scored);
    });

    return { rfpId, completionRate: calculateCompletion(scored) };
  }
);
```

**Event Schema**:
| Event | Payload | Trigger |
|-------|---------|---------|
| `rfp/uploaded` | `{ rfpId, organizationId, customerId }` | New RFP upload |
| `rfp/processing.progress` | `{ rfpId, step, progress }` | Step completion |
| `rfp/processing.complete` | `{ rfpId, completionRate }` | All steps done |
| `knowledge/document.uploaded` | `{ entryId, organizationId }` | KB document added |

**Alternatives Considered**:
- Trigger.dev: Similar capabilities, chose Inngest for better streaming
- Temporal: More powerful but heavier, overkill for this use case
- Custom queue: More control but significant development effort

---

### 5. LLM Integration with Vercel AI SDK

**Decision**: Use Vercel AI SDK with multi-provider support

**Rationale**:
- Native Next.js integration
- Streaming responses out of the box
- Provider abstraction (OpenAI, Anthropic, Azure)
- Structured output support
- Tool calling for agent patterns

**Implementation Pattern**:
```typescript
import { generateText, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

// Provider factory based on tenant settings
function getProvider(tenant: Tenant) {
  switch (tenant.llmProvider) {
    case "claude":
      return anthropic("claude-sonnet-4-20250514");
    case "openai":
      return openai("gpt-4o");
    case "azure":
      return azure("gpt-4o"); // Azure OpenAI
    default:
      return anthropic("claude-sonnet-4-20250514");
  }
}

// Response generation with structured output
async function generateRfpResponse(
  field: RfpField,
  context: KnowledgeContext[],
  provider: LanguageModel
) {
  const { object } = await generateObject({
    model: provider,
    schema: z.object({
      response: z.string(),
      confidence: z.number().min(0).max(1),
      sources: z.array(z.string()),
    }),
    prompt: buildPrompt(field, context),
  });

  return object;
}

// Streaming for real-time UI updates
export async function POST(req: Request) {
  const { rfpId, fieldId } = await req.json();

  const result = streamText({
    model: getProvider(tenant),
    prompt: buildPrompt(field, context),
  });

  return result.toDataStreamResponse();
}
```

**Embedding Strategy**:
- Use OpenAI `text-embedding-3-small` (1536 dimensions)
- Batch embeddings for efficiency
- Cache embeddings in Vercel KV for repeated queries

**Alternatives Considered**:
- LangChain: More features but heavier; Vercel AI SDK sufficient
- Direct API calls: Less abstraction but more boilerplate
- Ollama/local: Not suitable for serverless deployment

---

### 6. File Storage with Vercel Blob

**Decision**: Use Vercel Blob for document storage

**Rationale**:
- Native Vercel integration
- Simple API for upload/download
- Supports files up to 500MB
- Automatic CDN distribution
- Pay-per-use pricing

**Implementation Pattern**:
```typescript
import { put, del, list } from "@vercel/blob";

// Upload with tenant-prefixed path
async function uploadRfpDocument(
  organizationId: string,
  rfpId: string,
  file: File
) {
  const path = `${organizationId}/rfps/${rfpId}/original.${getExtension(file)}`;

  const blob = await put(path, file, {
    access: "private",
    addRandomSuffix: false,
  });

  return blob.url;
}

// Download for processing
async function downloadDocument(url: string) {
  const response = await fetch(url);
  return response.arrayBuffer();
}

// List tenant documents
async function listTenantDocuments(organizationId: string) {
  const { blobs } = await list({
    prefix: `${organizationId}/`,
  });
  return blobs;
}
```

**Path Convention**:
```
{organizationId}/
├── rfps/
│   └── {rfpId}/
│       ├── original.pdf
│       └── completed.pdf
└── knowledge/
    └── {customerId}/
        └── {entryId}.pdf
```

**Alternatives Considered**:
- AWS S3: More features but adds complexity
- Cloudflare R2: Good pricing but less Vercel integration
- Uploadthing: Good DX but less control over paths

---

### 7. Caching with Vercel KV

**Decision**: Use Vercel KV (Redis) for caching and real-time state

**Rationale**:
- Fast key-value lookups
- Native Vercel integration
- Good for session data and processing status
- Supports TTL for automatic expiration

**Use Cases**:
```typescript
import { kv } from "@vercel/kv";

// Cache embedding results
async function getCachedEmbedding(text: string) {
  const key = `embedding:${hash(text)}`;
  const cached = await kv.get<number[]>(key);
  if (cached) return cached;

  const embedding = await generateEmbedding(text);
  await kv.set(key, embedding, { ex: 86400 }); // 24h TTL
  return embedding;
}

// Processing status for real-time UI
async function setProcessingStatus(rfpId: string, status: ProcessingStatus) {
  await kv.set(`rfp:${rfpId}:status`, status, { ex: 3600 });
}

async function getProcessingStatus(rfpId: string) {
  return kv.get<ProcessingStatus>(`rfp:${rfpId}:status`);
}

// Rate limiting per tenant
async function checkRateLimit(organizationId: string) {
  const key = `ratelimit:${organizationId}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 60); // 1 minute window
  return count <= 100; // 100 requests per minute
}
```

**Alternatives Considered**:
- Upstash Redis: Similar but Vercel KV has tighter integration
- In-memory cache: Doesn't work across serverless instances
- Database caching: Higher latency for hot paths

---

## Best Practices Applied

### Next.js 15 App Router Patterns

1. **Server Components by default**: Use client components only for interactivity
2. **Server Actions for mutations**: Avoid client-side API calls where possible
3. **Parallel data fetching**: Use Promise.all in server components
4. **Streaming with Suspense**: Progressive loading for better UX

### Drizzle ORM Patterns

1. **Schema-first design**: Define schema in TypeScript, generate migrations
2. **Prepared statements**: Use for repeated queries
3. **Transaction support**: Wrap related operations
4. **Type-safe queries**: Leverage full type inference

### Security Patterns

1. **Input validation at boundaries**: Zod schemas on all API inputs
2. **Output encoding**: Sanitize before rendering
3. **CSRF protection**: Clerk handles by default
4. **Rate limiting**: Per-tenant limits via Vercel KV

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| How to handle serverless timeouts? | Inngest for long-running workflows |
| Which embedding model? | OpenAI text-embedding-3-small (cost/quality balance) |
| Multi-tenant data isolation? | Clerk Organizations + DB filtering |
| Real-time processing updates? | Polling Inngest event status + Vercel KV |
| LLM provider flexibility? | Vercel AI SDK provider abstraction |
