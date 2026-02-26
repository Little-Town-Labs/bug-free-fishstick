# Data Model — F8: Revised Proposal Pipeline

**Feature:** F8 — Revised Proposal Pipeline
**Date:** 2026-02-26

---

## No New Database Tables

F8 introduces no new database tables. All schema changes were delivered in F1 (`001-data-model-foundation`). F8 reads from and writes to existing tables.

---

## Tables Read (unchanged schema)

### `proposal_drafts`
| Field | Type | F8 Usage |
|---|---|---|
| `id` | uuid | Step 1: fetch by draftId + organizationId |
| `rfpId` | uuid | Step 1: used to fetch RFP |
| `organizationId` | text | All steps: tenant isolation |
| `clarifyingQuestions` | `jsonb<ClarifyingQuestion[]>` | Step 7: scope line parser reads `scope-deliverables` answer |
| `status` | text | Error path: set to `'error'` on failure |
| `markdownContent` | text | Step 11: written with final markdown |
| `coverageReport` | `jsonb<CoverageReport>` | Step 11: written with stub coverage report |

### `rfps`
| Field | Type | F8 Usage |
|---|---|---|
| `id` | uuid | Step 1: fetch by rfpId + organizationId |
| `organizationId` | text | Step 1: tenant isolation |
| `customerId` | uuid | Step 2: passed to `fetchCustomerContext` |
| `parsedStructure` | `jsonb` | Step 3: fields array passed to `searchByRequirements` |
| `rfpType` | text | Steps 4, 6: passed to `fetchTypedSupplierContext` and template matching |
| `industryTags` | `jsonb<string[]>` | Steps 4, 6: passed to `fetchTypedSupplierContext` and template matching |
| `name` | text | Fallback when `parsedStructure` is null |

### `tenant_settings`
| Field | Type | F8 Usage |
|---|---|---|
| `organizationId` | text | PK: fetch by organizationId |
| `openaiApiKeyEncrypted` | text | Decrypted pre-steps for embeddings |
| `rateCard` | `jsonb<RateCard>` | Step 7: passed to `computePricingEstimate` |
| `proposalDefaults` | `jsonb<ProposalDefaults>` | Step 7: pricingModel passed to `computePricingEstimate` |
| `companyProfile` | text | Step 4: included in supplier context block |

### `proposal_templates`
| Field | Type | F8 Usage |
|---|---|---|
| `id` | uuid | Deduplication between required + situational |
| `organizationId` | text | Steps 5, 6: tenant isolation |
| `section` | text (enum) | Steps 5, 6, 10: canonical ordering |
| `title` | text | Step 10: injected as section heading |
| `content` | text | Step 10: injected verbatim |
| `isRequired` | boolean | Step 5: `WHERE is_required = true` |
| `triggerRfpTypes` | `jsonb<string[]>` | Step 6: TypeScript filter |
| `triggerIndustryTags` | `jsonb<string[]>` | Step 6: TypeScript filter |
| `evaluateCoverage` | boolean | Step 11: passed with coverage report metadata |
| `sortOrder` | integer | Steps 5, 6, 10: intra-section ordering |

### `knowledge_entries`
| Field | Type | F8 Usage |
|---|---|---|
| (all fields) | — | Steps 3, 4: via `searchByRequirements` and `fetchTypedSupplierContext` |

### `customers`
| Field | Type | F8 Usage |
|---|---|---|
| `id` | uuid | Step 2: fetch by rfp.customerId |
| `organizationId` | text | Step 2: tenant isolation |
| `settings` | `jsonb<CustomerSettings>` | Step 2: tone, industry, custom instructions |

### `learnings`
| Field | Type | F8 Usage |
|---|---|---|
| (all fields) | — | Step 4: via `fetchLearnings(orgId, customerId)` |

---

## In-Memory Types (new to F8)

### `ScopeLine` (internal, not exported)
Used by the scope line parser to carry partially-parsed data before building `ScopeLineItem[]`.

| Field | Type | Description |
|---|---|---|
| `description` | string | Extracted deliverable description |
| `role` | string \| null | Optional role name ("by Developer" pattern) |
| `quantity` | number | Numeric quantity extracted |
| `unit` | `'hour' \| 'day' \| 'fixed'` | Resolved from unit keyword |

This is an internal type used only by `scope-line-parser.ts`. It is not stored in the database.

### `InjectedTemplate` (internal, not exported)
Used in step 10 to carry a sorted template before markdown rendering.

| Field | Type | Description |
|---|---|---|
| `title` | string | Template title |
| `content` | string | Verbatim template body |
| `sectionIndex` | number | Index in `proposalTemplateSections` array |
| `sortOrder` | number | Template's `sortOrder` field |

---

## Function Signatures Affected

### Extended: `updateDraftContent` in `proposal-draft.ts`

```typescript
// Before:
export async function updateDraftContent(
  draftId: string,
  orgId: string,
  markdownContent: string,
): Promise<ProposalDraft>

// After (4th param optional — backward compatible):
export async function updateDraftContent(
  draftId: string,
  orgId: string,
  markdownContent: string,
  coverageReport?: CoverageReport,
): Promise<ProposalDraft>
```

The DB update gains `coverageReport` in the `set()` payload when the parameter is provided.

### Updated: `writeProposal` in `proposal-writer.ts`

```typescript
// Before:
export interface WriteProposalInput {
  rfpSections: Array<{ title: string; content: string }>
  knowledgeContext: Array<{ content: string; source: string }>
  contentLibraryEntries: Array<{ id: string; name: string; category: string; content: string; similarity?: number }>
  clarifyingAnswers: ClarifyingQuestion[]
  organizationId: string
}

// After:
export interface WriteProposalInput {
  rfpSections: Array<{ id: string; title: string; content: string }>
  requirementResults: KnowledgeEntryWithSimilarity[]
  supplierContext: TypedSupplierContext
  companyProfile: string | null
  customerContext: CustomerContext
  learnings: Learning[]
  pricingMarkdown: string
  clarifyingAnswers: ClarifyingQuestion[]
  organizationId: string
}
```
