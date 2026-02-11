# Phase 9 Implementation Plan: US7 - Learn from Completed RFPs (T156–T166)

## Phase 0 Summary: Documentation Discovery

**Sources consulted:**
- `specs/001-rfp-automation-core/tasks.md` — verbatim T156–T166 definitions
- `specs/001-rfp-automation-core/spec.md` — US7 acceptance scenarios, FR-036/037/038
- `specs/001-rfp-automation-core/contracts/api.yaml` — GET/POST /api/learnings contracts
- `specs/001-rfp-automation-core/data-model.md` — learnings table spec
- `src/lib/db/schema/learnings.ts` — ACTUAL schema (already implemented, uuid PK)
- `src/lib/ai/agents/response-generator.ts` — needs learnings wired in (T161)
- `src/lib/inngest/client.ts` — `rfp/extract-learnings` event already registered
- `src/lib/inngest/functions/process-rfp.ts` — `knowledgeContext: []` hardcoded (gap to fill)
- `src/lib/services/vector-search.ts` — `searchSimilar()` signature confirmed
- `tests/integration/inngest/process-rfp.test.ts` — Inngest mock patterns
- `tests/factories/index.ts` — `createMockLearning()` factory exists

### Confirmed: What Already Exists
- `src/lib/db/schema/learnings.ts` — schema with `id uuid PK`, `organizationId`, `customerId`, `content`, `sourceType`, `createdBy`, `sourceMetadata`, `createdAt`
- `src/lib/inngest/client.ts` — `rfp/extract-learnings` event registered: `{ rfpId, organizationId }`
- `tests/factories/index.ts` — `createMockLearning()` factory
- `src/lib/services/vector-search.ts` — `searchSimilar(query, customerId, organizationId, limit)`
- `src/lib/ai/agents/response-generator.ts` — `GenerateResponsesInput` interface (needs `learningsContext` added)

### Confirmed: What Does NOT Exist Yet
- `src/lib/services/learning-capture.ts` — T160
- `src/lib/inngest/functions/extract-learnings.ts` — T162
- `src/app/api/learnings/route.ts` — T163
- `src/components/knowledge/LearningEntry.tsx` — T164
- `src/components/knowledge/ManualLearningForm.tsx` — T165
- `src/components/knowledge/LearningsPanel.tsx` — T166
- `tests/unit/services/learning-capture.test.ts` — T156
- `tests/integration/inngest/extract-learnings.test.ts` — T157
- `tests/integration/api/learnings.test.ts` — T158
- `tests/e2e/learning-system.spec.ts` — T159

### Confirmed: What Needs Modification
- `src/lib/ai/agents/response-generator.ts` — add `learningsContext?: string[]` to input (T161)
- `src/lib/inngest/functions/process-rfp.ts` — replace `knowledgeContext: []` with `searchSimilar()` call (part of T161 wiring)
- `src/app/api/rfps/[rfpId]/approve/route.ts` — send `rfp/extract-learnings` event after approval (T162 trigger)

### Allowed APIs (Confirmed from Source Files)

**Drizzle insert pattern** (from `src/lib/services/rfp-versions.ts`):
```typescript
const [row] = await db
  .insert(learnings)
  .values({ id: crypto.randomUUID(), organizationId, customerId, content, sourceType, createdBy })
  .returning()
```

**Drizzle select with optional filter** (from `src/app/api/rfps/route.ts`):
```typescript
import { eq, and } from 'drizzle-orm'

// Admin: all org learnings
const rows = await db.select().from(learnings).where(eq(learnings.organizationId, orgId))

// With optional customerId filter:
const whereClause = customerId
  ? and(eq(learnings.organizationId, orgId), eq(learnings.customerId, customerId))
  : eq(learnings.organizationId, orgId)
const rows = await db.select().from(learnings).where(whereClause)
```

**Inngest event send** (from `src/lib/inngest/functions/process-rfp.ts`):
```typescript
import { inngest } from '@/lib/inngest/client'

await inngest.send({
  name: 'rfp/extract-learnings',
  data: { rfpId, organizationId: auth.orgId },
})
```

**Inngest function pattern** (copy from `src/lib/inngest/functions/generate-embeddings.ts`):
```typescript
export const extractLearnings = inngest.createFunction(
  { id: 'extract-learnings', name: 'Extract Learnings from Approved RFP' },
  { event: 'rfp/extract-learnings' },
  async ({ event, step }) => {
    const { rfpId, organizationId } = event.data

    const rfpData = await step.run('fetch-rfp-data', async () => { ... })
    const learningsList = await step.run('extract-with-ai', async () => { ... })
    await step.run('save-learnings', async () => { ... })

    return { rfpId, learningSaved: learningsList.length }
  }
)
```

**generateObject pattern** (copy from `src/lib/ai/agents/document-analyzer.ts`):
```typescript
import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModelForOrg } from '@/lib/ai/providers'

const result = await generateObject({
  model: await getLanguageModelForOrg(organizationId),
  schema: z.object({ learnings: z.array(z.string()) }),
  prompt: `Extract key learnings from this approved RFP...`,
})
return result.object
```

**Response generator input interface** (from `src/lib/ai/agents/response-generator.ts`):
```typescript
export interface GenerateResponsesInput {
  fields: Array<{ id: string; type: string; question: string }>
  knowledgeContext: Array<{ content: string; relevanceScore: number; source: string }>
  providerConfig: ProviderConfig
  confidenceThreshold?: number
  learningsContext?: string[]  // ← ADD THIS (T161)
}
```

**API response shapes** (from `contracts/api.yaml`):
```typescript
// GET /api/learnings?customerId=xxx → { learnings: Learning[] }
// POST /api/learnings → { learning: Learning }  (201)
// Learning shape:
type LearningResponse = {
  id: string
  organizationId: string
  customerId: string | null
  content: string
  sourceType: 'rfp_approval' | 'user_correction' | 'manual_entry'
  createdBy: string
  sourceMetadata: { rfpId?: string; fieldId?: string; originalText?: string; correctedText?: string } | null
  createdAt: string
}
```

### Anti-Patterns to Avoid
- **NEVER use `createId()`** — the actual `learnings.ts` uses `uuid` PKs; use `crypto.randomUUID()` or `uuid().defaultRandom()` patterns as in other schema files
- **NEVER mock `inngest` with incorrect shape** — always mock as `{ inngest: { send: vi.fn() } }` (confirmed from `process-rfp.test.ts`)
- **NEVER import route handlers before vi.mock calls** — Vitest hoisting requirement
- **Do NOT modify `GenerateResponsesInput` to require `learningsContext`** — make it optional (`learningsContext?: string[]`) to preserve backward compatibility with existing tests
- **Do NOT register new Inngest events** — `rfp/extract-learnings` is already in `client.ts`

---

## Phase 9A: TDD Red Phase — Write Failing Tests (T156, T157, T158, T159)

**Goal**: Create 4 test files defining expected behavior. All must fail initially.

### T156 — Unit tests for learning-capture service
**File**: `tests/unit/services/learning-capture.test.ts`

Copy the DB mock pattern from `tests/unit/services/rfp-versions.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn() },
}))
vi.mock('@/lib/db/schema', () => ({
  learnings: {},
}))

import { captureCorrection, captureManualLearning } from '@/lib/services/learning-capture'
import { db } from '@/lib/db'

describe('learning-capture service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('captureCorrection()', () => {
    it('inserts a user_correction learning record', async () => { ... })
    it('includes originalText and correctedText in sourceMetadata', async () => { ... })
    it('sets sourceType to user_correction', async () => { ... })
  })

  describe('captureManualLearning()', () => {
    it('inserts a manual_entry learning record', async () => { ... })
    it('allows null customerId for org-wide learnings', async () => { ... })
  })
})
```

### T157 — Integration test for extract-learnings Inngest function
**File**: `tests/integration/inngest/extract-learnings.test.ts`

Copy the Inngest test pattern from `tests/integration/inngest/process-rfp.test.ts`:
```typescript
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }))
vi.mock('@/lib/ai/providers', () => ({ getLanguageModelForOrg: vi.fn() }))
vi.mock('ai', () => ({ generateObject: vi.fn() }))

import { extractLearnings } from '@/lib/inngest/functions/extract-learnings'

describe('extractLearnings Inngest function', () => {
  it('fetches RFP data and approved responses', async () => { ... })
  it('calls generateObject to extract learnings', async () => { ... })
  it('inserts learning records with sourceType rfp_approval', async () => { ... })
  it('returns count of learnings saved', async () => { ... })
})
```

### T158 — Contract tests for /api/learnings
**File**: `tests/integration/api/learnings.test.ts`

Copy auth+db mock structure from `tests/integration/api/settings.test.ts`:
```typescript
vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  isAdmin: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message); this.name = 'AuthError'
    }
  },
}))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }))

import { GET, POST } from '@/app/api/learnings/route'

describe('GET /api/learnings', () => {
  it('returns 200 with learnings array', async () => { ... })
  it('filters by customerId when provided', async () => { ... })
  it('returns 401 when unauthenticated', async () => { ... })
})

describe('POST /api/learnings', () => {
  it('creates manual_entry learning, returns 201', async () => { ... })
  it('returns 400 when content is missing', async () => { ... })
  it('returns 401 when unauthenticated', async () => { ... })
})
```

### T159 — E2E test
**File**: `tests/e2e/learning-system.spec.ts`

Copy graceful-skip pattern from `tests/e2e/llm-configuration.spec.ts`:
```typescript
import { test, expect } from '@playwright/test'
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Learning System', () => {
  test('dashboard page loads', async ({ page }) => { ... })
  test('manual learning form is accessible', async ({ page }) => { ... })
  test('learnings panel displays entries', async ({ page }) => { ... })
})
```

**Verification**: `npx vitest run tests/unit/services/learning-capture.test.ts` → fails with "Cannot find module". All 4 test files created and failing.

---

## Phase 9B: Learning Capture Service (T160)

**File to create**: `src/lib/services/learning-capture.ts`

Copy the service function pattern from `src/lib/services/rfp-versions.ts`:

```typescript
import { db } from '@/lib/db'
import { learnings } from '@/lib/db/schema'
import type { Learning } from '@/lib/db/schema'

export interface CaptureCorrection {
  rfpId: string
  fieldId: string
  organizationId: string
  customerId?: string | null
  createdBy: string
  originalText: string
  correctedText: string
}

export async function captureCorrection(input: CaptureCorrection): Promise<Learning> {
  const [row] = await db
    .insert(learnings)
    .values({
      organizationId: input.organizationId,
      customerId: input.customerId ?? null,
      content: `Field correction: ${input.correctedText}`,
      sourceType: 'user_correction',
      createdBy: input.createdBy,
      sourceMetadata: {
        rfpId: input.rfpId,
        fieldId: input.fieldId,
        originalText: input.originalText,
        correctedText: input.correctedText,
      },
    })
    .returning()

  return row
}

export interface CaptureManualLearning {
  organizationId: string
  customerId?: string | null
  content: string
  createdBy: string
}

export async function captureManualLearning(input: CaptureManualLearning): Promise<Learning> {
  const [row] = await db
    .insert(learnings)
    .values({
      organizationId: input.organizationId,
      customerId: input.customerId ?? null,
      content: input.content,
      sourceType: 'manual_entry',
      createdBy: input.createdBy,
      sourceMetadata: null,
    })
    .returning()

  return row
}
```

**Note on UUID**: The actual `learnings.ts` schema has no explicit `id` in the insert since it defaults via `uuid().defaultRandom()`. Do NOT manually pass `id`.

**Verification**:
- `npx vitest run tests/unit/services/learning-capture.test.ts` — all tests pass
- `grep "sourceType" src/lib/services/learning-capture.ts` — confirms both types handled

---

## Phase 9C: Learnings API Route (T163)

**File to create**: `src/app/api/learnings/route.ts`

Copy the GET+POST pattern from `src/app/api/settings/route.ts` and `src/app/api/rfps/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { learnings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { captureManualLearning } from '@/lib/services/learning-capture'

// GET /api/learnings?customerId=xxx — any authenticated member
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const customerId = request.nextUrl.searchParams.get('customerId')

    const whereClause = customerId
      ? and(eq(learnings.organizationId, auth.orgId), eq(learnings.customerId, customerId))
      : eq(learnings.organizationId, auth.orgId)

    const rows = await db.select().from(learnings).where(whereClause)

    return NextResponse.json({ learnings: rows })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

// POST /api/learnings — any authenticated member can add manual learning
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const body = await request.json()

    if (!body.content || typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const learning = await captureManualLearning({
      organizationId: auth.orgId,
      customerId: body.customerId ?? null,
      content: body.content.trim(),
      createdBy: auth.userId,
    })

    return NextResponse.json({ learning }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
```

**Verification**:
- `npx vitest run tests/integration/api/learnings.test.ts` — all tests pass
- `grep "manual_entry" src/app/api/learnings/route.ts` — confirms sourceType

---

## Phase 9D: Extract-Learnings Inngest Function (T162) + Approval Trigger

### Part 1: Create the function
**File to create**: `src/lib/inngest/functions/extract-learnings.ts`

Copy the multi-step Inngest pattern from `src/lib/inngest/functions/process-rfp.ts`:

```typescript
import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { rfps, rfpResponses, learnings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModelForOrg } from '@/lib/ai/providers'

const learningsSchema = z.object({
  learnings: z.array(z.object({
    insight: z.string().describe('A specific reusable insight for future RFPs'),
  })),
})

export const extractLearnings = inngest.createFunction(
  { id: 'extract-learnings', name: 'Extract Learnings from Approved RFP' },
  { event: 'rfp/extract-learnings' },
  async ({ event, step }) => {
    const { rfpId, organizationId } = event.data

    // Step 1: Fetch the RFP and its approved responses
    const rfpData = await step.run('fetch-rfp-data', async () => {
      const [rfp] = await db.select().from(rfps).where(
        and(eq(rfps.id, rfpId), eq(rfps.organizationId, organizationId))
      ).limit(1)
      if (!rfp) throw new Error(`RFP not found: ${rfpId}`)

      const responses = await db.select().from(rfpResponses).where(
        eq(rfpResponses.rfpId, rfpId)
      )
      return { rfp, responses }
    })

    // Step 2: Extract learnings with AI
    const extracted = await step.run('extract-with-ai', async () => {
      const model = await getLanguageModelForOrg(organizationId)
      const completedPairs = rfpData.responses
        .filter(r => r.responseText)
        .map(r => `Q: ${r.question}\nA: ${r.responseText}`)
        .join('\n\n')

      if (!completedPairs) return { learnings: [] }

      const result = await generateObject({
        model,
        schema: learningsSchema,
        prompt: `Extract 3-5 reusable insights from these completed RFP responses that would help answer similar questions in future RFPs:\n\n${completedPairs}`,
      })
      return result.object
    })

    // Step 3: Save learnings to DB
    const saved = await step.run('save-learnings', async () => {
      if (!extracted.learnings.length) return []

      const rows = await Promise.all(
        extracted.learnings.map(l =>
          db.insert(learnings).values({
            organizationId,
            customerId: rfpData.rfp.customerId ?? null,
            content: l.insight,
            sourceType: 'rfp_approval',
            createdBy: 'system',
            sourceMetadata: { rfpId },
          }).returning()
        )
      )
      return rows.flat()
    })

    return { rfpId, learningsSaved: saved.length }
  }
)
```

### Part 2: Register the function in the Inngest serve handler

**File to modify**: `src/app/api/inngest/route.ts`

Read the file first, then add `extractLearnings` to the functions array alongside existing functions.

### Part 3: Trigger on RFP approval

**File to modify**: `src/app/api/rfps/[rfpId]/approve/route.ts`

After the DB update that approves the RFP, add:
```typescript
import { inngest } from '@/lib/inngest/client'
// ...after successful approval update:
await inngest.send({
  name: 'rfp/extract-learnings',
  data: { rfpId, organizationId: auth.orgId },
})
```

**Verification**:
- `npx vitest run tests/integration/inngest/extract-learnings.test.ts` — all tests pass
- `grep "extractLearnings" src/app/api/inngest/route.ts` — confirms function is registered

---

## Phase 9E: Enhance Response Generator (T161)

**File to modify**: `src/lib/ai/agents/response-generator.ts`

1. Add `learningsContext?: string[]` to `GenerateResponsesInput` interface
2. Incorporate learnings into the prompt when present

```typescript
// Add to GenerateResponsesInput interface:
learningsContext?: string[]  // insights from past approved RFPs

// In the prompt construction (inside generateResponses):
const learningsSection = input.learningsContext?.length
  ? `\n\nPrevious learnings from approved RFPs:\n${input.learningsContext.map(l => `- ${l}`).join('\n')}`
  : ''

// Append learningsSection to the existing prompt
```

**File to modify**: `src/lib/inngest/functions/process-rfp.ts`

Replace the hardcoded `knowledgeContext: []` with an actual `searchSimilar()` call:

```typescript
// In Step 5 (generate-responses), before calling generateResponses():
import { searchSimilar } from '@/lib/services/vector-search'
import { db } from '@/lib/db'
import { learnings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Fetch relevant knowledge context via vector search
const knowledgeResults = await searchSimilar(
  rfpData.rfp.name,  // use RFP name/description as query
  rfpData.rfp.customerId,
  organizationId,
  10
)
const knowledgeContext = knowledgeResults.map(r => ({
  content: r.content,
  relevanceScore: r.similarity,
  source: r.title,
}))

// Fetch relevant learnings for context
const orgLearnings = await db.select()
  .from(learnings)
  .where(eq(learnings.organizationId, organizationId))

const learningsContext = orgLearnings.map(l => l.content)
```

**Anti-pattern guard**: Do NOT change `confidenceThreshold` default — leave existing `0.7` default in place.

**Verification**:
- `grep "learningsContext" src/lib/ai/agents/response-generator.ts` — confirms addition
- `grep "searchSimilar" src/lib/inngest/functions/process-rfp.ts` — confirms wiring
- `npx vitest run tests/unit/ai/agents/response-generator.test.ts` — existing tests still pass

---

## Phase 9F: UI Components (T164, T165, T166)

### T164 — LearningEntry component
**File**: `src/components/knowledge/LearningEntry.tsx`

```typescript
'use client'

import type { Learning } from '@/lib/db/schema'

const SOURCE_LABELS: Record<string, string> = {
  rfp_approval: 'Auto-learned',
  user_correction: 'Correction',
  manual_entry: 'Manual',
}

interface LearningEntryProps {
  learning: Learning
}

export function LearningEntry({ learning }: LearningEntryProps) {
  return (
    <div data-testid="learning-entry" className="border rounded-md p-3 space-y-1">
      <p className="text-sm">{learning.content}</p>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="bg-secondary px-2 py-0.5 rounded">
          {SOURCE_LABELS[learning.sourceType] ?? learning.sourceType}
        </span>
        <span>{new Date(learning.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
```

### T165 — ManualLearningForm component
**File**: `src/components/knowledge/ManualLearningForm.tsx`

Copy the UserInviteForm pattern from `src/components/settings/UserInviteForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface ManualLearningFormProps {
  customerId?: string
  onSaved?: () => void
}

export function ManualLearningForm({ customerId, onSaved }: ManualLearningFormProps) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), customerId }),
      })
      if (!res.ok) throw new Error('Failed to save learning')
      setContent('')
      toast.success('Learning saved')
      onSaved?.()
    } catch {
      toast.error('Failed to save learning')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form data-testid="manual-learning-form" onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="learning-content">Add a learning or insight</Label>
        <Textarea
          id="learning-content"
          placeholder="Enter insight about this customer or domain..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={saving}
          rows={3}
        />
      </div>
      <Button type="submit" disabled={saving || !content.trim()} size="sm">
        {saving ? 'Saving...' : 'Save Learning'}
      </Button>
    </form>
  )
}
```

### T166 — LearningsPanel component
**File**: `src/components/knowledge/LearningsPanel.tsx`

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LearningEntry } from './LearningEntry'
import { ManualLearningForm } from './ManualLearningForm'
import type { Learning } from '@/lib/db/schema'

interface LearningsPanelProps {
  customerId?: string
}

export function LearningsPanel({ customerId }: LearningsPanelProps) {
  const [learningsList, setLearningsList] = useState<Learning[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLearnings = useCallback(async () => {
    setLoading(true)
    try {
      const url = customerId
        ? `/api/learnings?customerId=${customerId}`
        : '/api/learnings'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLearningsList(data.learnings)
      }
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => { fetchLearnings() }, [fetchLearnings])

  return (
    <Card data-testid="learnings-panel">
      <CardHeader>
        <CardTitle>Learnings & Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ManualLearningForm customerId={customerId} onSaved={fetchLearnings} />
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : learningsList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No learnings yet.</p>
        ) : (
          <div className="space-y-2">
            {learningsList.map((l) => (
              <LearningEntry key={l.id} learning={l} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Verification**:
- `npx tsc --noEmit` — no TypeScript errors
- Components use `data-testid` attributes matching E2E test selectors

---

## Phase 9G: Final Verification

```bash
# Full test suite
npx vitest run
# Expected: all 626 + new tests passing

# TypeScript
npm run type-check
# Expected: 0 errors

# Build
npm run build
# Expected: successful, /api/learnings and new components compiled

# Anti-pattern checks
grep "knowledgeContext: \[\]" src/lib/inngest/functions/process-rfp.ts
# Should return nothing (hardcoded empty array removed)

grep "learningsContext" src/lib/ai/agents/response-generator.ts
# Should return lines confirming it's wired in

grep "extractLearnings" src/app/api/inngest/route.ts
# Should confirm function is registered
```

---

## Task → File Mapping

| Task | File | Action |
|------|------|--------|
| T156 | `tests/unit/services/learning-capture.test.ts` | Create |
| T157 | `tests/integration/inngest/extract-learnings.test.ts` | Create |
| T158 | `tests/integration/api/learnings.test.ts` | Create |
| T159 | `tests/e2e/learning-system.spec.ts` | Create |
| T160 | `src/lib/services/learning-capture.ts` | Create |
| T161 | `src/lib/ai/agents/response-generator.ts` | Modify |
| T161 | `src/lib/inngest/functions/process-rfp.ts` | Modify (replace `knowledgeContext: []`) |
| T162 | `src/lib/inngest/functions/extract-learnings.ts` | Create |
| T162 | `src/app/api/inngest/route.ts` | Modify (register function) |
| T162 | `src/app/api/rfps/[rfpId]/approve/route.ts` | Modify (send event) |
| T163 | `src/app/api/learnings/route.ts` | Create |
| T164 | `src/components/knowledge/LearningEntry.tsx` | Create |
| T165 | `src/components/knowledge/ManualLearningForm.tsx` | Create |
| T166 | `src/components/knowledge/LearningsPanel.tsx` | Create |

## Execution Order

```
9A (T156-T159 red tests)
  ↓
9B (T160: learning-capture service)
  ↓
9C (T163: learnings API route)
  ↓
9D (T162: extract-learnings Inngest function + approval trigger)
  ↓
9E (T161: enhance response-generator + wire searchSimilar)
  ↓
9F (T164-T166: UI components)
  ↓
9G (full verification)
```

Dependencies:
- T158 tests need T163 route (import after vi.mock)
- T157 tests need T162 function (import after vi.mock)
- T162 (approval trigger) needs T162 function to exist first
- T166 needs T164 + T165
- T161 wiring needs T160 service and existing `searchSimilar` (already exists)
