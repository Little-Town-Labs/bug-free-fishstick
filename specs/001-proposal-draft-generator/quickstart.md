# Quickstart: Proposal Draft Generator

**Branch**: `001-proposal-draft-generator` | **Date**: 2026-02-12

This guide walks a developer through understanding the proposal generation flow, running the new code paths locally, and verifying the feature works end-to-end.

---

## Prerequisites

- Development environment set up per the main [quickstart.md](../../quickstart.md)
- `.env.local` has `DATABASE_URL`, `ENCRYPTION_KEY`, and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- At least one RFP with status `processing` or beyond already loaded (has parsed fields)
- Inngest Dev Server running (see below)

---

## 1. Apply the Database Migration

After pulling the branch, generate and apply the new migration:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

This adds two new tables: `proposal_content_library` and `proposal_drafts`.

---

## 2. Start the Inngest Dev Server

The proposal generation runs as a background Inngest job. In a separate terminal:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Then start the Next.js dev server:

```bash
npm run dev
```

---

## 3. Add Proposal Content Library Entries

Navigate to **Content Library** in the app sidebar (or go to `/content-library`).

Add a few entries to populate the library before testing generation:

| Category | Name                    | Content                                      |
|----------|-------------------------|----------------------------------------------|
| Pricing  | Standard Hourly Rate    | Our standard rate is $150/hour for all roles |
| Service  | Cloud Hosting           | We provide managed AWS hosting with 99.9% SLA |
| Standard | ISO 27001 Certification | Our organization holds ISO 27001 certification |

---

## 4. Generate a Proposal Draft

1. Open an RFP that has been fully processed (status: `approved` or `finalized`).
2. Click **Generate Proposal** in the RFP detail view.
3. The system presents 3–10 clarifying questions. Answer them and click **Generate**.
4. The draft status shows `generating`. The Inngest dev server logs show the job running.
5. Refresh or wait for the UI to poll — when status reaches `draft`, the markdown appears.

---

## 5. Edit and Export

- Edit the proposal in the markdown editor on screen.
- Click **Save** to persist changes.
- Click **Export** to download `proposal-<rfp-name>.md`.

---

## 6. Running Tests

```bash
# All tests
npm test

# Only proposal-related tests
npm test -- --reporter=verbose proposal

# Specific test files
npm test tests/unit/agents/proposal-question-generator.test.ts
npm test tests/unit/agents/proposal-writer.test.ts
npm test tests/unit/services/proposal-draft.test.ts
npm test tests/unit/services/proposal-content-library.test.ts
npm test tests/integration/api/proposals.test.ts
npm test tests/integration/api/content-library.test.ts
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/db/schema/proposal-content-library.ts` | Drizzle schema for content library |
| `src/lib/db/schema/proposal-drafts.ts` | Drizzle schema for proposal drafts |
| `src/lib/services/proposal-content-library.ts` | CRUD service for content library entries |
| `src/lib/services/proposal-draft.ts` | Service for draft creation, status, and updates |
| `src/lib/ai/agents/proposal-question-generator.ts` | AI agent: generates clarifying questions |
| `src/lib/ai/agents/proposal-writer.ts` | AI agent: generates the full proposal markdown |
| `src/lib/inngest/functions/generate-proposal.ts` | Inngest background job for proposal generation |
| `src/app/api/content-library/route.ts` | GET + POST content library entries |
| `src/app/api/rfps/[rfpId]/proposals/route.ts` | GET + POST proposal drafts for an RFP |
| `src/app/api/rfps/[rfpId]/proposals/[draftId]/answers/route.ts` | POST clarifying answers |
| `src/app/api/rfps/[rfpId]/proposals/[draftId]/export/route.ts` | GET markdown download |
| `src/app/(auth)/rfps/[rfpId]/proposal/page.tsx` | Proposal wizard UI |
| `src/app/(auth)/content-library/page.tsx` | Content library management UI |

---

## Troubleshooting

**"RFP must be processed before generating a proposal"**
: The RFP's `parsedStructure` is null. Run the RFP through processing first.

**Draft stays in `generating` forever**
: Check the Inngest dev server terminal for job errors. The `generation_error` field on the draft will also contain the failure reason.

**No clarifying questions generated**
: Ensure the org has at least some knowledge base entries or the RFP has substantial text content. The question generator requires parseable RFP fields.
