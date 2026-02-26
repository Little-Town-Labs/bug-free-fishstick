# Technology Research — 003-company-profile

**Feature:** Company Profile
**Branch:** 003-company-profile

---

## Decision 1: Markdown Rendering Library

**Context:** The live preview pane must render markdown text as HTML inside the React component.

**Options Considered:**

### Option A: `marked`
- **Bundle size:** ~25 KB minified (~8 KB gzipped)
- **API:** Synchronous `marked(text)` → HTML string; use with `dangerouslySetInnerHTML`
- **Maintenance:** Active, v14+ available, Battle-tested
- **Security:** Does not sanitize by default — requires `DOMPurify` for XSS prevention if rendering user-controlled content in a browser
- **Pros:** Minimal API, fast, no React dependency
- **Cons:** Must pair with sanitizer; `dangerouslySetInnerHTML` pattern

### Option B: `react-markdown`
- **Bundle size:** ~40 KB (plus `remark` peer dependencies)
- **API:** `<ReactMarkdown>{text}</ReactMarkdown>` — outputs React elements (no `dangerouslySetInnerHTML`)
- **Maintenance:** Active, widely used in React ecosystem
- **Security:** Sanitizes by default (no raw HTML injection)
- **Pros:** Idiomatic React; safe by default; no XSS risk
- **Cons:** Larger dependency graph (remark, rehype plugins)

### Option C: No library — regex rendering
- **Bundle size:** 0 KB
- **Coverage:** Bold, italic, headings, line breaks only
- **Cons:** Brittle, incomplete, will need replacing

**Chosen:** `react-markdown`
**Rationale:**
- Profile text is admin-controlled but rendered to all org members — safe-by-default rendering removes XSS surface entirely without needing an explicit sanitization step
- React element output integrates cleanly with the component tree (no `dangerouslySetInnerHTML`)
- Idiomatic in the React 19 / Next.js 15 ecosystem
- Slightly larger bundle is acceptable given this is a settings page (not a hot render path)

**Tradeoffs Accepted:**
- Larger dependency graph vs `marked` + DOMPurify
- Async-compatible rendering vs synchronous `marked` string API

**Package to add:**
```bash
npm install react-markdown
```
No `@types` needed (package ships its own types).

---

## Decision 2: State Management in CompanyProfileForm

**Context:** The form manages profile text, loading, saving, error, and success states.

**Options Considered:**

### Option A: `useState` (6 independent fields)
- Clear, minimal code
- Appropriate for simple forms with no interdependent state transitions
- Matches `CustomerSettingsForm` pattern in codebase

### Option B: `useReducer`
- Better for complex state machines with many interdependent transitions
- Used in `RateCardForm` due to mode toggles, role arrays, discount arrays
- Overkill for a single-field form

**Chosen:** `useState` (6 separate state variables)
**Rationale:** Single-field form with no conditional mode switching; all state updates are independent. `useReducer` would add boilerplate for no benefit.

---

## Decision 3: API Authentication Boundary for GET

**Context:** spec.md FR-4 says "authenticated non-admin members may read the profile." The rate-card GET was admin-gated as a security fix (sensitive pricing data). Company profile is marketing/identity content — not commercially sensitive.

**Options Considered:**

### Option A: Admin-only GET (same as rate-card)
- Maximum restriction
- Inconsistent with spec FR-4
- Non-admins can't see what context is in proposals

### Option B: Authenticated-member GET (as specified)
- Any org member can read
- Aligned with FR-4 and US4
- Non-admins can verify what's in proposals (transparency)

**Chosen:** Option B — `requireAuth()` for GET, `requireAdmin()` for PATCH
**Rationale:** Company profile is shared organizational identity content, not sensitive financial data. The spec explicitly calls this out as a low-priority user story (US4) for non-admin read access. Admin-gating the GET would violate FR-4.

---

## Decision 4: Null vs Empty String Semantics

**Context:** The database column is nullable. Should `null` and `""` be distinct?

**Chosen:** Both are valid and semantically distinct:
- `null` = never been set
- `""` = explicitly cleared

**Rationale:** Allows UI to differentiate between "first time setup" (null) and "intentionally blank" (""). The proposal pipeline treats both as empty (omits the section) per FR-5/EC-8.
