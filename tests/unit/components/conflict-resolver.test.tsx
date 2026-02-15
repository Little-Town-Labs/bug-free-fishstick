import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictResolver } from '@/components/rfp/ConflictResolver'

describe('ConflictResolver', () => {
  const defaultProps = {
    fieldLabel: 'Title',
    currentVersion: 'Current value',
    yourVersion: 'Your value',
    onKeepMine: vi.fn(),
    onUseTheirs: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders the dialog with correct role and aria attributes', () => {
    render(<ConflictResolver {...defaultProps} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'conflict-title')
  })

  it('shows both version panels', () => {
    render(<ConflictResolver {...defaultProps} />)

    expect(screen.getByText('Current value')).toBeInTheDocument()
    expect(screen.getByText('Your value')).toBeInTheDocument()
    expect(screen.getByText(/Another user saved changes to/)).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
  })

  it('calls onKeepMine when "Keep mine" button is clicked', () => {
    const onKeepMine = vi.fn()
    render(<ConflictResolver {...defaultProps} onKeepMine={onKeepMine} />)

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    expect(onKeepMine).toHaveBeenCalledOnce()
  })

  it('calls onUseTheirs when "Use theirs" button is clicked', () => {
    const onUseTheirs = vi.fn()
    render(<ConflictResolver {...defaultProps} onUseTheirs={onUseTheirs} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use theirs' }))
    expect(onUseTheirs).toHaveBeenCalledOnce()
  })

  it('calls onCancel when "Cancel" button is clicked', () => {
    const onCancel = vi.fn()
    render(<ConflictResolver {...defaultProps} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn()
    render(<ConflictResolver {...defaultProps} onCancel={onCancel} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('focuses the "Keep mine" button on mount', () => {
    render(<ConflictResolver {...defaultProps} />)

    const keepMineBtn = screen.getByRole('button', { name: 'Keep mine' })
    expect(document.activeElement).toBe(keepMineBtn)
  })

  it('renders all three action buttons', () => {
    render(<ConflictResolver {...defaultProps} />)

    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use theirs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
})
