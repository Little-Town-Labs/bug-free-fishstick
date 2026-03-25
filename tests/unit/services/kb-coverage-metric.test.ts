import { describe, it, expect } from 'vitest'
import { computeKbCoveragePercentage } from '@/lib/services/kb-coverage-metric'

describe('computeKbCoveragePercentage', () => {
  it('returns 80% when 8 of 10 sections have KB sources', () => {
    const markdown = `# Proposal

## Section 1
> *Source: Company Overview*
Content here.

## Section 2
> *Source: Technical Spec*
Content here.

## Section 3
> *Source: No knowledge base match — consider uploading relevant content*
Content here.

## Section 4
> *Source: Past RFP Win*
Content here.

## Section 5
> *Source: ISO Certification*
Content here.

## Section 6
> *Source: Case Study: Acme*
Content here.

## Section 7
> *Source: Team Bios*
Content here.

## Section 8
> *Source: No knowledge base match — consider uploading relevant content*
Content here.

## Section 9
> *Source: Methodology Doc*
Content here.

## Section 10
> *Source: SLA Template*
Content here.`

    expect(computeKbCoveragePercentage(markdown)).toBe(80)
  })

  it('returns 0% when no sections have KB matches', () => {
    const markdown = `# Proposal

## Section 1
> *Source: No knowledge base match — consider uploading relevant content*

## Section 2
> *Source: No knowledge base match — consider uploading relevant content*`

    expect(computeKbCoveragePercentage(markdown)).toBe(0)
  })

  it('returns 100% when all sections have KB matches', () => {
    const markdown = `# Proposal

## Requirements
> *Source: Company Profile*
We are a leading provider.

## Technical
> *Source: Technical Docs*
Our approach uses modern tech.`

    expect(computeKbCoveragePercentage(markdown)).toBe(100)
  })

  it('returns 0 for markdown with no sections', () => {
    expect(computeKbCoveragePercentage('Just some text')).toBe(0)
  })

  it('returns 0 for empty markdown', () => {
    expect(computeKbCoveragePercentage('')).toBe(0)
  })
})
