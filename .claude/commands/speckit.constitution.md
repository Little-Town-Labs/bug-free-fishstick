---
description: View or update the project constitution with new principles or amendments.
handoffs:
  - label: Build Specification
    agent: speckit.specify
    prompt: Implement the feature specification based on the updated constitution. I want to build...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

The project constitution at `.specify/memory/constitution.md` defines the guiding principles for all development decisions. This command helps you view, update, or amend it.

## Execution Flow

1. **Read the current constitution** at `.specify/memory/constitution.md`.

2. **Determine the action**:
   - If user input is empty or asks to "view/show", display the current constitution and summarize key principles.
   - If user input requests changes, proceed to step 3.

3. **Apply requested changes**:
   - Add, modify, or remove principles as requested.
   - Preserve the existing structure and formatting.
   - Keep principle descriptions clear and actionable.

4. **Update version** (if changes made):
   - Increment the patch version for clarifications/wording changes.
   - Increment the minor version for new principles or expanded guidance.
   - Increment the major version for principle removals or fundamental changes.
   - Update `Last Amended` date to today.

5. **Write changes** back to `.specify/memory/constitution.md`.

6. **Summarize** what was changed and the new version number.

## Guidelines

- Principles should be declarative and testable.
- Avoid vague language—use MUST/SHOULD where appropriate.
- Keep principles focused on outcomes, not process.
- Don't over-engineer governance—this is a living document.

## What This Command Does NOT Do

- Automatically propagate changes to other templates (do this manually if needed)
- Generate sync impact reports
- Require approval workflows

The constitution is a guide, not a bureaucratic checkpoint.
