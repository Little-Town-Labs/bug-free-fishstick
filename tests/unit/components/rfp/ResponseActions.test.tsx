import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResponseActions } from '@/components/rfp/ResponseActions'

describe('ResponseActions', () => {
  const defaultProps = {
    fieldId: 'field-1',
    status: 'auto_filled' as const,
  }

  describe('Container', () => {
    it('renders the wrapping container', () => {
      render(<ResponseActions {...defaultProps} onEdit={vi.fn()} />)
      expect(screen.getByTestId('response-actions')).toBeInTheDocument()
    })

    it('renders nothing when no callbacks are provided', () => {
      render(<ResponseActions {...defaultProps} />)
      expect(screen.queryByTestId('response-actions')).not.toBeInTheDocument()
    })
  })

  describe('Accept Button', () => {
    it('renders Accept button when onAccept is provided and status is not approved', () => {
      render(<ResponseActions {...defaultProps} onAccept={vi.fn()} />)
      expect(screen.getByTestId('accept-button')).toBeInTheDocument()
    })

    it('calls onAccept with fieldId when Accept button is clicked', async () => {
      const user = userEvent.setup()
      const onAccept = vi.fn()
      render(<ResponseActions {...defaultProps} onAccept={onAccept} />)
      await user.click(screen.getByTestId('accept-button'))
      expect(onAccept).toHaveBeenCalledWith('field-1')
      expect(onAccept).toHaveBeenCalledTimes(1)
    })

    it('does not render Accept button when status is approved', () => {
      render(<ResponseActions {...defaultProps} status="approved" onAccept={vi.fn()} />)
      expect(screen.queryByTestId('accept-button')).not.toBeInTheDocument()
    })

    it('does not render Accept button when onAccept is not provided', () => {
      render(<ResponseActions {...defaultProps} onEdit={vi.fn()} />)
      expect(screen.queryByTestId('accept-button')).not.toBeInTheDocument()
    })
  })

  describe('Edit Button', () => {
    it('renders Edit button when onEdit is provided', () => {
      render(<ResponseActions {...defaultProps} onEdit={vi.fn()} />)
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
    })

    it('calls onEdit with fieldId when Edit button is clicked', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      render(<ResponseActions {...defaultProps} onEdit={onEdit} />)
      await user.click(screen.getByTestId('edit-button'))
      expect(onEdit).toHaveBeenCalledWith('field-1')
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it('does not render Edit button when onEdit is not provided', () => {
      render(<ResponseActions {...defaultProps} onAccept={vi.fn()} />)
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
    })
  })

  describe('Reject Button', () => {
    it('renders Reject button when onReject is provided and status is not needs_input', () => {
      render(<ResponseActions {...defaultProps} status="auto_filled" onReject={vi.fn()} />)
      expect(screen.getByTestId('reject-button')).toBeInTheDocument()
    })

    it('calls onReject with fieldId when Reject button is clicked', async () => {
      const user = userEvent.setup()
      const onReject = vi.fn()
      render(<ResponseActions {...defaultProps} onReject={onReject} />)
      await user.click(screen.getByTestId('reject-button'))
      expect(onReject).toHaveBeenCalledWith('field-1')
      expect(onReject).toHaveBeenCalledTimes(1)
    })

    it('does not render Reject button when status is needs_input', () => {
      render(<ResponseActions {...defaultProps} status="needs_input" onReject={vi.fn()} />)
      expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument()
    })

    it('does not render Reject button when onReject is not provided', () => {
      render(<ResponseActions {...defaultProps} onEdit={vi.fn()} />)
      expect(screen.queryByTestId('reject-button')).not.toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(
        <ResponseActions
          {...defaultProps}
          isLoading={true}
          onAccept={vi.fn()}
          onEdit={vi.fn()}
          onReject={vi.fn()}
        />
      )
      expect(screen.getByTestId('actions-loading')).toBeInTheDocument()
    })

    it('disables all buttons when isLoading is true', () => {
      render(
        <ResponseActions
          {...defaultProps}
          isLoading={true}
          onAccept={vi.fn()}
          onEdit={vi.fn()}
          onReject={vi.fn()}
        />
      )
      expect(screen.getByTestId('accept-button')).toBeDisabled()
      expect(screen.getByTestId('edit-button')).toBeDisabled()
      expect(screen.getByTestId('reject-button')).toBeDisabled()
    })

    it('does not show loading indicator when isLoading is false', () => {
      render(<ResponseActions {...defaultProps} isLoading={false} onAccept={vi.fn()} />)
      expect(screen.queryByTestId('actions-loading')).not.toBeInTheDocument()
    })

    it('does not show loading indicator when isLoading is not provided', () => {
      render(<ResponseActions {...defaultProps} onAccept={vi.fn()} />)
      expect(screen.queryByTestId('actions-loading')).not.toBeInTheDocument()
    })
  })

  describe('Multiple Callbacks', () => {
    it('renders all three buttons when all callbacks are provided', () => {
      render(
        <ResponseActions
          {...defaultProps}
          onAccept={vi.fn()}
          onEdit={vi.fn()}
          onReject={vi.fn()}
        />
      )
      expect(screen.getByTestId('accept-button')).toBeInTheDocument()
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
      expect(screen.getByTestId('reject-button')).toBeInTheDocument()
    })

    it('renders only Edit and Reject buttons when onAccept is not provided', () => {
      render(<ResponseActions {...defaultProps} onEdit={vi.fn()} onReject={vi.fn()} />)
      expect(screen.queryByTestId('accept-button')).not.toBeInTheDocument()
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
      expect(screen.getByTestId('reject-button')).toBeInTheDocument()
    })
  })

  describe('Size Prop', () => {
    it('renders without errors with size="sm"', () => {
      render(<ResponseActions {...defaultProps} size="sm" onAccept={vi.fn()} />)
      expect(screen.getByTestId('response-actions')).toBeInTheDocument()
    })

    it('renders without errors with size="default"', () => {
      render(<ResponseActions {...defaultProps} size="default" onAccept={vi.fn()} />)
      expect(screen.getByTestId('response-actions')).toBeInTheDocument()
    })
  })
})
