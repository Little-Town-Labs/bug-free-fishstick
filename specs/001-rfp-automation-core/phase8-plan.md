# Phase 8 Implementation Plan: US6 - Configure LLM Provider (T146–T155)

## Phase 0 Summary: Documentation Discovery

**Sources consulted:**
- `specs/001-rfp-automation-core/tasks.md` — verbatim T146–T155 definitions
- `specs/001-rfp-automation-core/spec.md` — US6 acceptance scenarios
- `specs/001-rfp-automation-core/contracts/api.yaml` — GET/PATCH /api/settings contracts
- `specs/001-rfp-automation-core/data-model.md` — tenant_settings schema
- `src/lib/db/schema/tenant-settings.ts` — ACTUAL schema (already implemented)
- `src/lib/ai/providers.ts` — ACTUAL provider abstraction (needs T150 update)
- `src/lib/utils/auth.ts` — auth patterns
- `tests/integration/api/rfp-permissions.test.ts` — canonical mock patterns
- `tests/unit/services/rfp-workflow.test.ts` — unit test patterns
- `drizzle/0000_gray_sprite.sql` — confirms tenant_settings IS already migrated
- `src/app/(auth)/settings/page.tsx` — LLM tab already points to `/settings/llm`

### Confirmed: What Already Exists
- `src/lib/db/schema/tenant-settings.ts` — schema with `llmProvider`, `llmApiKeyEncrypted`, `confidenceThreshold`, `autoLearnEnabled`
- `src/lib/ai/providers.ts` — `getLanguageModel(config: ProviderConfig): LanguageModel` (env-var based)
- `drizzle/0000_gray_sprite.sql` — `CREATE TABLE "tenant_settings"` already migrated
- `src/app/(auth)/settings/page.tsx` — settings nav with LLM tab (href `/settings/llm`)

### Confirmed: What Does NOT Exist Yet
- `src/lib/services/encryption.ts` — T149
- `src/app/api/settings/route.ts` — T151/T152
- `src/components/settings/LlmProviderSelector.tsx` — T153
- `src/components/settings/ApiKeyInput.tsx` — T154
- `src/components/settings/SettingsForm.tsx` — T155
- `src/app/(auth)/settings/llm/page.tsx` — LLM config page (not in tasks.md but implied)
- `tests/unit/services/encryption.test.ts` — T146
- `tests/integration/api/settings.test.ts` — T147
- `tests/e2e/llm-configuration.spec.ts` — T148

### Allowed APIs (Confirmed from Source Files)

**Drizzle query patterns** (from `src/lib/services/rfp-versions.ts`):
```typescript
// Upsert pattern for tenant_settings
await db.insert(tenantSettings)
  .values({ organizationId: orgId, llmProvider, llmApiKeyEncrypted, ... })
  .onConflictDoUpdate({
    target: tenantSettings.organizationId,
    set: { llmProvider, llmApiKeyEncrypted, updatedAt: new Date() },
  })
  .returning()

// SELECT by primary key
const [row] = await db
  .select()
  .from(tenantSettings)
  .where(eq(tenantSettings.organizationId, orgId))
  .limit(1)
```

**Node.js crypto AES-256-GCM** (standard Node 18 built-in, no new deps):
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32-byte hex

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':')
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8')
}
```

**Auth patterns** (from `src/lib/utils/auth.ts`):
```typescript
// Admin-only guard (inline pattern used in rfps/[rfpId]/route.ts)
const auth = await requireAuth()
if (!isAdmin(auth.orgRole)) {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
}
```

**API response shapes** (from `contracts/api.yaml`):
```typescript
// GET /api/settings → { settings: TenantSettingsResponse }
type TenantSettingsResponse = {
  organizationId: string
  llmProvider: 'claude' | 'openai' | 'azure'
  llmApiKeyConfigured: boolean  // ← NOT the key itself
  confidenceThreshold: number
  autoLearnEnabled: boolean
  createdAt: string
  updatedAt: string
}

// PATCH /api/settings request body
type UpdateSettingsInput = {
  llmProvider?: 'claude' | 'openai' | 'azure'
  llmApiKey?: string      // plaintext, encrypted before storage
  confidenceThreshold?: number
  autoLearnEnabled?: boolean
}
```

### Anti-Patterns to Avoid
- **NEVER return `llmApiKeyEncrypted` in API responses** — always return `llmApiKeyConfigured: boolean`
- **NEVER use synchronous crypto** — all encryption helpers should be pure sync (crypto module is sync, that's fine)
- **NEVER add `user-specific` API keys** — keys are per-tenant (orgId), not per-user
- **NEVER create a new DB table** — `tenant_settings` already exists and is migrated
- **NEVER call `requireAdmin()` that throws** for GET — GET should be readable by all org members; only PUT/PATCH is admin-only
- **Do NOT mock `@/lib/db/schema`** — mock `@/lib/db` only (as per existing test patterns in rfp-permissions.test.ts)
- **Do NOT import route handlers before vi.mock calls** — always mock first, import after (Vitest hoisting requirement)

---

## Phase 8A: TDD Red Phase — Write Failing Tests (T146, T147, T148)

**Goal**: Create test files that define the expected behavior. All tests must fail initially.

### T146 — Unit tests for encryption service
**File**: `tests/unit/services/encryption.test.ts`

Copy this test structure:
```typescript
import { describe, it, expect } from 'vitest'
// Will import from @/lib/services/encryption (doesn't exist yet — tests will fail)
import { encrypt, decrypt } from '@/lib/services/encryption'

describe('encryption service', () => {
  describe('encrypt()', () => {
    it('returns a colon-separated string with iv:tag:encrypted parts', () => {
      const result = encrypt('test-api-key')
      const parts = result.split(':')
      expect(parts).toHaveLength(3)
    })

    it('produces different ciphertext for same input (random IV)', () => {
      const a = encrypt('test-api-key')
      const b = encrypt('test-api-key')
      expect(a).not.toBe(b)
    })
  })

  describe('decrypt()', () => {
    it('round-trips: decrypt(encrypt(x)) === x', () => {
      const original = 'sk-ant-api03-test-key'
      expect(decrypt(encrypt(original))).toBe(original)
    })

    it('throws on tampered ciphertext', () => {
      const ct = encrypt('hello')
      const [iv, tag, enc] = ct.split(':')
      const tampered = `${iv}:${tag}:deadbeef${enc}`
      expect(() => decrypt(tampered)).toThrow()
    })
  })
})
```

**Vitest env note**: These tests run in Node (not jsdom) — no env override needed. But `process.env.ENCRYPTION_KEY` must be set in test. Add to `src/test/setup.ts`:
```typescript
process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 32-byte hex = 64 hex chars
```

### T147 — Integration tests for /api/settings
**File**: `tests/integration/api/settings.test.ts`

Copy the `rfp-permissions.test.ts` mock structure exactly:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  isAdmin: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/services/encryption', () => ({
  encrypt: vi.fn((v: string) => `encrypted:${v}`),
  decrypt: vi.fn((v: string) => v.replace('encrypted:', '')),
}))

// Import route handlers AFTER mocks
import { GET, PATCH } from '@/app/api/settings/route'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'

describe('Settings API', () => {
  const adminCtx = { userId: 'user_1', orgId: 'org_123', orgRole: 'org:admin' }
  const memberCtx = { userId: 'user_2', orgId: 'org_123', orgRole: 'org:member' }

  const mockSettings = {
    organizationId: 'org_123',
    llmProvider: 'claude',
    llmApiKeyEncrypted: 'encrypted:sk-ant-123',
    confidenceThreshold: 0.7,
    autoLearnEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/settings', () => {
    it('returns 200 with settings for authenticated user', async () => { ... })
    it('returns llmApiKeyConfigured=true when key is set', async () => { ... })
    it('returns llmApiKeyConfigured=false when key is null', async () => { ... })
    it('returns default settings when no settings row exists', async () => { ... })
    it('returns 401 when unauthenticated', async () => { ... })
  })

  describe('PATCH /api/settings', () => {
    it('admin can update llmProvider', async () => { ... })
    it('admin can update llmApiKey (is encrypted before storage)', async () => { ... })
    it('non-admin gets 403', async () => { ... })
    it('returns 400 for invalid provider', async () => { ... })
  })
})
```

**Note on `encrypt` mock**: Mock it in the settings test to avoid needing `ENCRYPTION_KEY` in the integration test environment. The real encryption is tested in T146.

### T148 — E2E test for LLM configuration
**File**: `tests/e2e/llm-configuration.spec.ts`

Copy graceful-skip pattern from `tests/e2e/user-management.spec.ts`:
```typescript
import { test, expect } from '@playwright/test'

test.describe('LLM Configuration', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await page.goto('/settings/llm', { timeout: 5000 })
    } catch {
      test.skip()
    }
  })

  test('LLM settings page loads', async ({ page }) => { ... })
  test('LLM provider selector shows 3 options', async ({ page }) => { ... })
  test('API key input is masked', async ({ page }) => { ... })
  test('non-admin sees read-only view', async ({ page }) => { ... })
})
```

**Verification**: Run `npx vitest run tests/unit/services/encryption.test.ts` — should fail with "Cannot find module '@/lib/services/encryption'". Run `npx vitest run tests/integration/api/settings.test.ts` — should fail with "Cannot find module '@/app/api/settings/route'".

---

## Phase 8B: Encryption Service (T149)

**Goal**: Implement `src/lib/services/encryption.ts` so T146 tests pass.

**File to create**: `src/lib/services/encryption.ts`

Copy the AES-256-GCM pattern from Phase 0:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':')
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
```

**Add to `src/test/setup.ts`**: Add `process.env.ENCRYPTION_KEY = 'a'.repeat(64)` for test environment.

**Verification**:
- `npx vitest run tests/unit/services/encryption.test.ts` — all 4 tests pass
- `grep -r "createCipheriv" src/lib/services/encryption.ts` — confirms AES-GCM usage

**Anti-pattern guard**: Do NOT use `aes-256-cbc` (no authentication tag). Do NOT use `crypto.subtle` (Web Crypto API — not for Node file services). Do NOT hardcode keys.

---

## Phase 8C: Settings API Route (T151 + T152)

**Goal**: Implement `src/app/api/settings/route.ts` with GET and PATCH handlers.

**File to create**: `src/app/api/settings/route.ts`

Copy the standard route pattern from `src/app/api/rfps/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { tenantSettings, llmProviders, LlmProvider } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { encrypt } from '@/lib/services/encryption'

const DEFAULT_SETTINGS = {
  llmProvider: 'claude' as LlmProvider,
  llmApiKeyEncrypted: null,
  confidenceThreshold: 0.7,
  autoLearnEnabled: true,
}

// GET /api/settings — any authenticated org member
export async function GET() {
  try {
    const auth = await requireAuth()

    const [row] = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, auth.orgId))
      .limit(1)

    const data = row ?? { ...DEFAULT_SETTINGS, organizationId: auth.orgId, createdAt: new Date(), updatedAt: new Date() }

    return NextResponse.json({
      settings: {
        organizationId: data.organizationId,
        llmProvider: data.llmProvider,
        llmApiKeyConfigured: data.llmApiKeyEncrypted !== null,
        confidenceThreshold: data.confidenceThreshold,
        autoLearnEnabled: data.autoLearnEnabled,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

// PATCH /api/settings — admin only
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth()

    if (!isAdmin(auth.orgRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()

    // Validate provider if provided
    if (body.llmProvider && !llmProviders.includes(body.llmProvider)) {
      return NextResponse.json({ error: 'Invalid LLM provider' }, { status: 400 })
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() }
    if (body.llmProvider !== undefined) updateValues.llmProvider = body.llmProvider
    if (body.llmApiKey !== undefined) updateValues.llmApiKeyEncrypted = encrypt(body.llmApiKey)
    if (body.confidenceThreshold !== undefined) updateValues.confidenceThreshold = body.confidenceThreshold
    if (body.autoLearnEnabled !== undefined) updateValues.autoLearnEnabled = body.autoLearnEnabled

    const [updated] = await db
      .insert(tenantSettings)
      .values({
        organizationId: auth.orgId,
        ...DEFAULT_SETTINGS,
        ...updateValues,
      })
      .onConflictDoUpdate({
        target: tenantSettings.organizationId,
        set: updateValues,
      })
      .returning()

    return NextResponse.json({
      settings: {
        organizationId: updated.organizationId,
        llmProvider: updated.llmProvider,
        llmApiKeyConfigured: updated.llmApiKeyEncrypted !== null,
        confidenceThreshold: updated.confidenceThreshold,
        autoLearnEnabled: updated.autoLearnEnabled,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
```

**Verification**:
- `npx vitest run tests/integration/api/settings.test.ts` — all tests pass
- `grep -r "llmApiKeyEncrypted" src/app/api/settings/route.ts` — key NEVER in response
- `grep -r "llmApiKeyConfigured" src/app/api/settings/route.ts` — boolean IS in response

---

## Phase 8D: Update LLM Provider Abstraction (T150)

**Goal**: Update `src/lib/ai/providers.ts` to add a tenant-aware factory function, keeping the existing `getLanguageModel(config)` intact for backward compatibility.

**File to modify**: `src/lib/ai/providers.ts`

Add a new exported function `getLanguageModelForOrg(orgId: string): Promise<LanguageModel>` that:
1. Fetches `tenantSettings` from DB
2. Decrypts `llmApiKeyEncrypted` if present
3. Falls back to env vars if no tenant key configured
4. Calls the existing `getLanguageModel(config)` factory

```typescript
// NEW export added to existing providers.ts — do NOT change getLanguageModel()
import { db } from '@/lib/db'
import { tenantSettings } from '@/lib/db/schema'
import { decrypt } from '@/lib/services/encryption'
import { eq } from 'drizzle-orm'

export async function getLanguageModelForOrg(orgId: string): Promise<LanguageModel> {
  const [row] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, orgId))
    .limit(1)

  const provider = row?.llmProvider ?? 'claude'
  const apiKey = row?.llmApiKeyEncrypted ? decrypt(row.llmApiKeyEncrypted) : undefined

  return getLanguageModel({ provider, apiKey })
}
```

**Verification**:
- `grep -r "getLanguageModelForOrg" src/lib/ai/providers.ts` — new function exists
- `grep -r "getLanguageModel" src/lib/ai/providers.ts` — original function still exists (backward compat)
- `npx tsc --noEmit` — no TypeScript errors

**Anti-pattern guard**: Do NOT change or remove the existing `getLanguageModel(config)` — it's used in existing code. Add the new function alongside it.

---

## Phase 8E: UI Components (T153, T154, T155) + LLM Settings Page

**Goal**: Create 3 UI components and the LLM settings page at `/settings/llm`.

### T153 — LlmProviderSelector component
**File**: `src/components/settings/LlmProviderSelector.tsx`

Copy the `RoleSelector.tsx` pattern (native `<select>` with Tailwind, same file: `src/components/settings/RoleSelector.tsx`):
```typescript
'use client'

import { llmProviders, LlmProvider } from '@/lib/db/schema'

interface LlmProviderSelectorProps {
  value: LlmProvider
  onChange: (provider: LlmProvider) => void
  disabled?: boolean
}

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  claude: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  azure: 'Azure OpenAI',
}

export function LlmProviderSelector({ value, onChange, disabled }: LlmProviderSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as LlmProvider)}
      disabled={disabled}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {llmProviders.map((p) => (
        <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
      ))}
    </select>
  )
}
```

### T154 — ApiKeyInput component (with masking)
**File**: `src/components/settings/ApiKeyInput.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ApiKeyInputProps {
  isConfigured: boolean
  onChange: (value: string) => void
  disabled?: boolean
}

export function ApiKeyInput({ isConfigured, onChange, disabled }: ApiKeyInputProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  if (!editing && isConfigured) {
    return (
      <div className="flex items-center gap-2">
        <Input value="••••••••••••••••••••" readOnly className="font-mono" />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={disabled}>
          Update
        </Button>
      </div>
    )
  }

  return (
    <Input
      type="password"
      placeholder="Enter API key..."
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        onChange(e.target.value)
      }}
      autoFocus={editing}
      disabled={disabled}
    />
  )
}
```

### T155 — SettingsForm component
**File**: `src/components/settings/SettingsForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LlmProviderSelector } from './LlmProviderSelector'
import { ApiKeyInput } from './ApiKeyInput'
import type { LlmProvider } from '@/lib/db/schema'

interface SettingsFormProps {
  initialSettings: {
    llmProvider: LlmProvider
    llmApiKeyConfigured: boolean
    confidenceThreshold: number
    autoLearnEnabled: boolean
  }
  isAdmin: boolean
}

export function SettingsForm({ initialSettings, isAdmin }: SettingsFormProps) {
  const [provider, setProvider] = useState(initialSettings.llmProvider)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { llmProvider: provider }
      if (apiKey) body.llmApiKey = apiKey

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      toast.success('LLM settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>LLM Provider Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>LLM Provider</Label>
          <LlmProviderSelector value={provider} onChange={setProvider} disabled={!isAdmin || saving} />
        </div>
        <div className="space-y-2">
          <Label>API Key</Label>
          <ApiKeyInput
            isConfigured={initialSettings.llmApiKeyConfigured}
            onChange={setApiKey}
            disabled={!isAdmin || saving}
          />
          {!isAdmin && <p className="text-xs text-muted-foreground">Only admins can update API keys.</p>}
        </div>
        {isAdmin && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

### LLM Settings Page (implied by nav tab)
**File**: `src/app/(auth)/settings/llm/page.tsx`

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsForm } from '@/components/settings/SettingsForm'

async function getSettings() {
  // Server-side fetch using absolute URL for internal API calls
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/settings`, {
      headers: { Cookie: '' },  // Note: will be auth-protected; use server action in real impl
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()).settings
  } catch {
    return null
  }
}

export default async function LlmSettingsPage() {
  // For Phase 8: render SettingsForm as a client component with placeholder defaults
  // Full server-side auth will require cookies forwarding or a server action pattern
  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">LLM Configuration</h1>
      <SettingsForm
        initialSettings={{
          llmProvider: 'claude',
          llmApiKeyConfigured: false,
          confidenceThreshold: 0.7,
          autoLearnEnabled: true,
        }}
        isAdmin={false}
      />
    </div>
  )
}
```

**Note on the page implementation**: The page is a simplified server component stub. The full implementation would use server actions or middleware to forward auth cookies. For Phase 8, the SettingsForm handles the API call client-side via PATCH, which properly uses the browser's session cookies.

**Verification**:
- `npx tsc --noEmit` — no TypeScript errors
- `grep -r "LlmProviderSelector\|ApiKeyInput\|SettingsForm" src/components/settings/` — all 3 exist

---

## Phase 8F: Final Verification

**Run all tests**:
```bash
npx vitest run
```
Expected: all existing 609 tests continue to pass + new tests from T146 and T147.

**TypeScript check**:
```bash
npm run type-check
```
Expected: 0 errors.

**Build check**:
```bash
npm run build
```
Expected: successful build, no errors.

**Anti-pattern grep checks**:
```bash
# Must NOT appear in API responses
grep -r "llmApiKeyEncrypted" src/app/api/settings/route.ts
# Should print only internal variable usage, not in JSON response

# Must appear in responses
grep "llmApiKeyConfigured" src/app/api/settings/route.ts
```

**Coverage spot check**:
```bash
npx vitest run --coverage tests/unit/services/encryption.test.ts
# Expected: 100% coverage of encryption.ts
```

---

## Task → File Mapping

| Task | File | Note |
|------|------|------|
| T146 | `tests/unit/services/encryption.test.ts` | Create |
| T147 | `tests/integration/api/settings.test.ts` | Create |
| T148 | `tests/e2e/llm-configuration.spec.ts` | Create |
| T149 | `src/lib/services/encryption.ts` | Create |
| T150 | `src/lib/ai/providers.ts` | Modify (add function) |
| T151 | `src/app/api/settings/route.ts` (GET) | Create |
| T152 | `src/app/api/settings/route.ts` (PATCH) | Same file as T151 |
| T153 | `src/components/settings/LlmProviderSelector.tsx` | Create |
| T154 | `src/components/settings/ApiKeyInput.tsx` | Create |
| T155 | `src/components/settings/SettingsForm.tsx` | Create |
| –    | `src/app/(auth)/settings/llm/page.tsx` | Create (implied by nav) |
| –    | `src/test/setup.ts` | Modify (add ENCRYPTION_KEY) |

## Execution Order

```
8A (T146, T147, T148) → 8B (T149) → 8C (T151+T152) → 8D (T150) → 8E (T153-T155+page) → 8F (verify)
```

Dependencies:
- T147 needs T149 mocked (mock in test, not real dep)
- T152 needs T149 (PATCH handler calls `encrypt`)
- T150 needs T149 (provider factory calls `decrypt`)
- T155 needs T153 + T154
- LLM page needs T155
