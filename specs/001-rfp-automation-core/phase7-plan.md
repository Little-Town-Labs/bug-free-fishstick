# Phase 7 Implementation Plan: US5 - Manage Users and Permissions

**Feature**: 001-rfp-automation-core
**Phase**: 7 of 9
**User Story**: US5 - Manage Users and Permissions
**Priority**: P2
**Tasks**: T136–T145 (10 tasks)

---

## Phase 0: Documentation Discovery (Completed)

### Allowed APIs & Confirmed Patterns

**Sources consulted**:
- `specs/001-rfp-automation-core/spec.md:77-90` — US5 acceptance criteria
- `specs/001-rfp-automation-core/tasks.md:306-335` — 10 implementation tasks
- `rfp-prd.md:56-82` — Role hierarchy and permission matrix
- `src/lib/utils/auth.ts` — Existing auth utilities (read in full)
- `src/app/api/rfps/route.ts` — Existing API pattern (read in full)
- `src/lib/db/schema/rfps.ts` — rfps schema with `assignedUserId` field (read in full)
- `tests/integration/api/rfps.test.ts:1-70` — Vitest mock patterns
- `tests/e2e/approval-workflow.spec.ts` — E2E test pattern
- `src/components/rfp/ApprovalActions.tsx` — Existing component pattern
- `package.json` — Tech stack confirmation

### Confirmed Auth APIs (Clerk + existing code)

```typescript
// src/lib/utils/auth.ts — COPY FROM HERE
import { auth } from '@clerk/nextjs/server'

// Returns: { userId: string, orgId: string, orgRole: string }
// orgRole values: 'org:admin' | 'org:member' (Clerk default)
const { userId, orgId, orgRole } = await auth()

export async function requireAuth(): Promise<AuthContext>     // throws AuthError(401)
export async function requireAdmin(): Promise<AuthContext>    // throws AuthError(403)
export function isAdmin(orgRole: string): boolean             // orgRole === 'org:admin'
```

**Anti-pattern**: There is NO `requireUser()` helper — use `requireAuth()` + check role manually for User-level access.

### Confirmed Schema Facts

- `rfps.assignedUserId` — `text('assigned_user_id').notNull()` — already in schema (no migration needed)
- No `users` table exists in our DB — Clerk manages all user data externally
- User invitation is handled entirely by Clerk Organizations API — no DB schema changes needed

### Role Model (from rfp-prd.md:58-81)

| Role | Clerk orgRole | Can see RFPs |
|------|--------------|--------------|
| Admin | `org:admin` | All RFPs in tenant |
| User | `org:member` | Only assigned RFPs (`assignedUserId === userId`) |

### Vitest Mock Pattern (copy from `tests/integration/api/rfps.test.ts:1-43`)

```typescript
vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  AuthError: class AuthError extends Error { ... },
  isAdmin: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(...), update: vi.fn(...) } }))
```

### Anti-Patterns to Avoid

- **DO NOT** create a `users` table in the DB — Clerk owns user data
- **DO NOT** invent a `clerkClient.invitations.create()` — Clerk's server SDK uses `clerkClient().organizations.createOrganizationInvitation()`
- **DO NOT** store user roles in our DB — roles come from Clerk's `auth()` response
- **DO NOT** use `table._.name` (Drizzle 0.45+) — use `getTableName(table)` if needed

---

## Phase 7A: Tests First (TDD Red Phase)

**Goal**: Write failing tests for T136–T137. These must fail before any implementation.

**Self-contained context**: Copy mock patterns from `tests/integration/api/rfps.test.ts:1-43`.

### T136 — Integration tests for role-based RFP filtering

**File**: `tests/integration/api/rfp-permissions.test.ts` (NEW FILE)

**What to test** (from spec.md:85-89 + rfp-prd.md:63-64):

1. **Admin sees all RFPs**: When `orgRole = 'org:admin'`, GET /api/rfps returns all tenant RFPs regardless of `assignedUserId`
2. **User sees only assigned**: When `orgRole = 'org:member'`, GET /api/rfps returns only RFPs where `assignedUserId === userId`
3. **Tenant isolation**: User cannot see RFPs from another org even if `assignedUserId` matches
4. **Assignment update — admin only**: PUT /api/rfps/:id with `assignedUserId` field succeeds for admin, returns 403 for `org:member`
5. **Auth required**: GET /api/rfps returns 401 when unauthenticated

**Copy mock pattern from**: `tests/integration/api/rfps.test.ts:1-43`
**Import pattern**: `import { GET as listRfps } from '@/app/api/rfps/route'`
**Import pattern**: `import { PUT as updateRfp } from '@/app/api/rfps/[rfpId]/route'`

### T137 — E2E test for user management workflow

**File**: `tests/e2e/user-management.spec.ts` (NEW FILE)

**Copy E2E pattern from**: `tests/e2e/approval-workflow.spec.ts`

**What to test** (from spec.md:87-89):
1. Settings page renders user management section at `/settings/users`
2. User invite form is visible to admins
3. Role selector component renders with Admin/User options
4. RFP assignment component renders on RFP detail page

**Note**: Full E2E requires a running app with Clerk credentials. Follow the same graceful skip pattern used in `tests/e2e/approval-workflow.spec.ts:13-16`.

### Verification (Red Phase)

```bash
npm test -- tests/integration/api/rfp-permissions.test.ts
# EXPECTED: FAIL - modules not found or assertions fail
npm test -- tests/e2e/user-management.spec.ts
# EXPECTED: FAIL or skip
```

---

## Phase 7B: UI Components

**Goal**: Implement T138–T141 — four UI components for user management and RFP assignment.

**Self-contained context**: Copy component patterns from `src/components/rfp/ApprovalActions.tsx`.

### T138 — UserInviteForm component

**File**: `src/components/settings/UserInviteForm.tsx` (NEW FILE, new directory)

**What it renders**:
- Form with email input field + role selector (Admin / User)
- Submit button "Send Invitation"
- Uses `react-hook-form` + `zod` validation (copy pattern from any existing form in `src/components/rfp/`)
- `onSubmit` calls POST `/api/users/invite` (to be created in Phase 7C)
- Shows `sonner` toast on success/error (import from `sonner`, see package.json)
- `data-testid="user-invite-form"` on the form element

**Props interface**:
```typescript
interface UserInviteFormProps {
  onSuccess?: () => void
}
```

**Zod schema**:
```typescript
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['org:admin', 'org:member']),
})
```

### T139 — UserList component

**File**: `src/components/settings/UserList.tsx` (NEW FILE)

**What it renders**:
- Table/list of org members: name, email, role badge, joined date
- Data fetched via GET `/api/users` (to be created in Phase 7C)
- Loading skeleton state
- Empty state message
- `data-testid="user-list"` on the container

**Props interface**:
```typescript
interface UserMember {
  userId: string
  email: string
  firstName?: string
  lastName?: string
  orgRole: string
  joinedAt: string
}

interface UserListProps {
  members: UserMember[]
  isLoading?: boolean
  onRoleChange?: (userId: string, newRole: string) => void
}
```

### T140 — RoleSelector component

**File**: `src/components/settings/RoleSelector.tsx` (NEW FILE)

**What it renders**:
- `<select>` or shadcn/ui `<Select>` with two options: "Admin" (`org:admin`) and "User" (`org:member`)
- `data-testid="role-selector"` on the container

**Props interface**:
```typescript
interface RoleSelectorProps {
  value: 'org:admin' | 'org:member'
  onChange: (role: 'org:admin' | 'org:member') => void
  disabled?: boolean
}
```

### T141 — RfpAssignment component

**File**: `src/components/rfp/RfpAssignment.tsx` (NEW FILE)

**What it renders**:
- Shows current assignee name/email
- Admin-only: dropdown to reassign to any org member
- Non-admin: read-only display
- Calls PUT `/api/rfps/:rfpId` with `{ assignedUserId }` on change
- `data-testid="rfp-assignment"` on the container

**Props interface**:
```typescript
interface RfpAssignmentProps {
  rfpId: string
  currentAssigneeId: string
  isAdmin: boolean
  members: UserMember[]
  onAssignmentChange?: (newUserId: string) => void
}
```

### Verification

```bash
npm run type-check
npm test -- --testPathPattern="components/settings"
```

---

## Phase 7C: Pages

**Goal**: Implement T142–T143 — two settings pages.

**Self-contained context**: Read `src/app/(auth)/dashboard/page.tsx` for the App Router page pattern. Settings directory does not exist yet — create it.

### T142 — Settings page

**File**: `src/app/(auth)/settings/page.tsx` (NEW FILE, new directory)

**What it renders**:
- Page title "Settings"
- Navigation tabs: "General" | "Users" | "LLM Configuration" (stubbed)
- Default tab: "General" with placeholder content
- `<Link href="/settings/users">` or shadcn Tabs component

**Auth**: Uses server component pattern with `requireAdmin()` for admin-only settings features. Regular users can see general settings but not user management tab.

### T143 — Users management tab page

**File**: `src/app/(auth)/settings/users/page.tsx` (NEW FILE)

**What it renders**:
- Page title "User Management"
- Calls GET `/api/users` to get member list
- Renders `<UserList members={...} />`
- Admin-only: renders `<UserInviteForm />` above the list
- Non-admin: shows 403 / redirect to settings

**Auth**: Server component, call `requireAdmin()`. Redirect to `/settings` if not admin.

**Note**: Data fetching pattern — use `fetch()` server-side or direct Clerk SDK call. Follow pattern from existing dashboard page.

### Verification

```bash
npm run build
# Check no TypeScript errors on new pages
npm run type-check
```

---

## Phase 7D: API Routes

**Goal**: Implement T144–T145 — role-based filtering and RFP assignment API.

**Self-contained context**: Copy handler pattern from `src/app/api/rfps/route.ts` (the full file is 56 lines).

### T144 — Role-based filtering in RFP list API

**File**: `src/app/api/rfps/route.ts` (MODIFY EXISTING)

**Current behavior** (line 7-23): Returns all org RFPs filtered only by `organizationId`.

**New behavior**:
- Admin (`orgRole === 'org:admin'`): same as before — all tenant RFPs
- User (`orgRole === 'org:member'`): add `AND assigned_user_id = userId` filter

```typescript
// Pattern to add after const auth = await requireAuth()
import { and, eq } from 'drizzle-orm'

const whereClause = isAdmin(auth.orgRole)
  ? eq(rfps.organizationId, auth.orgId)
  : and(
      eq(rfps.organizationId, auth.orgId),
      eq(rfps.assignedUserId, auth.userId)
    )

const rfpsList = await db.select().from(rfps).where(whereClause)
```

**Import**: `isAdmin` is already exported from `src/lib/utils/auth.ts`
**Import**: `and` from `drizzle-orm` (already used across codebase)

### T145 — RFP assignment update endpoint

**File**: `src/app/api/rfps/[rfpId]/route.ts` (MODIFY EXISTING PUT handler)

**What to add**: Allow admin to update `assignedUserId` on an RFP.

```typescript
// In PUT handler, after requireAuth():
if (body.assignedUserId !== undefined) {
  if (!isAdmin(auth.orgRole)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  updateFields.assignedUserId = body.assignedUserId
}
```

**Additionally**: Create `src/app/api/users/route.ts` (NEW FILE) to support UserInviteForm and UserList:
- `GET /api/users` — returns list of org members via Clerk SDK
- `POST /api/users/invite` — creates org invitation via Clerk SDK

**Clerk SDK pattern for listing org members**:
```typescript
import { clerkClient } from '@clerk/nextjs/server'
const client = await clerkClient()
const memberships = await client.organizations.getOrganizationMembershipList({
  organizationId: auth.orgId,
})
```

**Clerk SDK pattern for inviting users**:
```typescript
const invitation = await client.organizations.createOrganizationInvitation({
  organizationId: auth.orgId,
  emailAddress: body.email,
  role: body.role, // 'org:admin' | 'org:member'
  redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-in`,
})
```

**Anti-pattern**: Do NOT use `clerkClient.invitations.create()` — this is NOT the correct API. Use `organizations.createOrganizationInvitation()`.

### Verification

```bash
npm test -- tests/integration/api/rfp-permissions.test.ts
# EXPECTED: PASS (green phase)
npm run type-check
```

---

## Phase 7E: Final Verification

**Goal**: All tests pass, TypeScript clean, E2E smoke passes.

### Verification Checklist

1. **All 10 tasks implemented**: T136–T145
2. **Test suite**:
   ```bash
   npm test
   # All tests pass (expect 620+ tests with new additions)
   ```
3. **TypeScript**:
   ```bash
   npm run type-check
   # Zero errors
   ```
4. **Build**:
   ```bash
   npm run build
   # Successful build, no errors
   ```
5. **E2E smoke**:
   ```bash
   npm run test:e2e -- tests/e2e/user-management.spec.ts
   ```

### Anti-Pattern Grep Checks

```bash
# Ensure no 'table._.name' usage (Drizzle anti-pattern)
grep -r '\._.name' src/

# Ensure no hardcoded role strings besides org:admin and org:member
grep -r 'role.*admin\|role.*member' src/ | grep -v 'org:admin\|org:member'

# Ensure no any types in new files
grep -n ': any' src/components/settings/ src/app/(auth)/settings/ src/app/api/users/
```

### Acceptance Criteria (from spec.md:85-89)

- [ ] Admin invites user by email → user receives invitation with User role
- [ ] User (`org:member`) sees only their assigned RFPs on dashboard
- [ ] Admin (`org:admin`) sees all RFPs in tenant

---

## File Creation Summary

| File | Action | Task |
|------|--------|------|
| `tests/integration/api/rfp-permissions.test.ts` | CREATE | T136 |
| `tests/e2e/user-management.spec.ts` | CREATE | T137 |
| `src/components/settings/UserInviteForm.tsx` | CREATE | T138 |
| `src/components/settings/UserList.tsx` | CREATE | T139 |
| `src/components/settings/RoleSelector.tsx` | CREATE | T140 |
| `src/components/rfp/RfpAssignment.tsx` | CREATE | T141 |
| `src/app/(auth)/settings/page.tsx` | CREATE | T142 |
| `src/app/(auth)/settings/users/page.tsx` | CREATE | T143 |
| `src/app/api/rfps/route.ts` | MODIFY | T144 |
| `src/app/api/rfps/[rfpId]/route.ts` | MODIFY | T145 |
| `src/app/api/users/route.ts` | CREATE | T144/T145 support |

**No DB migrations needed** — `rfps.assignedUserId` already exists in schema.

---

## Key Constraints (from MEMORY.md)

- Node 18.19.1 — no Node 20+ APIs
- Vitest v2.x — import from `vitest`, not `vitest/node`
- `getTableName(table)` not `table._.name` (Drizzle 0.45+)
- CSS disabled in vitest config — no CSS imports in test files
- Use `sonner` for toasts, NOT shadcn/ui `toast` (deprecated)
- All schema types from `@/lib/db/schema/` — never redefine locally
