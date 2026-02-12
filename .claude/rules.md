# Project Coding Rules

Rules to prevent recurring build errors. Apply these when writing or reviewing code.

## TypeScript Strict Mode

### Array Access
Always guard against `undefined` when accessing arrays by index. TypeScript strict mode treats `arr[i]` as `T | undefined`.

```ts
// BAD
const item = results[0].name

// GOOD
const item = results[0]
if (!item) throw new Error('Not found')
item.name
```

### Function Signatures
Always check the actual function signature before calling. Do NOT guess parameter types.

```ts
// BAD - guessing requireAuth takes request
const auth = await requireAuth(request)

// GOOD - requireAuth() takes no args (uses Clerk's auth() internally)
const auth = await requireAuth()
```

### No `any` Types
Use `unknown` for catch blocks, proper types everywhere else. The ESLint preset `next/typescript` treats `no-explicit-any` as a build error.

```ts
// BAD
catch (error: any) { error.message }

// GOOD
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
}
```

## Next.js 15 Conventions

### Async Route Params
Route handler params are `Promise<>` in Next.js 15. Always use this pattern:

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
}
```

### Unused Parameters
If a route handler doesn't use `request`, omit it from the signature. ESLint `no-unused-vars` will fail the build.

## Schema as Single Source of Truth

### Import Types from Schema
Never re-define types locally that already exist in `src/lib/db/schema/`. Import them.

```ts
// BAD - local type that can drift from schema
type KnowledgeEntryType = 'past_rfp' | 'case_study' | ...

// GOOD - import from schema
import type { KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'
```

### Column Names
Always read the schema file to verify column names before using them. Example: the rfps table uses `originalFileUrl` and `originalFileType`, not `documentUrl`/`documentType`.

## Inngest Step Serialization

Inngest `step.run()` serializes return values through JSON. This means:
- `Buffer` becomes `{ type: "Buffer", data: number[] }` - reconstruct with `Buffer.from(data.data)`
- `Date` becomes ISO string
- Return types are wrapped in `Jsonify<T>`

Always account for serialization when chaining step results.

## AI Agent Function Contracts

All AI agent functions (`analyzeDocument`, `generateResponses`, `checkQuality`) require a `providerConfig: ProviderConfig` parameter. Always check the function's interface before calling.

## Component-to-Route Alignment

When creating UI components that call API routes:
1. Read the actual route handler to verify the prop names it expects
2. Read the component interface to verify prop names match
3. Don't create components with prop names that don't match their consumers
