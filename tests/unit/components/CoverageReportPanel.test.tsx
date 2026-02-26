import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CoverageReportPanel } from '@/components/rfp/CoverageReportPanel'
import type { CoverageReport } from '@/lib/db/schema/proposal-drafts'

const mockReport: CoverageReport = {
  coverageScore: 75,
  evaluatedAt: new Date().toISOString(),
  requirements: [
    { requirementId: 'f1', question: 'Company background?', addressed: true, evidence: 'Acme Corp is a leading provider.', gap: null },
    { requirementId: 'f2', question: 'Security certifications?', addressed: false, evidence: null, gap: 'Not addressed in proposal' },
    { requirementId: 'template:Payment Terms', question: 'Does the proposal include content for: Payment Terms?', addressed: true, evidence: 'Net 30', gap: null },
  ],
}

const defaultProps = {
  coverageReport: mockReport,
  rfpId: 'rfp-1',
  draftId: 'draft-1',
  onUpdated: vi.fn(),
}

describe('CoverageReportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders score badge with amber color for 75%', () => {
    render(<CoverageReportPanel {...defaultProps} />)
    expect(screen.getByText('75%')).toBeDefined()
    const badge = screen.getByText('75%')
    expect(badge.className).toContain('amber')
  })

  it('renders green badge for score >= 80', () => {
    render(<CoverageReportPanel {...defaultProps} coverageReport={{ ...mockReport, coverageScore: 85 }} />)
    const badge = screen.getByText('85%')
    expect(badge.className).toContain('green')
  })

  it('renders red badge for score < 60', () => {
    render(<CoverageReportPanel {...defaultProps} coverageReport={{ ...mockReport, coverageScore: 40 }} />)
    const badge = screen.getByText('40%')
    expect(badge.className).toContain('red')
  })

  it('renders "Not yet evaluated" when coverageReport is null', () => {
    render(<CoverageReportPanel {...defaultProps} coverageReport={null} />)
    expect(screen.getByText(/Not yet evaluated/)).toBeDefined()
    expect(screen.getByText('Check Coverage')).toBeDefined()
  })

  it('renders requirement rows with addressed/gap icons', () => {
    render(<CoverageReportPanel {...defaultProps} />)
    expect(screen.getByText('Company background?')).toBeDefined()
    expect(screen.getByText('Security certifications?')).toBeDefined()
  })

  it('shows evidence when expanding an addressed requirement', async () => {
    render(<CoverageReportPanel {...defaultProps} />)
    const button = screen.getByText('Company background?').closest('button')!
    fireEvent.click(button)
    expect(screen.getByText(/Acme Corp is a leading provider/)).toBeDefined()
  })

  it('shows gap when expanding an unaddressed requirement', async () => {
    render(<CoverageReportPanel {...defaultProps} />)
    const button = screen.getByText('Security certifications?').closest('button')!
    fireEvent.click(button)
    expect(screen.getByText(/Not addressed in proposal/)).toBeDefined()
  })

  it('shows "Supplier Terms" label for template requirements', () => {
    render(<CoverageReportPanel {...defaultProps} />)
    expect(screen.getByText('Supplier Terms')).toBeDefined()
  })

  it('triggers re-check API call when button clicked', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ ...mockReport, coverageScore: 90 }),
    }
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response)

    render(<CoverageReportPanel {...defaultProps} />)
    const recheckBtn = screen.getByText('Re-check')
    fireEvent.click(recheckBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/rfps/rfp-1/proposals/draft-1/coverage',
        { method: 'POST' },
      )
    })
  })

  it('calls onUpdated with new report after successful re-check', async () => {
    const newReport = { ...mockReport, coverageScore: 90 }
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(newReport),
    } as Response)

    render(<CoverageReportPanel {...defaultProps} />)
    fireEvent.click(screen.getByText('Re-check'))

    await waitFor(() => {
      expect(defaultProps.onUpdated).toHaveBeenCalledWith(newReport)
    })
  })

  it('shows loading state during re-check', async () => {
    let resolvePromise: (value: unknown) => void
    const pending = new Promise((resolve) => { resolvePromise = resolve })
    vi.mocked(global.fetch).mockReturnValue(pending as Promise<Response>)

    render(<CoverageReportPanel {...defaultProps} />)
    fireEvent.click(screen.getByText('Re-check'))

    expect(screen.getByText('Checking…')).toBeDefined()

    resolvePromise!({
      ok: true,
      json: () => Promise.resolve(mockReport),
    })
  })

  it('displays timestamp', () => {
    render(<CoverageReportPanel {...defaultProps} />)
    // Should show "Just now" or similar since evaluatedAt is ~now
    expect(screen.getByText(/now|minute|hour/i)).toBeDefined()
  })

  it('shows addressed count summary', () => {
    render(<CoverageReportPanel {...defaultProps} />)
    expect(screen.getByText(/2 of 3 requirements addressed/)).toBeDefined()
  })
})
