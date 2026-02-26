# Implementation Plan — Feature 10: Coverage Report UI

## Architecture

```
ProposalWizardPage (step 4: Review)
  └── CoverageReportPanel (new)
        ├── ScoreBadge (score + color band)
        ├── RequirementsList
        │   └── RequirementRow (expandable, per requirement)
        ├── Re-check Button
        └── Timestamp display
```

## Implementation Phases

### Phase 1: CoverageReportPanel Component
- Single file `src/components/rfp/CoverageReportPanel.tsx`
- Props: `coverageReport`, `rfpId`, `draftId`, `onUpdated` callback
- Score badge with color bands
- Expandable requirements list
- Re-check button with loading state
- Timestamp display

### Phase 2: Wire into Proposal Page
- Import CoverageReportPanel in proposal page
- Pass draft.coverageReport, rfpId, draftId
- Handle onUpdated callback to refresh draft state

### Phase 3: Tests
- Unit tests for component rendering (score bands, empty state, requirement expansion)
- Test re-check button triggers fetch
- Test error handling

## Technology Choices
- shadcn/ui: Badge, Button, Card (existing)
- No new dependencies needed
- Tailwind for all styling
