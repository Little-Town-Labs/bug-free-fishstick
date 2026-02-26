# Requirements Quality Checklist: Pricing Computation Engine

**Feature:** F5 — `005-pricing-computation-engine`
**Spec:** `.specify/specs/005-pricing-computation-engine/spec.md`

---

## Content Quality

- [x] No implementation details in specification (no framework names, no SQL, no file names referenced as requirements)
- [x] Requirements written from user perspective
- [x] Technology-agnostic language used throughout
- [x] All user stories describe WHAT and WHY, not HOW

## Completeness

- [x] All user stories have 3+ acceptance criteria (minimum 5 per story)
- [x] Functional requirements enumerated (FR-001 through FR-021)
- [x] Non-functional requirements enumerated (NFR-001 through NFR-005)
- [x] Edge cases documented (rounding, role fallback, discount ordering, floor at zero, zero quantity, zero margin, missing currency)
- [x] Out-of-scope items listed explicitly
- [x] Error handling described (degradation behaviour for null rate card and empty scope)
- [x] Explicit test coverage requirements listed (Phase 2 gate requirement from roadmap)

## Testability

- [x] All requirements are measurable and verifiable
- [x] Acceptance criteria are specific and numeric where applicable ($33.33 × 3 = $99.99, 20% margin on $99.99 = $20.00)
- [x] Success metrics defined
- [x] Test scenarios enumerated by category (mode, model, discount, degradation, math edge cases)

## PRD Traceability

- [x] US5 from PRD §5 covered by US-001 through US-006
- [x] PRD §6.3 (PricingEstimate interface) reflected in FR-001 through FR-021
- [x] PRD §6.1 discount rules structure reflected in FR-009 through FR-012
- [x] Roadmap F5 deliverables (blended/by-role, discount, graceful degradation, formattedMarkdown, unit tests) all addressed
- [x] Phase 2 gate requirement ("Zero arithmetic errors") addressed via NFR-003 and Test Coverage Requirements section
- [x] Constitutional Principle III (Explicit over Implicit) upheld: pure function, stateless, no LLM arithmetic
- [x] Constitutional Principle XVI (Graceful Degradation) upheld: placeholder on missing inputs
- [x] Constitutional Principle V (80% Coverage Minimum) exceeded: ≥95% branch coverage required (NFR-003)

## Clarifications Status

- [x] No unresolved `[NEEDS CLARIFICATION]` markers

### Clarifications Resolved (documented in spec)

All design decisions were resolved using best-practice defaults without requiring user input:

1. **Rounding strategy** — Integer cent arithmetic chosen (multiply by 100, compute, divide). Industry-standard approach for monetary arithmetic in TypeScript. Documented in Edge Cases § Rounding Arithmetic.

2. **Discount cascading behaviour** — Non-cascading chosen: each discount's base is computed from the original `subtotal + marginAmount` reference, not from the net-after-previous-discounts. This matches common accounting practice and avoids ambiguity when discount order changes. Documented in Edge Cases § Discount Base and Order.

3. **Fixed discount exceeding total** — Floor at zero chosen: a negative total is never returned. A warning indicator is included in the return value. Documented in Edge Cases § Fixed Discounts Exceeding Total.
