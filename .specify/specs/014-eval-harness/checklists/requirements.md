# Requirements Quality Checklist — 014-eval-harness

## Content Quality
- [x] No implementation details in specification (no framework/library names in FRs; schema names appear only in clarifications as options)
- [x] Requirements written from user/system perspective
- [x] Technology-agnostic language used in FR/NFR sections

## Completeness
- [x] All user stories (US1–US6) have at least 3 acceptance scenarios (US3 has 4, US6 has 3, etc.)
- [x] Edge cases documented (10 edge cases covering empty drafts, oversize drafts, malformed judge output, missing golden set, rubric deprecation, placeholder false-positives, multi-currency pricing, stale baselines, archived citations, rate-limited judges)
- [x] Error handling specified (judge failures → quorum logic; batch failures isolated; insufficient data → explicit message)

## Testability
- [x] All FRs are measurable or directly observable (pass/fail gates, numeric dimension scores, quorum counts)
- [x] Acceptance scenarios use Given/When/Then with concrete inputs and outputs
- [x] Success criteria are numeric where possible (SC-001 to SC-008)

## Spec-Kit Rules
- [x] ≤ 3 `[NEEDS CLARIFICATION]` markers present (exactly 3: judge providers, golden-set size, persistence location)
- [x] Each clarification offers options with a recommendation
- [x] User stories prioritized P1–P3 with independence rationale
- [x] Each user story can be delivered and tested independently

## Constitutional Alignment
- [x] Tenant isolation called out explicitly (FR-028, NFR-005)
- [x] Type safety is an implementation concern — not mandated in spec, deferred to plan phase
- [x] Explicit configuration over implicit behavior (rubrics versioned, councils snapshotted)
- [x] Security by default (encrypted caches, redacted logs, admin-gated rubric/council writes)
- [x] Testing standards satisfied — the feature itself is testing infrastructure
- [x] User control preserved (rubric-weight suggestions do not auto-apply — FR per US6)

## Open Risks
- [ ] Cost ceiling for council calls on batch/golden-set runs — needs budget guardrail in plan phase
- [ ] Provider nondeterminism even at temperature=0 may push beyond SC-005 tolerance on some models — verify empirically during plan phase
- [ ] Placeholder-false-positive heuristic needs a concrete algorithm choice in plan phase
