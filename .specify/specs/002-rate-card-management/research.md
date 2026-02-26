# Technology Research: Rate Card Management

**Feature:** F2 — `002-rate-card-management`
**Date:** 2026-02-25

---

## Decision 1: API Route Architecture

**Context:** Should this be a dedicated sub-resource route or extend the existing `PATCH /api/settings`?

**Options Considered:**

1. **Extend `/api/settings`** — Add `rateCard` and `proposalDefaults` fields to the existing settings PATCH
   - Pros: No new files, consistent with current route structure
   - Cons: The existing route uses individual SQL UPDATE statements per field (not Drizzle ORM abstraction). Adding JSONB objects to that pattern would make it unwieldy. The existing route already has auth logic that could be DRY-violated. Rate card is a distinct resource domain.

2. **Dedicated `/api/settings/rate-card` route** — New file following Next.js App Router conventions
   - Pros: Matches roadmap spec, clean separation of concerns, aligns with existing sub-resource pattern (`/api/settings/integrations`), enables future independent versioning, cleaner tests
   - Cons: One extra file

**Chosen:** Option 2 — Dedicated sub-resource
**Rationale:** The integrations feature already established the sub-resource pattern under `/api/settings/`. The rate card has its own validation complexity (cross-field refinements, JSONB write). A dedicated route keeps both resources testable in isolation.

---

## Decision 2: Form State Management Strategy

**Context:** The rate card form is complex — mode toggle, dynamic role list, dynamic discount list, reordering. What state management approach fits the existing codebase?

**Options Considered:**

1. **Local React state + `useState`/`useReducer`** — No external state library
   - Pros: Zero new dependencies, consistent with all existing settings forms (SettingsForm, CrmConfigForm all use local state), simple mental model
   - Cons: Prop drilling for deeply nested role/discount sub-forms

2. **React Hook Form** — Form library with validation
   - Pros: Built-in validation, field arrays, good TypeScript support, `useFieldArray` for dynamic lists
   - Cons: New dependency (not currently in the project), adds bundle weight, overkill if not used elsewhere

3. **Zustand or Jotai** — Global state store
   - Pros: Avoids prop drilling
   - Cons: Settings form is page-scoped, global store adds unnecessary complexity, introduces new dependency

**Chosen:** Option 1 — Local React state with `useReducer` for the rate card form
**Rationale:** All existing settings components use local state. `useReducer` handles the mode toggle and list mutations cleanly without external dependencies. Form complexity is manageable because the roles and discounts are flat arrays, not deeply nested trees.

---

## Decision 3: Schema Amendment — `blendedRateUnit`

**Context:** The F1 `RateCard` TypeScript interface and Zod schema have `blendedRate: number | null` but no `blendedRateUnit`. The spec (US-002) requires the admin to select a unit (hour/day/fixed) for blended mode. This is a gap in the F1 data model.

**Options Considered:**

1. **Add `blendedRateUnit` field** — Minor F1 amendment within F2 scope
   - Pros: Correct data model, matches spec requirement, clean pricing engine input
   - Cons: Minor touch to F1 files (schema, TypeScript type, Zod schema, tests)

2. **Infer unit from first role** — In blended mode, store a dummy role with the unit
   - Pros: No schema change
   - Cons: Semantically wrong, confusing, brittle

3. **Default to 'hour'** — Blended mode is always hourly
   - Pros: No schema change
   - Cons: Loses information, prevents day-rate suppliers from using blended mode correctly

**Chosen:** Option 1 — Add `blendedRateUnit: 'hour' | 'day' | 'fixed'` (nullable, required when mode is blended)
**Rationale:** The correct fix for a schema gap is to fix the schema. The amendment is minimal (one field in the TypeScript interface, one field in the Zod schema, one additional test case). No migration needed — the existing JSONB column already holds arbitrary JSON; adding a new key is non-breaking.
**Schema amendment scope:** `src/lib/db/schema/tenant-settings.ts` (TypeScript `RateCard` interface) + `src/lib/utils/validation.ts` (`rateCardSchema`) + validation tests

---

## Decision 4: Optimistic UI vs. Server-First Save

**Context:** Should the settings form update the UI immediately (optimistic) or wait for server confirmation?

**Options Considered:**

1. **Optimistic update** — UI reflects save immediately, roll back on error
   - Pros: Snappier feel
   - Cons: Rollback logic is complex for nested structures; rate card errors from cross-field validation are hard to present after an optimistic update

2. **Server-first save** — Show a loading state, apply update after 200 OK
   - Pros: Simple, consistent with existing SettingsForm behavior (it awaits the fetch before updating state), errors are immediately available for display

**Chosen:** Option 2 — Server-first
**Rationale:** Existing settings components all use server-first saves. Rate card validation has complex cross-field rules that are best surfaced in a single 422 response after the server confirms. The 2-second P90 NFR is achievable without optimistic updates.

---

## Decision 5: Service Layer Extraction

**Context:** Should rate card DB operations go directly in the route handler or be extracted to a service?

**Options Considered:**

1. **Inline DB in route handler** — As done in `src/app/api/settings/route.ts` (original pattern)
   - Pros: Less code
   - Cons: Makes route handler harder to unit-test; the existing settings route is already considered a known debt (its raw SQL calls bypass Drizzle's type safety)

2. **Service layer** — Extract to `src/lib/services/rate-card.ts`
   - Pros: Consistent with newer patterns (`listIntegrationConfigs` service), testable in isolation, enables F5 (pricing engine) to import the same service if it needs to read the rate card
   - Cons: One extra file

**Chosen:** Option 2 — Service layer at `src/lib/services/rate-card.ts`
**Rationale:** The integrations feature introduced the service layer pattern. F5 will need to read the rate card; a shared service avoids duplicate DB queries. Route handlers stay thin and testable.
