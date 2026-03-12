import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KnowledgeUploader } from '@/components/knowledge/KnowledgeUploader'

describe('KnowledgeUploader', () => {
  const defaultProps = {
    onUpload: vi.fn(),
  }

  describe('Rendering', () => {
    it('renders upload drop zone', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      expect(screen.getByTestId('upload-drop-zone')).toBeInTheDocument()
    })

    it('renders type select field', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      expect(screen.getByTestId('type-select')).toBeInTheDocument()
    })

    it('renders title input field', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      expect(screen.getByTestId('title-input')).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      expect(screen.getByTestId('upload-submit-button')).toBeInTheDocument()
    })

    it('shows default placeholder text in drop zone when no file selected', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      expect(screen.getByText(/drop a file here or click to browse/i)).toBeInTheDocument()
    })
  })

  describe('File Selection', () => {
    it('shows selected file name after file is chosen', async () => {
      render(<KnowledgeUploader {...defaultProps} />)

      const fileInput = screen.getByTestId('file-input')
      const file = new File(['content'], 'test-document.pdf', { type: 'application/pdf' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      expect(screen.getByTestId('selected-file-name')).toHaveTextContent('test-document.pdf')
    })

    it('auto-fills title from file name when title is empty', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      const fileInput = screen.getByTestId('file-input')
      const file = new File(['content'], 'my-report.pdf', { type: 'application/pdf' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      expect(screen.getByTestId('title-input')).toHaveValue('my-report')
    })
  })

  describe('Form Submission', () => {
    it('calls onUpload with file, type, and title when submitted', async () => {
      const onUpload = vi.fn()
      render(<KnowledgeUploader onUpload={onUpload} />)

      const fileInput = screen.getByTestId('file-input')
      const file = new File(['content'], 'rfp-2024.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      const titleInput = screen.getByTestId('title-input')
      fireEvent.change(titleInput, { target: { value: 'RFP 2024' } })

      const typeSelect = screen.getByTestId('type-select')
      fireEvent.change(typeSelect, { target: { value: 'past_rfp' } })

      const submitButton = screen.getByTestId('upload-submit-button')
      fireEvent.click(submitButton)

      expect(onUpload).toHaveBeenCalledWith(file, 'past_rfp', 'RFP 2024')
      expect(onUpload).toHaveBeenCalledTimes(1)
    })
  })

  describe('Validation', () => {
    it('submit button is disabled when no file is selected', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      const submitButton = screen.getByTestId('upload-submit-button')
      expect(submitButton).toBeDisabled()
    })

    it('submit button is enabled when a file is selected', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      const fileInput = screen.getByTestId('file-input')
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      const submitButton = screen.getByTestId('upload-submit-button')
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Upload State', () => {
    it('shows uploading state when isUploading is true', () => {
      render(<KnowledgeUploader {...defaultProps} isUploading={true} />)

      expect(screen.getByTestId('uploading-state')).toBeInTheDocument()
    })

    it('does not show uploading state when isUploading is false', () => {
      render(<KnowledgeUploader {...defaultProps} isUploading={false} />)

      expect(screen.queryByTestId('uploading-state')).not.toBeInTheDocument()
    })

    it('disables submit button when isUploading is true', () => {
      render(<KnowledgeUploader {...defaultProps} isUploading={true} />)

      const submitButton = screen.getByTestId('upload-submit-button')
      expect(submitButton).toBeDisabled()
    })

    it('shows uploading label on submit button when isUploading is true', () => {
      render(<KnowledgeUploader {...defaultProps} isUploading={true} />)

      expect(screen.getByTestId('upload-submit-button')).toHaveTextContent('Uploading...')
    })
  })

  describe('Error State', () => {
    it('shows error message when error prop is set', () => {
      render(<KnowledgeUploader {...defaultProps} error="Upload failed. Please try again." />)

      expect(screen.getByTestId('upload-error')).toHaveTextContent('Upload failed. Please try again.')
    })

    it('does not show error message when error prop is null', () => {
      render(<KnowledgeUploader {...defaultProps} error={null} />)

      expect(screen.queryByTestId('upload-error')).not.toBeInTheDocument()
    })

    it('does not show error message when error prop is not provided', () => {
      render(<KnowledgeUploader {...defaultProps} />)

      expect(screen.queryByTestId('upload-error')).not.toBeInTheDocument()
    })
  })
})
