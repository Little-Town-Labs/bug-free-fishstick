# Data Model — Feature 9

## Schema Changes

**None.** All required schema already exists from F1:
- `proposal_drafts.coverageReport` — JSONB column with `CoverageReport` type
- `CoverageReport` interface — `{ coverageScore, evaluatedAt, requirements[] }`
- `CoverageRequirement` interface — `{ requirementId, question, addressed, evidence, gap }`

## Tables Used (Read-Only)

| Table | Usage | Fields |
|-------|-------|--------|
| `proposal_drafts` | Read draft markdown + write coverage report | `markdownContent`, `coverageReport`, `organizationId` |
| `rfps` | Read parsed requirements | `parsedStructure.fields[]`, `organizationId` |
| `proposal_templates` | Read evaluateCoverage flag | `evaluateCoverage`, `title`, `content` |

## Internal Types

### CoverageCheckerInput
```typescript
{
  requirements: Array<{ id: string; question: string }>
  proposalMarkdown: string
  evaluateCoverageTemplates: Array<{ title: string; content: string }>
  organizationId: string
}
```

### CoverageCheckerOutput (from LLM via generateObject)
```typescript
{
  requirements: Array<{
    requirementId: string
    addressed: boolean
    evidence: string | null
    gap: string | null
  }>
}
```

Note: `coverageScore` and `evaluatedAt` are computed in application code, not by the LLM.

## Function Signatures

### Agent
```typescript
export async function checkCoverage(input: CoverageCheckerInput): Promise<CoverageReport>
```

### Pipeline Integration
```typescript
// Replace generateCoverageReportStub(rfp) with:
import { checkCoverage } from '@/lib/ai/agents/proposal-coverage-checker'
```
