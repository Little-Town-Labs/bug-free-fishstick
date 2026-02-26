/**
 * TDD Red-Phase Unit Tests — TemplateFormDialog
 *
 * The component file does NOT exist yet. All tests are expected to FAIL
 * until `src/components/settings/proposal-templates/TemplateFormDialog.tsx`
 * is created and implemented.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateFormDialog } from '@/components/settings/proposal-templates/TemplateFormDialog'

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  open: true,
  mode: 'create' as const,
  section: 'assumptions' as const,
  initialValues: null,
  isSaving: false,
  onSave: vi.fn(),
  onClose: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TemplateFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Field rendering', () => {
    it('renders title and content fields', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/content/i)).toBeInTheDocument()
    })

    it('renders the isRequired toggle switch', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      expect(screen.getByRole('switch', { name: /required/i })).toBeInTheDocument()
    })

    it('renders the evaluateCoverage toggle switch', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      expect(
        screen.getByRole('switch', { name: /evaluate coverage/i })
      ).toBeInTheDocument()
    })

    it('renders Save and Cancel buttons', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('Business logic — isRequired and evaluateCoverage interaction', () => {
    it('disables evaluateCoverage switch when isRequired is toggled on', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      const isRequiredSwitch = screen.getByRole('switch', { name: /required/i })
      fireEvent.click(isRequiredSwitch)

      const evalSwitch = screen.getByRole('switch', { name: /evaluate coverage/i })
      expect(evalSwitch).toBeDisabled()
    })

    it('enables evaluateCoverage switch when isRequired is toggled off', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      // Toggle isRequired on then off
      const isRequiredSwitch = screen.getByRole('switch', { name: /required/i })
      fireEvent.click(isRequiredSwitch) // on
      fireEvent.click(isRequiredSwitch) // off

      const evalSwitch = screen.getByRole('switch', { name: /evaluate coverage/i })
      expect(evalSwitch).not.toBeDisabled()
    })
  })

  describe('Form validation — onSave not called without required fields', () => {
    it('prevents form submission when title is empty', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      const submitBtn = screen.getByRole('button', { name: /save/i })
      fireEvent.click(submitBtn)

      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })

    it('prevents form submission when content is empty', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      const titleInput = screen.getByLabelText(/title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Title' } })

      const submitBtn = screen.getByRole('button', { name: /save/i })
      fireEvent.click(submitBtn)

      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })

    it('calls onSave when both title and content are provided', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      const titleInput = screen.getByLabelText(/title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Title' } })

      const contentInput = screen.getByLabelText(/content/i)
      fireEvent.change(contentInput, { target: { value: 'Test content body' } })

      const submitBtn = screen.getByRole('button', { name: /save/i })
      fireEvent.click(submitBtn)

      expect(defaultProps.onSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cancel button', () => {
    it('calls onClose when cancel is clicked', () => {
      render(<TemplateFormDialog {...defaultProps} />)

      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelBtn)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Mode titles', () => {
    it('shows "Add Template" or "Create Template" title in create mode', () => {
      render(<TemplateFormDialog {...defaultProps} mode="create" />)

      expect(
        screen.getByText(/add template|create template/i)
      ).toBeInTheDocument()
    })

    it('shows "Edit Template" title in edit mode', () => {
      render(
        <TemplateFormDialog
          {...defaultProps}
          mode="edit"
          initialValues={{ title: 'Existing', content: 'Existing content' }}
        />
      )

      expect(screen.getByText(/edit template/i)).toBeInTheDocument()
    })
  })

  describe('Edit mode — pre-population', () => {
    it('pre-fills title field with initialValues.title when mode=edit', () => {
      render(
        <TemplateFormDialog
          {...defaultProps}
          mode="edit"
          initialValues={{ title: 'Pre-filled Title', content: 'Pre-filled content' }}
        />
      )

      const titleInput = screen.getByLabelText(/title/i)
      expect(titleInput).toHaveValue('Pre-filled Title')
    })

    it('pre-fills content field with initialValues.content when mode=edit', () => {
      render(
        <TemplateFormDialog
          {...defaultProps}
          mode="edit"
          initialValues={{ title: 'Pre-filled Title', content: 'Pre-filled content' }}
        />
      )

      const contentInput = screen.getByLabelText(/content/i)
      expect(contentInput).toHaveValue('Pre-filled content')
    })
  })

  describe('Saving state', () => {
    it('disables Save button when isSaving is true', () => {
      render(<TemplateFormDialog {...defaultProps} isSaving={true} />)

      const submitBtn = screen.getByRole('button', { name: /save/i })
      expect(submitBtn).toBeDisabled()
    })

    it('disables Cancel button when isSaving is true', () => {
      render(<TemplateFormDialog {...defaultProps} isSaving={true} />)

      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      expect(cancelBtn).toBeDisabled()
    })
  })
})
