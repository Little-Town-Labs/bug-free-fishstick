import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RfpEditor } from '@/components/rfp/RfpEditor'

vi.mock('@/components/rfp/DocumentPreview', () => ({
  DocumentPreview: () => <div data-testid="document-preview" />,
}))

const makeResponse = (overrides = {}) => ({
  id: 'resp-1',
  fieldId: 'field-1',
  fieldType: 'text',
  question: 'What is your company name?',
  responseText: 'Acme Corp',
  confidenceScore: 0.9,
  status: 'auto_filled' as const,
  ...overrides,
})

const baseProps = {
  rfpId: 'rfp-1',
  documentUrl: null,
  documentType: null,
  parsedStructure: null,
  responses: [],
}

describe('RfpEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders the editor container', () => {
      render(<RfpEditor {...baseProps} />)
      expect(screen.getByTestId('rfp-editor')).toBeInTheDocument()
    })

    it('shows empty message when no responses', () => {
      render(<RfpEditor {...baseProps} responses={[]} />)
      expect(screen.getByText('No responses yet. Process the RFP to generate AI responses.')).toBeInTheDocument()
    })

    it('renders response cards when responses exist', () => {
      render(<RfpEditor {...baseProps} responses={[makeResponse()]} />)
      expect(screen.getAllByTestId('response-card')).toHaveLength(1)
    })

    it('renders multiple response cards', () => {
      render(
        <RfpEditor
          {...baseProps}
          responses={[
            makeResponse({ id: 'r1', fieldId: 'f1' }),
            makeResponse({ id: 'r2', fieldId: 'f2' }),
          ]}
        />
      )
      expect(screen.getAllByTestId('response-card')).toHaveLength(2)
    })

    it('shows progress bar when responses exist', () => {
      render(<RfpEditor {...baseProps} responses={[makeResponse()]} />)
      expect(screen.getByTestId('completion-progress')).toBeInTheDocument()
    })

    it('does not show progress bar when no responses', () => {
      render(<RfpEditor {...baseProps} responses={[]} />)
      expect(screen.queryByTestId('completion-progress')).not.toBeInTheDocument()
    })
  })

  describe('processing state', () => {
    it('shows processing overlay when isProcessing is true', () => {
      render(<RfpEditor {...baseProps} isProcessing={true} />)
      expect(screen.getByText('Processing RFP...')).toBeInTheDocument()
    })

    it('does not show processing overlay by default', () => {
      render(<RfpEditor {...baseProps} />)
      expect(screen.queryByText('Processing RFP...')).not.toBeInTheDocument()
    })
  })

  describe('accept response', () => {
    it('calls onAcceptResponse and saves via API', async () => {
      const user = userEvent.setup()
      const onAcceptResponse = vi.fn()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ savedAt: '2024-01-01T00:00:00Z' }),
      } as Response)

      render(
        <RfpEditor
          {...baseProps}
          responses={[makeResponse()]}
          onAcceptResponse={onAcceptResponse}
        />
      )

      await user.click(screen.getByText('Accept'))

      expect(onAcceptResponse).toHaveBeenCalledWith('field-1')
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/rfps/rfp-1/responses/field-1',
          expect.objectContaining({ method: 'PUT' })
        )
      })
    })
  })

  describe('edit response', () => {
    it('calls onEditResponse when response is edited and saved', async () => {
      const user = userEvent.setup()
      const onEditResponse = vi.fn()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ savedAt: '2024-01-01T00:00:00Z' }),
      } as Response)

      render(
        <RfpEditor
          {...baseProps}
          responses={[makeResponse()]}
          onEditResponse={onEditResponse}
        />
      )

      await user.click(screen.getByText('Edit'))
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Updated response text')
      await user.click(screen.getByText('Save'))

      expect(onEditResponse).toHaveBeenCalledWith('field-1', 'Updated response text')
    })
  })

  describe('reject response', () => {
    it('calls onRejectResponse and saves via API', async () => {
      const user = userEvent.setup()
      const onRejectResponse = vi.fn()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      render(
        <RfpEditor
          {...baseProps}
          responses={[makeResponse()]}
          onRejectResponse={onRejectResponse}
        />
      )

      await user.click(screen.getByText('Reject'))

      expect(onRejectResponse).toHaveBeenCalledWith('field-1')
    })
  })

  describe('save error', () => {
    it('shows save error when API returns non-ok', async () => {
      const user = userEvent.setup()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response)

      render(<RfpEditor {...baseProps} responses={[makeResponse()]} />)
      await user.click(screen.getByText('Accept'))

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument()
      })
    })

    it('shows conflict error on 409', async () => {
      const user = userEvent.setup()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({}),
      } as Response)

      render(<RfpEditor {...baseProps} responses={[makeResponse()]} />)
      await user.click(screen.getByText('Accept'))

      await waitFor(() => {
        expect(screen.getByText(/newer version/i)).toBeInTheDocument()
      })
    })
  })

  describe('auto-save', () => {
    it('shows saved indicator after successful save with autoSave', async () => {
      const user = userEvent.setup()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ savedAt: '2024-01-01T00:00:00Z' }),
      } as Response)

      render(<RfpEditor {...baseProps} responses={[makeResponse()]} autoSave={true} />)

      await user.click(screen.getByText('Accept'))

      await waitFor(() => {
        expect(screen.queryByTestId('auto-save-indicator')).not.toBeInTheDocument()
        expect(screen.getByTestId('saved-indicator')).toBeInTheDocument()
      })
    })
  })
})
