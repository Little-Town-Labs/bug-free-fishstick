# Phase 5 Implementation Plan — Polish

_Generated after documentation discovery. All findings cite specific files and line numbers._

---

## Phase 0 — Discovery Summary

### Files Consulted
| File | Lines | Key Finding |
|---|---|---|
| `specs/…/tasks.md` | 129–133 | T036–T039 exact task text |
| `src/components/rfp/ProposalDraftPanel.tsx` | 153–155 | Error state: bare `<span>`, no ARIA, no Retry button |
| `src/components/rfp/ClarifyingQuestionsForm.tsx` | 68–90 | Dangling `aria-describedby` — span has no `id` |
| `src/components/content-library/ContentLibraryForm.tsx` | 69–162 | FULLY COMPLIANT — all ARIA present |
| `src/components/rfp/ResponseCard.tsx` | 86–91, 111–117 | `tabIndex={0}`, `aria-label` on container and textarea |
| `src/components/rfp/RfpEditor.tsx` | 167–178, 196–200, 211–215 | `role="status"`, `aria-live`, `role="alert"` patterns |
| `tests/integration/inngest/generate-proposal.test.ts` | 1–177 | `mockContentLibraryEntries` + `threeCallSequence` exist; `writeProposal` called with `contentLibraryEntries` |
| `src/lib/inngest/functions/generate-proposal.ts` | 65–79 | `writeProposal({ rfpSections, knowledgeContext, contentLibraryEntries, clarifyingAnswers, organizationId })` |

### Allowed APIs / Patterns

**ARIA patterns (copy from these):**

- Error alert: `RfpEditor.tsx:211–215` — `<div role="alert" data-testid="save-error" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">...</div>`
- Live status: `RfpEditor.tsx:196–200` — `<span role="status" aria-live="polite">...</span>`
- Container label: `ResponseCard.tsx:86–91` — `tabIndex={0} aria-label={...}`

**writeProposal signature** (from `generate-proposal.ts:65–79`):
```ts
writeProposal({
  rfpSections,
  knowledgeContext,
  contentLibraryEntries: contentLibraryEntries.map(e => ({ id, name, category, content })),
  clarifyingAnswers,
  organizationId,
})
```

**Test mock pattern** (from `generate-proposal.test.ts`):
```ts
// threeCallSequence: draft, rfp, library entries
const threeCallSequence = (libraryRows = mockContentLibraryEntries) => mockSelectSequence([
  { type: 'limited', rows: [mockDraft] },
  { type: 'limited', rows: [mockRfp] },
  { type: 'multi', rows: libraryRows },
])
```

### Anti-Patterns to Avoid
- Do NOT use `authMiddleware()` — deprecated (use `clerkMiddleware()`)
- Do NOT add `aria-describedby` pointing to a non-existent `id`
- Do NOT add `role="alert"` to a `<span>` — use a block element (`<div>` or `<p>`)
- Do NOT use `vi.fn()` in top-level variables inside `vi.mock()` factories — hoisting issue

---

## Phase 1 — T036: Fix ARIA in ClarifyingQuestionsForm [P]

**Status:** ClarifyingQuestionsForm has one bug; ContentLibraryForm and ProposalEditor are already compliant.

### What to implement

**File:** `src/components/rfp/ClarifyingQuestionsForm.tsx`

**Problem:** Each `<Textarea>` has `aria-describedby={`q-${q.id}-section`}` (line 83) but the `<span>` displaying the section name (lines 68–73) has `aria-label` but NO `id`. The `aria-describedby` target is a dangling reference.

**Fix:** Add `id={`q-${q.id}-section`}` to the section `<span>` at line 68.

**Before (line 68):**
```tsx
<span
  aria-label={`Section: ${q.rfpSection}`}
  className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
>
```

**After:**
```tsx
<span
  id={`q-${q.id}-section`}
  aria-label={`Section: ${q.rfpSection}`}
  className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
>
```

### Verification checklist
- [ ] `grep 'aria-describedby' src/components/rfp/ClarifyingQuestionsForm.tsx` — confirms `q-${q.id}-section` is referenced
- [ ] `grep 'id={`q-' src/components/rfp/ClarifyingQuestionsForm.tsx` — confirms the span now has that `id`
- [ ] TypeScript: `npx tsc --noEmit` exits 0
- [ ] Tests: `npx vitest run` exits 0 (no new failures)

---

## Phase 2 — T037: Error State + Retry in ProposalDraftPanel [P]

**File:** `src/components/rfp/ProposalDraftPanel.tsx`

### What to implement

**Problem (lines 153–155):** Error display is a bare `<span>` with no ARIA and no "Retry" button:
```tsx
{draft.status === 'error' && draft.generationError && (
  <span className="text-xs text-red-600">{draft.generationError}</span>
)}
```

**Changes needed in the draft list item (lines 153–175):**

1. Replace `<span>` with a `role="alert"` block — copy from `RfpEditor.tsx:211–215`:
```tsx
{draft.status === 'error' && draft.generationError && (
  <p role="alert" className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
    {draft.generationError}
  </p>
)}
```

2. Add "Retry" button inside the `<div className="flex items-center gap-2">` (lines 158–176), alongside the existing Cancel button. The Retry button should only appear when `draft.status === 'error'`:
```tsx
{draft.status === 'error' && (
  <Button
    variant="outline"
    size="sm"
    disabled={retrying}
    onClick={() => handleRetry()}
    aria-label={`Retry generating draft v${draft.version}`}
  >
    {retrying ? 'Retrying…' : 'Retry'}
  </Button>
)}
```

3. Add `retrying` state and `handleRetry` function at the top of the component:
```tsx
const [retrying, setRetrying] = useState(false)

async function handleRetry() {
  setRetrying(true)
  try {
    const res = await fetch(`/api/rfps/${rfpId}/proposals`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to retry')
      return
    }
    const data = await res.json()
    // Add new draft to list and replace the failed one
    setDraftsList((prev) => [data.draft, ...prev])
  } catch {
    toast.error('Failed to retry')
  } finally {
    setRetrying(false)
  }
}
```

Note: `toast` is already imported (check existing imports at top of file). `useState` and `Button` are already imported.

### Verification checklist
- [ ] `grep 'role="alert"' src/components/rfp/ProposalDraftPanel.tsx` — confirms alert role
- [ ] `grep 'handleRetry' src/components/rfp/ProposalDraftPanel.tsx` — confirms retry handler
- [ ] `grep 'aria-label.*Retry' src/components/rfp/ProposalDraftPanel.tsx` — confirms ARIA label
- [ ] TypeScript: `npx tsc --noEmit` exits 0
- [ ] Tests: `npx vitest run` exits 0

---

## Phase 3 — T038: Integration Smoke Test

**File:** `tests/integration/inngest/generate-proposal.test.ts`

### What to implement

Extend the existing `describe('success path')` block with one new test. The infrastructure is already in place — `mockContentLibraryEntries` (line 74–76) and `threeCallSequence` (line 110–114) already exist.

**Add inside `describe('success path', () => {` after the last existing `it()`:**

```ts
it('should pass content library entries to writeProposal', async () => {
  threeCallSequence(mockContentLibraryEntries)
  vi.mocked(writeProposal).mockResolvedValue({ markdownContent: mockMarkdown })
  vi.mocked(updateDraftContent).mockResolvedValue({ ...mockDraft, status: 'draft', markdownContent: mockMarkdown } as any)

  const step = createMockStep()
  const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

  await (generateProposal as unknown as Function)({ event, step })

  // Verify content library entries are forwarded to the proposal writer
  expect(writeProposal).toHaveBeenCalledWith(
    expect.objectContaining({
      contentLibraryEntries: expect.arrayContaining([
        expect.objectContaining({
          id: 'cl-1',
          name: 'Standard Rate',
          category: 'Pricing',
          content: '$150/hr',
        }),
      ]),
    })
  )
})
```

Also add a test verifying empty library works (no regression):
```ts
it('should call writeProposal with empty contentLibraryEntries when library is empty', async () => {
  threeCallSequence([])
  vi.mocked(writeProposal).mockResolvedValue({ markdownContent: mockMarkdown })
  vi.mocked(updateDraftContent).mockResolvedValue({ ...mockDraft, status: 'draft' } as any)

  const step = createMockStep()
  const event = createMockEvent({ draftId: 'draft-1', rfpId: 'rfp-1', organizationId: 'org-1' })

  await (generateProposal as unknown as Function)({ event, step })

  expect(writeProposal).toHaveBeenCalledWith(
    expect.objectContaining({ contentLibraryEntries: [] })
  )
})
```

### Verification checklist
- [ ] `npx vitest run tests/integration/inngest/generate-proposal.test.ts` — all tests pass including 2 new ones
- [ ] No TypeScript errors in the test file

---

## Phase 4 — T039: Quickstart Validation

**File to read:** `specs/001-proposal-draft-generator/quickstart.md`

### What to implement

This is a **manual validation task**. Run through `quickstart.md` step by step, following the instructions for:
1. Applying the Drizzle migration
2. Starting the Inngest dev server
3. Adding 3 content library entries
4. Generating a proposal end-to-end
5. Editing the draft in ProposalEditor
6. Exporting the `.md` file

Document any issues found — if anything fails, create a bug report inline in this plan or in a new file `specs/001-proposal-draft-generator/quickstart-issues.md`.

If no issues are found, mark T039 as complete in `tasks.md`.

---

## Final Verification Phase

After all four tasks are done:

```bash
# TypeScript clean build
npx tsc --noEmit

# Full test suite
npx vitest run

# Specific checks
grep 'role="alert"' src/components/rfp/ProposalDraftPanel.tsx
grep 'id={`q-' src/components/rfp/ClarifyingQuestionsForm.tsx
grep 'handleRetry' src/components/rfp/ProposalDraftPanel.tsx
grep 'contentLibraryEntries' tests/integration/inngest/generate-proposal.test.ts
```

Expected: 870+ tests (866 baseline + 2 new integration tests), 0 TypeScript errors, all ARIA greps find matches.

### tasks.md updates
Change `- [ ] T036`, `- [ ] T037`, `- [ ] T038`, `- [ ] T039` to `- [X]` after each task completes.
