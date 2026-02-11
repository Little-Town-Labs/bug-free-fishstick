import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkflowStatusBadge } from '@/components/rfp/WorkflowStatusBadge'
import type { RfpStatus } from '@/lib/db/schema/rfps'

describe('WorkflowStatusBadge', () => {
  describe('renders for all 5 statuses', () => {
    const statuses: Array<{ status: RfpStatus; label: string }> = [
      { status: 'draft', label: 'Draft' },
      { status: 'processing', label: 'Processing' },
      { status: 'submitted', label: 'Submitted' },
      { status: 'approved', label: 'Approved' },
      { status: 'finalized', label: 'Finalized' },
    ]

    for (const { status, label } of statuses) {
      it(`renders ${status} status with label "${label}"`, () => {
        render(<WorkflowStatusBadge status={status} />)
        expect(screen.getByTestId('workflow-status-badge')).toBeInTheDocument()
        expect(screen.getByTestId('workflow-status-label')).toHaveTextContent(label)
      })
    }
  })

  describe('Status colors', () => {
    it('draft uses gray styling', () => {
      render(<WorkflowStatusBadge status="draft" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('gray')
    })

    it('processing uses blue styling', () => {
      render(<WorkflowStatusBadge status="processing" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('blue')
    })

    it('submitted uses yellow styling', () => {
      render(<WorkflowStatusBadge status="submitted" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('yellow')
    })

    it('approved uses green styling', () => {
      render(<WorkflowStatusBadge status="approved" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('green')
    })

    it('finalized uses purple styling', () => {
      render(<WorkflowStatusBadge status="finalized" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('purple')
    })
  })

  describe('Size prop', () => {
    it('renders with default size', () => {
      render(<WorkflowStatusBadge status="draft" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('text-sm')
    })

    it('renders with size="sm"', () => {
      render(<WorkflowStatusBadge status="draft" size="sm" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('text-xs')
    })

    it('renders with size="default"', () => {
      render(<WorkflowStatusBadge status="draft" size="default" />)
      const badge = screen.getByTestId('workflow-status-badge')
      expect(badge.className).toContain('text-sm')
    })
  })
})
