import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManualLearningForm } from '@/components/knowledge/ManualLearningForm'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ManualLearningForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders the form', () => {
      render(<ManualLearningForm />)
      expect(screen.getByTestId('manual-learning-form')).toBeInTheDocument()
    })

    it('renders the textarea', () => {
      render(<ManualLearningForm />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders the save button', () => {
      render(<ManualLearningForm />)
      expect(screen.getByRole('button', { name: /save learning/i })).toBeInTheDocument()
    })

    it('disables save button when content is empty', () => {
      render(<ManualLearningForm />)
      expect(screen.getByRole('button', { name: /save learning/i })).toBeDisabled()
    })
  })

  describe('form interaction', () => {
    it('enables save button after typing content', async () => {
      const user = userEvent.setup()
      render(<ManualLearningForm />)
      await user.type(screen.getByRole('textbox'), 'Some learning insight')
      expect(screen.getByRole('button', { name: /save learning/i })).toBeEnabled()
    })

    it('submits content and calls onSaved on success', async () => {
      const user = userEvent.setup()
      const onSaved = vi.fn()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      render(<ManualLearningForm onSaved={onSaved} />)
      await user.type(screen.getByRole('textbox'), 'My insight')
      await user.click(screen.getByRole('button', { name: /save learning/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/learnings',
          expect.objectContaining({ method: 'POST' })
        )
        expect(onSaved).toHaveBeenCalledTimes(1)
      })
    })

    it('includes customerId in request when provided', async () => {
      const user = userEvent.setup()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      render(<ManualLearningForm customerId="cust-123" />)
      await user.type(screen.getByRole('textbox'), 'My insight')
      await user.click(screen.getByRole('button', { name: /save learning/i }))

      await waitFor(() => {
        const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
        expect(body.customerId).toBe('cust-123')
      })
    })

    it('clears content after successful save', async () => {
      const user = userEvent.setup()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      render(<ManualLearningForm />)
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'My insight')
      await user.click(screen.getByRole('button', { name: /save learning/i }))

      await waitFor(() => {
        expect(textarea).toHaveValue('')
      })
    })

    it('does not submit when content is whitespace only', async () => {
      const user = userEvent.setup()
      const fetchSpy = vi.spyOn(global, 'fetch')

      render(<ManualLearningForm />)
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '   ')

      expect(screen.getByRole('button', { name: /save learning/i })).toBeDisabled()
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
