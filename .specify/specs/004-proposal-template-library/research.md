# Technology Research — 004-proposal-template-library

## Decision 1: Drag-and-Drop vs. Up/Down Arrows for Reordering

**Context:** Templates within a section must be reorderable. Three library options were considered.

**Options:**

| Option | Bundle Impact | React 19 Support | Dev Effort | Accessibility |
|--------|---------------|------------------|------------|---------------|
| `@dnd-kit/sortable` | ~13 KB gzipped | ✅ Confirmed | Medium (DndContext, SortableContext, useSortable per item) | Manual ARIA required |
| `@hello-pangea/dnd` | ~30 KB gzipped | ⚠️ Not validated for React 19 | Low (Droppable/Draggable wrappers) | Known StrictMode issues |
| Up/Down arrow buttons | 0 KB | N/A | Low | Native keyboard support |

**Decision: Up/Down arrow buttons (no library)**

**Rationale:** The template library is an infrequently-used admin settings screen, not a high-frequency interaction surface. The existing codebase has no drag-and-drop library. Adding one for a settings page introduces bundle cost without proportionate UX benefit. Up/down arrows are WCAG-compliant out of the box (keyboard navigable, no custom ARIA needed).

**Tradeoffs:** Lower visual polish than drag-and-drop; does not support arbitrary reordering in one gesture (requires multiple clicks to move a template many positions).

**Migration Path:** If drag-and-drop is required in future, `@dnd-kit/sortable` is the preferred choice. The reducer's action shape (`REORDER_OPTIMISTIC`, `REORDER_ROLLBACK`) is pre-designed for this migration.

---

## Decision 2: State Management in the UI

**Context:** The template list UI has complex interaction state: open/close dialog, which template is being edited, delete confirmation target, optimistic updates, loading states.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| `useState` (scattered) | Simple for small forms | Proliferates to 8+ state variables; cross-field `isRequired → evaluateCoverage` coupling becomes fragile |
| `useReducer` (parent) | Single state atom, explicit action dispatch, rollback-friendly | Slightly more boilerplate |
| Zustand/Jotai (external store) | Good for global state | Over-engineered for one settings section |

**Decision: useReducer in `ProposalTemplateLibrary` (root component)**

**Rationale:** Matches the `RateCardForm.tsx` pattern already established in this codebase. The `isRequired → evaluateCoverage` constraint enforcement is cleaner in a reducer action than a `useEffect`. Optimistic updates and rollbacks are straightforward with a reducer. The form's internal field state uses a second local `useReducer` inside `TemplateFormDialog`, keeping the parent reducer lean.

**Tradeoffs:** More boilerplate than `useState`; requires a dedicated reducer file.

---

## Decision 3: API Response Shape — Flat vs. Grouped

**Context:** The GET list endpoint could return a flat array or a grouped-by-section object.

**Options:**

| Option | API Payload | Client Complexity |
|--------|-------------|-------------------|
| Flat array sorted by section + sortOrder | Simple, cacheable | Client performs one `reduce` to group for rendering |
| Grouped object `{ assumptions: [...], ... }` | Larger, fixed structure | No client-side transform needed; but key ordering depends on server |

**Decision: Flat array from API; grouped in client-side selector**

**Rationale:** REST APIs conventionally return flat collections. The grouping is a presentational concern. A flat array is easier to cache, paginate in future, and process in the pipeline (Feature 8 does not need grouping). The client's `getTemplatesBySection(templates)` selector is a cheap in-memory reduce over at most a few dozen items. The service layer also exposes `listProposalTemplatesBySection` for callers that prefer the grouped form.

---

## Decision 4: Trigger Tag Input for RFP Types

**Context:** `triggerRfpTypes` is a bounded set (derived from the RFP classifier enum). `triggerIndustryTags` is unbounded free text.

**Options for rfpType input:**

| Option | UX | Dev Effort |
|--------|-----|------------|
| Plain text entry (same as industry tags) | Inconsistent, error-prone | Low |
| shadcn Select (single-value) | Clean but only one selection | Low |
| shadcn Combobox (Command + Popover) | Multi-select from list | Medium |

**Decision: Combobox (Command + Popover) for rfpTypes; free-text tag entry for industryTags**

**Rationale:** Using a select-from-list for the bounded set prevents typos and ensures values match what the pipeline comparison logic expects. Free-text entry is appropriate for industry tags since the set is unbounded. Both share a `TriggerTagInput` component with `options` prop controlling the mode.

---

## Decision 5: Section Field — Immutable After Creation

**Context:** Should admins be able to move a template from one section to another after it is created?

**Options:**
1. Allow section change on PATCH (any field can change)
2. Section is immutable; delete-and-recreate is the migration path

**Decision: Section is immutable after creation**

**Rationale:** Section type affects output ordering logic and template grouping in the pipeline. Allowing section mutation in-place risks orphaned sort orders and ambiguous pipeline behavior. The UI does not expose section as an editable field in the edit modal; the PATCH schema excludes `section`. If an admin genuinely needs to move a template, they delete it and create a new one — this is acceptable for an infrequently-modified settings screen.

---

## Decision 6: Reorder Transaction Pattern

**Context:** Updating `sortOrder` for multiple templates must be atomic.

**Options:**
1. Individual PATCH calls per template (non-atomic)
2. `db.transaction()` with N individual UPDATEs
3. Raw SQL with `UPDATE ... SET sort_order = CASE WHEN id = $1 THEN $v1 ...`

**Decision: `db.transaction()` with N individual UPDATEs (Option 2)**

**Rationale:** Drizzle 0.45 does not expose a native CASE expression builder for variable-length batch updates. A raw SQL CASE expression is possible but fragile and hard to parameterize safely. The transaction loop approach is N round-trips on a single connection, which is acceptable for lists of 5–30 templates per section. The atomicity guarantee means either all positions update or none do — consistent with EC-3 in the spec.

**Neon driver note:** Drizzle transactions require the WebSocket driver (`@neondatabase/serverless` with `neonConfig.webSocketConstructor`), not the HTTP driver. The existing codebase uses the WebSocket path for Inngest functions — confirm the same client is used in the API route handler.

---

## Validation Library: Zod (existing)

No new library decision needed. Zod is already used for all API validation in this project. The `createProposalTemplateSchema` will include a `.refine()` to enforce `!(isRequired && evaluateCoverage)`. The update schema enforces this at the service layer (post-merge check) rather than in the Zod schema alone, since a partial PATCH might set only one of the two fields.
