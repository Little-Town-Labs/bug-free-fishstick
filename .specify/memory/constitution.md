# RFP Automator Constitution

> Guiding principles that govern all development decisions for this project.

## Core Principles

### I. Tenant Isolation is Non-Negotiable
Every data access must enforce tenant context. No shortcuts on multi-tenancy. All database queries, file operations, and API responses must be scoped to the authenticated tenant.

### II. Type Safety Everywhere
Python with strict type hints + mypy enforcement. TypeScript with strict mode enabled. No `any` types allowed. All function signatures must be fully typed.

### III. Explicit Over Implicit
Clear interfaces between agents, services, and API layers. No magic behavior. Dependencies are injected, not discovered. Configuration is explicit, not assumed.

### IV. Secure by Default
Encrypt sensitive data (API keys, PII) at rest and in transit. Validate all inputs at system boundaries. Audit all data access with user context. Secrets never appear in logs.

## Testing Standards

### V. 80% Coverage Minimum
All new code must meet or exceed the coverage threshold before merge. Coverage is measured per-module, not just globally. Untested code paths must be justified.

### VI. Test the Agents
AI agents must have deterministic test cases with mocked LLM responses. Agent behavior should be predictable given the same inputs. Test edge cases like timeouts and malformed responses.

### VII. Integration Tests for Workflows
The full RFP processing pipeline must have end-to-end tests. Test the complete flow: upload → parse → generate → review → export. Use realistic test fixtures from sample RFPs.

### VIII. Document Fidelity Tests
PDF/Word output must be visually verified against expected formatting. Overlay positioning must be pixel-accurate. Font rendering and checkbox states must match originals.

## User Experience Consistency

### IX. Progressive Disclosure
Show completion percentage and confidence scores to guide users. Don't overwhelm with AI internals or technical details. Surface complexity only when users need it.

### X. Human Always in Control
Users can accept, edit, or reject any AI suggestion. No forced automation. Every AI-generated response has an escape hatch. Users decide when to proceed.

### XI. Consistent Feedback Patterns
Loading states, error messages, and success indicators follow the same patterns throughout the application. Users should never wonder "did that work?"

### XII. Accessible First
WCAG 2.1 AA compliance for all UI components. Keyboard navigation works everywhere. Screen readers can access all content. Color is never the only indicator.

## Performance Requirements

### XIII. Sub-3-Second Document Parse
Initial RFP parsing should complete within 3 seconds for typical documents (<50 pages). Larger documents should show progress indicators. Parsing never blocks the UI.

### XIV. Streaming AI Responses
Show progress during agent processing. No frozen UI during long operations. Users see incremental updates as agents work. Cancel is always available.

### XV. Efficient Vector Search
Knowledge base queries must return in <500ms with proper indexing. Semantic search is only as useful as it is fast. Index maintenance runs in background.

### XVI. Graceful Degradation
If LLM providers are slow or unavailable, queue work and notify users rather than fail. Partial results are better than errors. The system remains usable even when AI is degraded.

## Governance

- Constitution supersedes all other development practices
- Amendments require documentation, team review, and migration plan
- All PRs must verify compliance with applicable principles
- Complexity must be justified against these principles

### Applying These Principles

When making development decisions, ask:

1. **Does this maintain tenant isolation?** (Principle I)
2. **Is this fully typed?** (Principle II)
3. **Is this behavior explicit and predictable?** (Principle III)
4. **Is sensitive data protected?** (Principle IV)
5. **Is this adequately tested?** (Principles V-VIII)
6. **Does this respect user control?** (Principles IX-XII)
7. **Does this meet performance targets?** (Principles XIII-XVI)

If the answer to any question is "no," revisit the approach.

**Version**: 1.0.0 | **Ratified**: 2026-02-03 | **Last Amended**: 2026-02-03
