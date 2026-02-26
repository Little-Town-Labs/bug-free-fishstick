# Requirements Quality Checklist: Scope Clarifying Questions

**Feature:** F6 — `006-scope-clarifying-questions`
**Spec:** `.specify/specs/006-scope-clarifying-questions/spec.md`

---

## Content Quality

- [x] No implementation details in specification (no framework names, no function signatures, no module paths)
- [x] Requirements written from user perspective
- [x] Technology-agnostic language used throughout
- [x] All user stories describe WHAT and WHY, not HOW

## Completeness

- [x] All user stories have 3+ acceptance criteria
- [x] Functional requirements enumerated (FR-001 through FR-016)
- [x] Non-functional requirements enumerated (NFR-001 through NFR-006)
- [x] Edge cases documented (no pricing model, no rate card, LLM duplicate, question count ceiling, no structured fields, settings read failure)
- [x] Out-of-scope items listed explicitly
- [x] Error handling described

## Testability

- [x] All requirements are measurable and verifiable
- [x] Acceptance criteria are specific (three mandatory IDs, three distinct pricing model phrasings, total cap of 10)
- [x] Success metrics defined
- [x] NFR-004 and NFR-005 explicitly require mocked-LLM unit tests

## PRD Traceability

- [x] US4 from PRD §5 covered by US-001 through US-006
- [x] All four acceptance criteria from PRD US4 are addressed:
  - "always include at least one question requesting deliverables and estimated hours" → FR-001, US-001
  - "at least one question asks what is explicitly excluded" → FR-002, US-002
  - "at least one question asks for target delivery timeline" → FR-003, US-004
  - "pricing model question adapts based on proposalDefaults.pricingModel" → FR-005/FR-006/FR-007, US-003
- [x] PRD requirement "Answers to pricing questions are structured enough for the computation engine to parse" → FR-014 (stable question IDs)
- [x] Roadmap gate "Pricing question wording adapts correctly to pricing model" reflected in FR-005/FR-006/FR-007 and US-003 acceptance criteria

## Constitutional Compliance

- [x] **Principle I (Tenant Isolation):** Pricing model is read per-organization (FR-010, FR-015); no cross-tenant data access
- [x] **Principle II (Type Safety):** NFR-003 requires full typing; no `any` types
- [x] **Principle III (Explicit Over Implicit):** Mandatory question IDs are constants (Decision 2); behavior is predictable and not magic
- [x] **Principle IV (Secure by Default):** Pricing model from settings is configuration, not user input; prompt injection risk addressed in NFR-002
- [x] **Principle V (80% Coverage):** NFR-004/NFR-005 require unit tests covering mandatory injection and all pricing variants
- [x] **Principle VI (Test the Agents):** NFR-004 requires mocked LLM tests; NFR-006 requires testability without real LLM
- [x] **Principle X (Human Always in Control):** Questions are presented to preparer for review before answers are entered; no automation bypasses human input step
- [x] **Principle XVI (Graceful Degradation):** FR-008 and FR-016 specify fallback to T&M when pricing model absent or settings read fails

## Clarifications Status

- [x] No unresolved `[NEEDS CLARIFICATION]` markers
- [x] All four design decisions documented with rationale in spec.md
- [x] Decisions traceable to specific functional requirements
