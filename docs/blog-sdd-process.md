# The Part of AI-Assisted Development Nobody Does: Auditing the Spec Before Writing Code

## Seven Documents, Zero Code

We'd just finished the planning phase for a new feature. There were seven artifacts sitting in a directory: a project constitution, a feature specification, a technical plan, a task breakdown, a data model, API contracts, and a research document with four documented decisions.

Not a single line of implementation code had been written yet.

Most teams would look at that pile and say "great, let's start building." We did something different. We ran every document against every other document, checking for gaps, contradictions, and drift. The whole thing took about ten minutes. It caught nothing this time, which is the point. When it does catch something, it saves days.

Here's how the audit works and why it matters more than you'd think.

## What a Cross-Artifact Analysis Actually Checks

The analysis has seven distinct checks. Each one answers a specific question about whether your documents agree with each other.

**Constitutional compliance.** Every project starts with a constitution, a short set of principles that don't change. Ours has sixteen. Things like "tenant isolation is non-negotiable" and "80% test coverage minimum" and "human always in control." The audit walks through each principle and checks whether the plan violates any of them. If the plan proposes something that conflicts with a principle, it has to either change the approach or document an explicit exception with justification.

For this feature, all sixteen principles were addressed. No exceptions needed. That's not always the case. We've had features where the plan initially violated a performance principle and had to be reworked before any code was written, which is exactly the kind of thing you want to catch early.

**Spec-to-plan traceability.** The specification defines WHAT to build from the user's perspective: user stories, functional requirements, non-functional requirements, edge cases. The plan defines HOW to build it technically. This check verifies that every single spec requirement maps to at least one section in the plan.

We had 16 requirements across those categories. All 16 traced to specific plan sections. When this check fails, it usually means a non-functional requirement (performance, accessibility, migration safety) got dropped during planning because the focus was on the functional stuff. It's easy to spec "retrieval must complete in under 100ms" and then forget to include that constraint anywhere in the plan.

**Plan-to-tasks coverage.** The plan describes components and phases. The tasks break those into actual work items. This check verifies that every component in the plan has corresponding tasks, and that no plan section was skipped in the breakdown.

We had 14 plan components. All 14 had tasks. The most common failure here is quality gates getting dropped. The plan says "run a security review after the API changes" but nobody creates a task for it, so it never happens.

**Data model consistency.** The data model document describes schema changes, indexes, constraints, and query patterns. This check verifies that column names, types, and constraints match across the spec, plan, and data model. It also checks that the TypeScript property naming follows the project's conventions (in our case, snake_case in SQL, camelCase in TypeScript).

This is where naming drift shows up. You'll write `section_type` in the data model, `sectionType` in the plan, and then accidentally reference `type` in the task descriptions. In our codebase, the Drizzle ORM convention maps between these automatically, so `section_type` in the database and `sectionType` in TypeScript is correct. But the audit has to understand that convention to not flag it as an inconsistency.

**API contract validation.** The contracts document describes what changes to each endpoint. This check verifies that every user story requiring an API interaction has a corresponding endpoint change documented, and that the contracts match what the plan says they should do.

For our feature, we had changes to four endpoints. The audit verified each one: a GET that now performs initialization, a PATCH that guards certain fields on certain row types, a DELETE that blocks deletion of certain rows, and a POST that validates against known category names. Each mapped to a spec requirement.

**Cross-artifact naming.** This is the simplest check but catches real problems. It scans for terminology that should be consistent and flags mismatches. If the spec calls something "fixed sections" and the plan calls them "system sections" and the tasks call them "predefined sections," that's going to cause confusion during implementation, especially when you're working with AI that takes names literally.

Everything was consistent in our case. Six words: "fixed sections" everywhere.

**Dependency chain validation.** The tasks have a dependency graph: task A.1 must finish before A.2 can start, tasks C and D can run in parallel after B completes, etc. This check verifies there are no circular dependencies, no missing links, and no tasks that claim to be parallel when they actually share a dependency.

We verified the full graph. One subtlety worth calling out: some of our test-writing tasks (in the retrieval phase) listed dependencies on the schema tasks but not the service layer tasks. That's correct because the tests mock the service layer, so they only need the schema types to compile. The audit had to reason about that distinction rather than blindly requiring every downstream task to depend on every upstream task.

## Why This Catches Things That Reviews Don't

Code review catches problems in code. Spec review catches problems in specs. But neither one catches problems *between* documents. The cross-artifact analysis exists specifically to find the gaps where one document promises something that another document doesn't deliver.

Here's a real example from a different feature (not this one). The spec required "all new data must be tenant-isolated, verified by tests." The plan described the data model and API routes. The task breakdown had implementation tasks for the model and routes. But nobody had created a task specifically for writing tenant isolation tests. The implementation tasks had acceptance criteria like "query works correctly" but not "query enforces tenant scope." The analysis caught that gap. A task was added. The tests were written. They found a query that was missing the `organizationId` filter.

That's a security bug that would have shipped if we'd skipped the analysis and gone straight to implementation.

## The Boring Part That Makes It Work

The analysis itself is not exciting. It's a checklist. Constitutional compliance: check each principle. Spec-to-plan: trace each requirement. Plan-to-tasks: trace each component. Data model: verify names and constraints. Contracts: verify endpoints. Naming: scan for mismatches. Dependencies: validate the graph.

It takes about ten minutes for a medium-sized feature. It produces a report that's mostly green checkmarks. The value isn't in the report itself; it's in the structural guarantee that nothing fell through the cracks between "what we said we'd build" and "what we're actually about to build."

The temptation is always to skip it. You just wrote the spec, then the plan, then the tasks. Of course they're consistent. You wrote them in order. Except they're not always consistent, because each phase focuses on a different concern. The spec focuses on user needs. The plan focuses on technical approach. The tasks focus on execution order. Each one can drift from the others in subtle ways that only show up when you force yourself to check the connections.

## What the Report Looks Like

For this feature, the final report was clean:

| Category | Result |
|---|---|
| Constitutional compliance | All principles addressed, no exceptions |
| Spec-to-plan alignment | 16 of 16 requirements covered |
| Plan-to-tasks coverage | 14 of 14 components covered |
| Data model consistency | Consistent across all artifacts |
| API contracts | Aligned with spec and plan |
| Naming consistency | No mismatches |
| Dependency chain | Valid, no circular dependencies |

Zero critical issues. Zero high issues. Zero medium issues. Ready for implementation.

That's the goal. Not a clean report for its own sake, but confidence that when the AI (or a human) sits down to write code, every decision has already been made, documented, and cross-checked. The implementation phase becomes execution, not discovery.

## Making This Practical

If you're thinking "that's a lot of documents for one feature," you're right. It is. But consider the alternative: you write the code, find inconsistencies during code review, rewrite parts of the implementation, discover an edge case that requires rethinking the data model, update the tests, review again. That cycle is longer, more expensive, and catches problems later when they're harder to fix.

The analysis phase is the cheapest place to find problems. No code has been written. No tests need updating. No deployments need rolling back. You're just reading documents and checking connections. The cost of finding a gap here is updating a markdown file. The cost of finding it in production is an incident.

Three things make this work in practice:

First, keep the artifacts short. Our spec was about 230 lines. The plan was about 300. The tasks were about 200. These aren't enterprise architecture documents. They're focused descriptions of one feature.

Second, make the analysis mandatory. Put it in the workflow between "tasks created" and "implementation started." If the team knows they can skip it, they will. If it's a required gate, it becomes habit.

Third, accept that most runs will be clean. That's fine. The value is in the runs that aren't. One caught tenant isolation gap is worth fifty clean reports.
