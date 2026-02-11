import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApprovalActions } from '@/components/rfp/ApprovalActions'

describe('ApprovalActions', () => {
  const baseProps = {
    rfpId: 'rfp-1',
    orgRole: 'org:member',
  }
  const adminProps = { ...baseProps, orgRole: 'org:admin' }

  describe('renders nothing when no relevant actions apply', () => {
    it('renders nothing for finalized status (member)', () => {
      render(<ApprovalActions {...baseProps} status="finalized" onSubmit={vi.fn()} />)
      expect(screen.queryByTestId('approval-actions')).not.toBeInTheDocument()
    })

    it('renders nothing for finalized status (admin)', () => {
      render(<ApprovalActions {...adminProps} status="finalized" onFinalize={vi.fn()} />)
      expect(screen.queryByTestId('approval-actions')).not.toBeInTheDocument()
    })

    it('renders nothing when no callbacks provided', () => {
      render(<ApprovalActions {...baseProps} status="draft" />)
      expect(screen.queryByTestId('approval-actions')).not.toBeInTheDocument()
    })

    it('renders nothing for draft status with no onSubmit', () => {
      render(<ApprovalActions {...baseProps} status="draft" onApprove={vi.fn()} />)
      expect(screen.queryByTestId('approval-actions')).not.toBeInTheDocument()
    })
  })

  describe('Submit button (draft status, any user)', () => {
    it('shows Submit button for draft status when onSubmit provided', () => {
      render(<ApprovalActions {...baseProps} status="draft" onSubmit={vi.fn()} />)
      expect(screen.getByTestId('submit-button')).toBeInTheDocument()
    })

    it('calls onSubmit when clicked', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<ApprovalActions {...baseProps} status="draft" onSubmit={onSubmit} />)
      await user.click(screen.getByTestId('submit-button'))
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('does not show Submit button for non-draft status', () => {
      render(<ApprovalActions {...baseProps} status="submitted" onSubmit={vi.fn()} />)
      expect(screen.queryByTestId('submit-button')).not.toBeInTheDocument()
    })
  })

  describe('Approve / Return buttons (submitted status, admin only)', () => {
    it('shows Approve button for submitted status when admin with onApprove', () => {
      render(<ApprovalActions {...adminProps} status="submitted" onApprove={vi.fn()} />)
      expect(screen.getByTestId('approve-button')).toBeInTheDocument()
    })

    it('shows Return button for submitted status when admin with onReturn', () => {
      render(<ApprovalActions {...adminProps} status="submitted" onReturn={vi.fn()} />)
      expect(screen.getByTestId('return-button')).toBeInTheDocument()
    })

    it('shows both Approve and Return buttons when admin', () => {
      render(
        <ApprovalActions
          {...adminProps}
          status="submitted"
          onApprove={vi.fn()}
          onReturn={vi.fn()}
        />
      )
      expect(screen.getByTestId('approve-button')).toBeInTheDocument()
      expect(screen.getByTestId('return-button')).toBeInTheDocument()
    })

    it('does not show Approve/Return for non-admin (member)', () => {
      render(
        <ApprovalActions
          {...baseProps}
          status="submitted"
          onApprove={vi.fn()}
          onReturn={vi.fn()}
        />
      )
      expect(screen.queryByTestId('approve-button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('return-button')).not.toBeInTheDocument()
    })

    it('calls onApprove when clicked', async () => {
      const user = userEvent.setup()
      const onApprove = vi.fn()
      render(<ApprovalActions {...adminProps} status="submitted" onApprove={onApprove} />)
      await user.click(screen.getByTestId('approve-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    it('calls onReturn when clicked', async () => {
      const user = userEvent.setup()
      const onReturn = vi.fn()
      render(<ApprovalActions {...adminProps} status="submitted" onReturn={onReturn} />)
      await user.click(screen.getByTestId('return-button'))
      expect(onReturn).toHaveBeenCalledTimes(1)
    })
  })

  describe('Finalize button (approved status, admin only)', () => {
    it('shows Finalize button for approved status when admin with onFinalize', () => {
      render(<ApprovalActions {...adminProps} status="approved" onFinalize={vi.fn()} />)
      expect(screen.getByTestId('finalize-button')).toBeInTheDocument()
    })

    it('does not show Finalize for non-admin', () => {
      render(<ApprovalActions {...baseProps} status="approved" onFinalize={vi.fn()} />)
      expect(screen.queryByTestId('finalize-button')).not.toBeInTheDocument()
    })

    it('calls onFinalize when clicked', async () => {
      const user = userEvent.setup()
      const onFinalize = vi.fn()
      render(<ApprovalActions {...adminProps} status="approved" onFinalize={onFinalize} />)
      await user.click(screen.getByTestId('finalize-button'))
      expect(onFinalize).toHaveBeenCalledTimes(1)
    })
  })

  describe('Loading state', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(
        <ApprovalActions {...baseProps} status="draft" onSubmit={vi.fn()} isLoading={true} />
      )
      expect(screen.getByTestId('approval-actions-loading')).toBeInTheDocument()
    })

    it('disables submit button when isLoading', () => {
      render(
        <ApprovalActions {...baseProps} status="draft" onSubmit={vi.fn()} isLoading={true} />
      )
      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })

    it('disables approve button when isLoading', () => {
      render(
        <ApprovalActions
          {...adminProps}
          status="submitted"
          onApprove={vi.fn()}
          isLoading={true}
        />
      )
      expect(screen.getByTestId('approve-button')).toBeDisabled()
    })

    it('does not show loading indicator when isLoading is false', () => {
      render(
        <ApprovalActions {...baseProps} status="draft" onSubmit={vi.fn()} isLoading={false} />
      )
      expect(screen.queryByTestId('approval-actions-loading')).not.toBeInTheDocument()
    })
  })
})
