import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResponseCard } from '@/components/rfp/ResponseCard'

describe('ResponseCard', () => {
  const defaultProps = {
    fieldId: 'field-1',
    question: 'What is your company\'s primary service offering?',
    responseText: 'We provide enterprise software solutions.',
    confidenceScore: 0.85,
    status: 'auto_filled' as const,
    fieldType: 'text',
  }

  describe('Rendering', () => {
    it('renders question text', () => {
      render(<ResponseCard {...defaultProps} />)

      expect(screen.getByText('What is your company\'s primary service offering?')).toBeInTheDocument()
    })

    it('renders response text when provided', () => {
      render(<ResponseCard {...defaultProps} />)

      expect(screen.getByText('We provide enterprise software solutions.')).toBeInTheDocument()
    })

    it('shows "No response generated" when responseText is null', () => {
      render(<ResponseCard {...defaultProps} responseText={null} />)

      expect(screen.getByText('No response generated')).toBeInTheDocument()
    })

    it('displays field type indicator', () => {
      render(<ResponseCard {...defaultProps} fieldType="paragraph" />)

      expect(screen.getByText(/paragraph/i)).toBeInTheDocument()
    })
  })

  describe('Confidence Score Indicator', () => {
    it('displays high confidence indicator (green) for scores > 0.8', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.9} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-[color:var(--confidence-high)]')
    })

    it('displays medium confidence indicator (yellow) for scores > 0.5 and <= 0.8', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.65} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-[color:var(--confidence-medium)]')
    })

    it('displays low confidence indicator (red) for scores <= 0.5', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.4} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-[color:var(--confidence-low)]')
    })

    it('shows confidence score percentage', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.85} />)

      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('does not display confidence indicator when score is null', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={null} />)

      expect(screen.queryByTestId('confidence-indicator')).not.toBeInTheDocument()
    })
  })

  describe('Status Badge', () => {
    it('shows "Auto-filled" badge for auto_filled status', () => {
      render(<ResponseCard {...defaultProps} status="auto_filled" />)

      expect(screen.getByText('Auto-filled')).toBeInTheDocument()
    })

    it('shows "Needs Input" badge for needs_input status', () => {
      render(<ResponseCard {...defaultProps} status="needs_input" />)

      expect(screen.getByText('Needs Input')).toBeInTheDocument()
    })

    it('shows "Manually Filled" badge for manually_filled status', () => {
      render(<ResponseCard {...defaultProps} status="manually_filled" />)

      expect(screen.getByText('Manually Filled')).toBeInTheDocument()
    })

    it('shows "Approved" badge for approved status', () => {
      render(<ResponseCard {...defaultProps} status="approved" />)

      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('calls onAccept callback when Accept button is clicked', async () => {
      const user = userEvent.setup()
      const onAccept = vi.fn()
      render(<ResponseCard {...defaultProps} onAccept={onAccept} />)

      const acceptButton = screen.getByRole('button', { name: /accept/i })
      await user.click(acceptButton)

      expect(onAccept).toHaveBeenCalledWith('field-1')
      expect(onAccept).toHaveBeenCalledTimes(1)
    })

    it('calls onReject callback when Reject button is clicked', async () => {
      const user = userEvent.setup()
      const onReject = vi.fn()
      render(<ResponseCard {...defaultProps} onReject={onReject} />)

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      await user.click(rejectButton)

      expect(onReject).toHaveBeenCalledWith('field-1')
      expect(onReject).toHaveBeenCalledTimes(1)
    })

    it('does not render Accept button when onAccept is not provided', () => {
      render(<ResponseCard {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
    })

    it('does not render Reject button when onReject is not provided', () => {
      render(<ResponseCard {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    it('enables edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      render(<ResponseCard {...defaultProps} onEdit={onEdit} />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      // Should show textarea in edit mode
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue('We provide enterprise software solutions.')
    })

    it('calls onEdit with new text when Save button is clicked in edit mode', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      render(<ResponseCard {...defaultProps} onEdit={onEdit} />)

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      // Modify text
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Updated response text')

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(onEdit).toHaveBeenCalledWith('field-1', 'Updated response text')
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it('cancels edit mode when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      render(<ResponseCard {...defaultProps} onEdit={onEdit} />)

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      // Cancel editing
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Should exit edit mode without calling onEdit
      expect(onEdit).not.toHaveBeenCalled()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByText('We provide enterprise software solutions.')).toBeInTheDocument()
    })

    it('does not render Edit button when onEdit is not provided', () => {
      render(<ResponseCard {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      render(<ResponseCard {...defaultProps} isLoading={true} />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('disables action buttons when isLoading is true', () => {
      render(
        <ResponseCard
          {...defaultProps}
          isLoading={true}
          onAccept={vi.fn()}
          onEdit={vi.fn()}
          onReject={vi.fn()}
        />
      )

      const acceptButton = screen.getByRole('button', { name: /accept/i })
      const editButton = screen.getByRole('button', { name: /edit/i })
      const rejectButton = screen.getByRole('button', { name: /reject/i })

      expect(acceptButton).toBeDisabled()
      expect(editButton).toBeDisabled()
      expect(rejectButton).toBeDisabled()
    })

    it('does not show loading state when isLoading is false', () => {
      render(<ResponseCard {...defaultProps} isLoading={false} />)

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })
  })

  describe('Confidence Level Styling', () => {
    it('applies high confidence styling for scores > 0.8', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.9} />)

      const card = screen.getByTestId('response-card')
      expect(card).toHaveClass('border-[color:var(--confidence-high)]')
    })

    it('applies medium confidence styling for scores > 0.5 and <= 0.8', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.7} />)

      const card = screen.getByTestId('response-card')
      expect(card).toHaveClass('border-[color:var(--confidence-medium)]')
    })

    it('applies low confidence styling for scores <= 0.5', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.3} />)

      const card = screen.getByTestId('response-card')
      expect(card).toHaveClass('border-[color:var(--confidence-low)]')
    })

    it('applies neutral styling when confidence score is null', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={null} />)

      const card = screen.getByTestId('response-card')
      expect(card).toHaveClass('border-border')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty string responseText', () => {
      render(<ResponseCard {...defaultProps} responseText="" />)

      expect(screen.getByText('No response generated')).toBeInTheDocument()
    })

    it('handles whitespace-only responseText', () => {
      render(<ResponseCard {...defaultProps} responseText="   " />)

      expect(screen.getByText('No response generated')).toBeInTheDocument()
    })

    it('handles very long question text', () => {
      const longQuestion = 'A'.repeat(500)
      render(<ResponseCard {...defaultProps} question={longQuestion} />)

      expect(screen.getByText(longQuestion)).toBeInTheDocument()
    })

    it('handles very long response text', () => {
      const longResponse = 'B'.repeat(1000)
      render(<ResponseCard {...defaultProps} responseText={longResponse} />)

      expect(screen.getByText(longResponse)).toBeInTheDocument()
    })

    it('handles confidence score of exactly 0.8 as high confidence', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.8} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-[color:var(--confidence-medium)]')
    })

    it('handles confidence score of exactly 0.5 as low confidence', () => {
      render(<ResponseCard {...defaultProps} confidenceScore={0.5} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-[color:var(--confidence-low)]')
    })
  })
})
