# Phase 10 Implementation Plan: Polish & Cross-Cutting Concerns (T167–T181)

## Phase 0 Summary: Documentation Discovery

**Sources consulted:**
- `specs/001-rfp-automation-core/tasks.md` — T167–T181 definitions (verbatim)
- `specs/001-rfp-automation-core/spec.md` — confirmed no user story; cross-cutting concerns phase
- `vitest.config.ts` — coverage: v8 provider, 80% thresholds already configured
- `src/app/layout.tsx` — no Toaster, no Suspense, no ErrorBoundary yet
- `src/components/shared/CustomerSelector.tsx` — shared dir exists, pattern established
- `src/components/ui/skeleton.tsx` — shadcn/ui Skeleton component exists
- `next.config.ts` — file exists but is empty (just `{}`)
- `package.json` — `@vercel/kv: ^3.0.0` already installed
- `gh issue list --label "phase:10"` — **no issues exist yet**; must be created

### Confirmed: What Already Exists
- `vitest.config.ts` — v8 coverage with 80% threshold guards already wired
- `src/components/shared/CustomerSelector.tsx` — pattern for shared components
- `src/components/ui/skeleton.tsx` — shadcn/ui `<Skeleton>` primitive
- `src/components/ui/label.tsx`, `button.tsx`, `textarea.tsx` — all available
- `next.config.ts` — stub file, needs security headers added (T179)
- `@vercel/kv` package — installed, ready for T174

### Confirmed: What Does NOT Exist Yet
- `src/components/shared/ErrorBoundary.tsx` — T170
- `src/components/shared/Skeletons.tsx` — T171
- `src/components/shared/Toaster.tsx` — T172
- `quickstart.md` — T181 references it; must be created
- Suspense boundaries on any auth page — T173
- Security headers in `next.config.ts` — T179
- Vercel KV caching layer — T174

### Confirmed: What Needs Modification
- `src/app/layout.tsx` — add `<Toaster>` from sonner (T172)
- `src/app/(auth)/*/page.tsx` — add Suspense wrappers (T173)
- `next.config.ts` — add headers config (T179)
- `src/components/rfp/RfpEditor.tsx` — keyboard navigation (T177)
- Various components — ARIA label additions (T176)

### Allowed APIs (Confirmed from Source Files)

**Vitest coverage** (`vitest.config.ts`):
```bash
npx vitest run --coverage
```
Reports to stdout; thresholds at 80% already configured.

**ErrorBoundary pattern** (React class component — only option for error boundaries):
```typescript
'use client'
import React from 'react'

interface Props { children: React.ReactNode; fallback?: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" className="p-4 border rounded-md bg-destructive/10 text-destructive">
          <p>Something went wrong. Please refresh the page.</p>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Sonner Toaster** (already used throughout codebase):
```typescript
import { Toaster } from 'sonner'
// In layout.tsx body:
<Toaster position="top-right" />
```

**Next.js security headers** (copy from Next.js docs, confirmed pattern):
```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}
```

**Vercel KV pattern** (`@vercel/kv`):
```typescript
import { kv } from '@vercel/kv'

const CACHE_TTL = 60  // seconds
const cacheKey = `rfps:${orgId}`
const cached = await kv.get<RfpListItem[]>(cacheKey)
if (cached) return cached

// ...fetch from DB...

await kv.set(cacheKey, result, { ex: CACHE_TTL })
```

### Anti-Patterns to Avoid
- **NEVER use `React.FC`** — existing components all use plain function syntax
- **NEVER add `<Toaster>` without `'use client'` context** — Toaster from sonner is already a client component
- **NEVER use `toast` component from shadcn/ui** — use `sonner` (project standard)
- **NEVER wrap entire route handlers in KV** — cache only GET handlers with stable org-scoped keys
- **NEVER add `ErrorBoundary` as a function component** — React error boundaries MUST be class components
- **NEVER make `quickstart.md` a TypeScript/code file** — it's a markdown doc

---

## Phase 10A: Coverage Verification (T167–T169)

**Goal**: Run coverage, identify gaps, write missing tests.

### T167 — Run coverage report

```bash
npx vitest run --coverage 2>&1 | tail -40
```

Examine output for any modules below 80% on branches/lines/functions/statements.

**Expected result**: Coverage report shows most modules at 80%+. Note any files below threshold.

### T168 & T169 — Add missing tests

For each module below 80%, add tests following the nearest existing test file pattern:
- Unit tests → copy from `tests/unit/services/learning-capture.test.ts` (T168)
- API route tests → copy from `tests/integration/api/learnings.test.ts` (T169)

**Focus areas likely to need coverage:**
- `src/lib/utils/auth.ts` — core auth helpers
- `src/lib/services/vector-search.ts` — searchSimilar
- `src/lib/ai/embeddings.ts` — generateEmbedding

**Verification**:
```bash
npx vitest run --coverage 2>&1 | grep -E "(FAIL|below threshold)"
# Should show nothing — all thresholds met
```

---

## Phase 10B: Error Handling & Loading States (T170–T172)

**Goal**: Create 3 shared components. All are new files following `src/components/shared/CustomerSelector.tsx` pattern.

### T170 — ErrorBoundary component
**File**: `src/components/shared/ErrorBoundary.tsx`

Copy the class component pattern from the Allowed APIs section above. Key requirements:
- Must be `'use client'` (required for class components in Next.js App Router)
- `fallback` prop is optional — default shows a styled error card
- `role="alert"` on fallback for accessibility
- `data-testid="error-boundary-fallback"` on fallback div

### T171 — Skeleton components
**File**: `src/components/shared/Skeletons.tsx`

Copy the `<Skeleton>` primitive from `src/components/ui/skeleton.tsx` usage in `CustomerSelector.tsx:8,32`. Provide named skeleton variants:

```typescript
'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function RfpListSkeleton() {
  return (
    <div data-testid="rfp-list-skeleton" className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-md" />
      ))}
    </div>
  )
}

export function RfpDetailSkeleton() {
  return (
    <div data-testid="rfp-detail-skeleton" className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div data-testid="table-skeleton" className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
```

### T172 — Toaster wrapper + layout wiring
**File**: `src/components/shared/Toaster.tsx`

Create a thin re-export wrapper (so import path stays consistent):
```typescript
'use client'
export { Toaster } from 'sonner'
```

**Modify**: `src/app/layout.tsx`
Add `<Toaster position="top-right" />` inside the `<body>` tag (both in the `content` variable and after `children`).

**Verification**:
```bash
npx tsc --noEmit
grep "Toaster" src/app/layout.tsx
# Should show Toaster imported and rendered
```

---

## Phase 10C: Security Headers (T179)

**Goal**: Add security headers to the existing empty `next.config.ts`.

Read `next.config.ts` first (it's a stub), then replace with security headers config.

**File to modify**: `next.config.ts`

Copy the security headers pattern from the Allowed APIs section above. Include:
- `X-DNS-Prefetch-Control: on`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**Verification**:
```bash
npm run build 2>&1 | grep -E "(error|Error)" | head -5
# Build must succeed; headers appear in next build output
```

---

## Phase 10D: Performance — Suspense & KV Caching (T173–T174)

### T173 — React Suspense boundaries

**Files to modify**: auth pages that do async data fetching.

Find pages that fetch data:
```bash
grep -rn "await fetch\|useEffect\|db\." src/app/\(auth\)/ 2>/dev/null | head -20
```

Wrap data-fetching sections with `<Suspense fallback={<RfpListSkeleton />}>` importing from `@/components/shared/Skeletons`.

Pattern (copy from Next.js App Router convention):
```typescript
import { Suspense } from 'react'
import { RfpListSkeleton } from '@/components/shared/Skeletons'

// In JSX:
<Suspense fallback={<RfpListSkeleton />}>
  <RfpList />
</Suspense>
```

### T174 — Vercel KV caching for GET /api/rfps

**File to modify**: `src/app/api/rfps/route.ts`

The `GET` handler fetches all org RFPs on every request. Add a KV cache layer:

```typescript
import { kv } from '@vercel/kv'

const CACHE_TTL = 60  // seconds

// In GET handler, after auth:
const cacheKey = `rfps:${auth.orgId}`
const cached = await kv.get<typeof rows>(cacheKey)
if (cached) return NextResponse.json({ rfps: cached })

// ...existing DB query...

await kv.set(cacheKey, rows, { ex: CACHE_TTL })
```

**Cache invalidation**: Add cache busting in the POST handler (when an RFP is created):
```typescript
await kv.del(`rfps:${auth.orgId}`)
```

**Anti-pattern guard**: Do NOT cache responses with user-specific data that varies per `isAdmin` — ensure cache key includes role context if needed.

**Verification**:
```bash
grep "kv\." src/app/api/rfps/route.ts
# Should show get, set, del calls
npx tsc --noEmit
```

---

## Phase 10E: Accessibility (T175–T178)

### T175 — Database query optimization

Verify all tenant-scoped queries use indexed columns. Check existing index coverage:

```bash
grep -rn "organizationId\|organization_id" src/lib/db/schema/*.ts | grep "index"
```

All tables should have `index('*_org_idx').on(table.organizationId)`. If any are missing, add them to the schema file and generate a migration:
```bash
npx drizzle-kit generate
```

### T176 — ARIA labels on interactive components

Add `aria-label` attributes to icon-only buttons and controls missing text labels. Key places:
- `src/components/rfp/ResponseActions.tsx` — action buttons
- `src/components/rfp/ApprovalActions.tsx` — approve/return buttons
- `src/components/rfp/WorkflowStatusBadge.tsx` — status badge

Pattern:
```typescript
<Button aria-label="Approve RFP" onClick={handleApprove}>
  <CheckIcon />
</Button>
```

### T177 — Keyboard navigation in RfpEditor

Read `src/components/rfp/RfpEditor.tsx` first, then add:
- `tabIndex={0}` on focusable response cards
- `onKeyDown` handler for Enter/Space to activate
- `aria-label` on the editor container

### T178 — WCAG 2.1 AA compliance verification

Manual + automated check:
```bash
# Check for images without alt text
grep -rn "<img" src/ | grep -v "alt="

# Check for buttons without accessible text
grep -rn "<Button\|<button" src/components/ | grep -v "aria-label\|children" | head -10

# Check for form inputs without labels
grep -rn "<input\|<Input" src/components/ | grep -v "aria-label\|id=" | head -10
```

Fix any issues found.

---

## Phase 10F: Final Validation (T180–T181)

### T181 — Create quickstart.md

**File to create**: `quickstart.md` (root of project)

Document the minimal steps to get the app running:

```markdown
# RFP Automator — Quickstart

## Prerequisites
- Node.js 18+
- PostgreSQL database (or Neon)
- Clerk account (for auth)

## Setup

1. Clone the repo and install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy `.env.example` to `.env.local` and fill in values:
   - `DATABASE_URL` — Neon/PostgreSQL connection string
   - `ENCRYPTION_KEY` — 64 hex characters (run: `openssl rand -hex 32`)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from Clerk dashboard
   - `CLERK_SECRET_KEY` — from Clerk dashboard
   - `BLOB_READ_WRITE_TOKEN` — from Vercel Blob dashboard
   - `KV_REST_API_URL` + `KV_REST_API_TOKEN` — from Vercel KV dashboard

3. Run database migrations:
   \`\`\`bash
   npx drizzle-kit migrate
   \`\`\`

4. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

5. Open http://localhost:3000

## Running Tests
\`\`\`bash
npm test              # run all tests
npm run test:coverage # run with coverage report
\`\`\`

## Building for Production
\`\`\`bash
npm run build
\`\`\`
```

### T180 — E2E tests in CI mode

```bash
npx playwright test 2>&1 | tail -20
```

E2E tests use graceful-skip when the app isn't running (confirmed pattern from `tests/e2e/llm-configuration.spec.ts`). In CI:
- Start app with `npm run build && npm start` first
- Then run `npx playwright test`

Ensure all existing E2E specs pass or skip gracefully.

---

## Phase 10G: Final Verification

```bash
# Full test suite (unit + integration)
npx vitest run
# Expected: 641+ tests passing, all thresholds met

# Coverage check
npx vitest run --coverage 2>&1 | grep -E "(FAIL|below threshold|All files)"
# Expected: all files at or above 80%

# TypeScript
npm run type-check
# Expected: 0 errors

# Build
npm run build
# Expected: successful, security headers visible in build output

# Anti-pattern checks
grep "knowledgeContext: \[\]" src/lib/inngest/functions/process-rfp.ts
# Should return nothing (confirmed clean from Phase 9)

grep "Toaster" src/app/layout.tsx
# Should show Toaster imported and rendered

grep "X-Frame-Options" next.config.ts
# Should confirm security headers present

grep "kv\." src/app/api/rfps/route.ts
# Should confirm caching wired in

# Accessibility checks
grep -rn "<img" src/ | grep -v 'alt='
# Should return nothing (all images have alt text)
```

---

## Task → File Mapping

| Task | File | Action |
|------|------|--------|
| T167 | — | Run `npx vitest run --coverage` |
| T168 | `tests/unit/services/*.test.ts` | Create coverage gap tests |
| T169 | `tests/integration/api/*.test.ts` | Create coverage gap tests |
| T170 | `src/components/shared/ErrorBoundary.tsx` | Create |
| T171 | `src/components/shared/Skeletons.tsx` | Create |
| T172 | `src/components/shared/Toaster.tsx` + `src/app/layout.tsx` | Create + Modify |
| T173 | `src/app/(auth)/*/page.tsx` | Modify (add Suspense) |
| T174 | `src/app/api/rfps/route.ts` | Modify (add KV cache) |
| T175 | `src/lib/db/schema/*.ts` | Verify + add missing indexes |
| T176 | `src/components/rfp/*.tsx` | Modify (add aria-label) |
| T177 | `src/components/rfp/RfpEditor.tsx` | Modify (keyboard nav) |
| T178 | — | Manual audit + grep checks |
| T179 | `next.config.ts` | Modify (security headers) |
| T180 | — | Run `npx playwright test` |
| T181 | `quickstart.md` | Create |

## Execution Order

```
10A (T167 coverage run → T168/T169 gap tests)
  ↓
10B (T170 ErrorBoundary → T171 Skeletons → T172 Toaster)
  ↓
10C (T179 security headers)
  ↓
10D (T173 Suspense → T174 KV caching)
  ↓
10E (T175 index audit → T176 ARIA → T177 keyboard → T178 audit)
  ↓
10F (T181 quickstart.md → T180 E2E)
  ↓
10G (full verification)
```

**Note on T168/T169:** Coverage results from T167 drive which files need additional tests. If all modules already hit 80%, T168 and T169 can be skipped.

**Note on T174:** Vercel KV requires `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars. In dev without these set, wrap the KV calls in try/catch to avoid breaking the app locally. Production will have them set.
