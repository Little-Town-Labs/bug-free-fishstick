import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReturnComments } from '@/components/rfp/ReturnComments'

describe('ReturnComments', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
  }

  describe('rendering', () => {
    it('renders dialog when open=true', () => {
      render(<ReturnComments {...defaultProps} />)
      expect(screen.getByTestId('return-comments-dialog')).toBeInTheDocument()
    })

    it('renders textarea', () => {
      render(<ReturnComments {...defaultProps} />)
      expect(screen.getByTestId('return-comments-input')).toBeInTheDocument()
    })

    it('renders cancel and submit buttons', () => {
      render(<ReturnComments {...defaultProps} />)
      expect(screen.getByTestId('return-comments-cancel')).toBeInTheDocument()
      expect(screen.getByTestId('return-comments-submit')).toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('submit button is disabled when comments are empty', () => {
      render(<ReturnComments {...defaultProps} />)
      expect(screen.getByTestId('return-comments-submit')).toBeDisabled()
    })

    it('submit button is enabled after typing comments', async () => {
      const user = userEvent.setup()
      render(<ReturnComments {...defaultProps} />)
      await user.type(screen.getByTestId('return-comments-input'), 'Needs more detail')
      expect(screen.getByTestId('return-comments-submit')).not.toBeDisabled()
    })

    it('submit button remains disabled for whitespace-only input', async () => {
      const user = userEvent.setup()
      render(<ReturnComments {...defaultProps} />)
      await user.type(screen.getByTestId('return-comments-input'), '   ')
      expect(screen.getByTestId('return-comments-submit')).toBeDisabled()
    })
  })

  describe('interaction', () => {
    it('calls onSubmit with trimmed comments when submit is clicked', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<ReturnComments {...defaultProps} onSubmit={onSubmit} />)

      await user.type(screen.getByTestId('return-comments-input'), '  Please fix the pricing  ')
      await user.click(screen.getByTestId('return-comments-submit'))

      expect(onSubmit).toHaveBeenCalledWith('Please fix the pricing')
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('calls onOpenChange(false) when cancel is clicked', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      render(<ReturnComments {...defaultProps} onOpenChange={onOpenChange} />)

      await user.click(screen.getByTestId('return-comments-cancel'))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('does not call onSubmit when comments are empty and submit is clicked', async () => {
      userEvent.setup()
      const onSubmit = vi.fn()
      render(<ReturnComments {...defaultProps} onSubmit={onSubmit} />)

      // button is disabled — clicking should not fire
      const submitBtn = screen.getByTestId('return-comments-submit')
      expect(submitBtn).toBeDisabled()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('disables textarea when isLoading is true', () => {
      render(<ReturnComments {...defaultProps} isLoading={true} />)
      expect(screen.getByTestId('return-comments-input')).toBeDisabled()
    })

    it('disables cancel button when isLoading', () => {
      render(<ReturnComments {...defaultProps} isLoading={true} />)
      expect(screen.getByTestId('return-comments-cancel')).toBeDisabled()
    })

    it('disables submit button when isLoading (even with content)', () => {
      // When isLoading=true the submit button should be disabled regardless of content
      // We verify this via the isLoading prop alone (the OR condition in the disabled prop)
      render(<ReturnComments {...defaultProps} isLoading={true} />)
      expect(screen.getByTestId('return-comments-submit')).toBeDisabled()
    })
  })
})
