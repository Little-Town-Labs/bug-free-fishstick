# RFP Automator Agent Instructions

Read `README.md`, `.specify/memory/constitution.md`, `.specify/roadmap.md`, and
the active feature artifacts before substantial work. Tenant isolation, strict
typing, human control, security, accessibility, and test requirements in the
constitution are non-negotiable.

Use the package manager and commands documented in `README.md` and
`package.json`. Never place Clerk, Neon, Vercel, Upstash, Inngest, OpenAI,
Anthropic, tenant, customer, or document secrets and payloads in Git or review
artifacts.

## Adaptive Delivery

- Classify work by greenfield/brownfield context, micro/feature/system scale,
  and routine/sensitive/production risk. Keep routine micro-fixes lightweight;
  features and system work follow the complete Spec Kit cycle.
- Sol owns planning, architecture, orchestration, integration, tenant/auth/data
  boundaries, sensitive or production mutation, and the final quality gate.
  Luna is the default lane for bounded routine implementation, tests, docs,
  diagnostics, reading, and review.
- Authentication, tenant isolation, database schemas or migrations, secrets,
  external integrations, customer documents, AI-provider data handling, and
  production work permit read-only Ringer analysis only unless Sol explicitly
  retains and executes the mutation.
- Brownfield feature/system work uses `codebase-memory-mcp` before planning and
  targeted source reads to verify graph conclusions.
- After `analyze`, use the installed `ringer-delivery` extension. Workers receive
  dependency-ready task IDs, disjoint owned paths, non-goals, and executable
  checks; they never commit, push, edit `.git`, widen scope, or update canonical
  task status.
- Allow at most one Luna remediation and one Sol delta review.
