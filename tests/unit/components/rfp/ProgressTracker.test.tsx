import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressTracker } from '@/components/rfp/ProgressTracker'

describe('ProgressTracker', () => {
  const baseProps = {
    totalFields: 10,
    completedFields: 5,
    automationPercentage: 60,
    status: 'draft' as const,
  }

  describe('rendering', () => {
    it('renders the progress tracker container', () => {
      render(<ProgressTracker {...baseProps} />)
      expect(screen.getByTestId('progress-tracker')).toBeInTheDocument()
    })

    it('shows field completion count', () => {
      render(<ProgressTracker {...baseProps} />)
      expect(screen.getByText('5 / 10 fields completed')).toBeInTheDocument()
    })

    it('shows automation percentage', () => {
      render(<ProgressTracker {...baseProps} automationPercentage={75} />)
      expect(screen.getByText('75% auto-filled')).toBeInTheDocument()
    })
  })

  describe('status badge', () => {
    it.each([
      ['uploaded', 'Uploaded'],
      ['processing', 'Processing'],
      ['draft', 'Draft'],
      ['review', 'In Review'],
      ['approved', 'Approved'],
      ['completed', 'Completed'],
    ] as const)('shows %s status as %s', (status, label) => {
      render(<ProgressTracker {...baseProps} status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('progress bar', () => {
    it('shows progress bar with correct width percentage', () => {
      render(<ProgressTracker {...baseProps} totalFields={10} completedFields={5} />)
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveStyle({ width: '50%' })
      expect(bar).toHaveAttribute('aria-valuenow', '50')
    })

    it('shows 0% width when no fields completed', () => {
      render(<ProgressTracker {...baseProps} completedFields={0} />)
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveStyle({ width: '0%' })
    })

    it('shows 100% width when all fields completed', () => {
      render(<ProgressTracker {...baseProps} completedFields={10} />)
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveStyle({ width: '100%' })
    })

    it('shows 0% when totalFields is 0', () => {
      render(<ProgressTracker {...baseProps} totalFields={0} completedFields={0} />)
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveStyle({ width: '0%' })
    })
  })
})
