import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeEntryCard } from '@/components/knowledge/KnowledgeEntryCard'

const makeEntry = (overrides = {}) => ({
  id: 'entry-1',
  type: 'company_doc' as const,
  title: 'Company Profile',
  content: 'This is our company overview for RFP responses.',
  metadata: null,
  createdAt: '2024-03-01T00:00:00.000Z',
  updatedAt: '2024-03-15T00:00:00.000Z',
  ...overrides,
})

describe('KnowledgeEntryCard', () => {
  describe('rendering', () => {
    it('renders the card', () => {
      render(<KnowledgeEntryCard entry={makeEntry()} />)
      expect(screen.getByTestId('knowledge-entry-card')).toBeInTheDocument()
    })

    it('shows the entry title', () => {
      render(<KnowledgeEntryCard entry={makeEntry()} />)
      expect(screen.getByTestId('knowledge-title')).toHaveTextContent('Company Profile')
    })

    it('shows content preview', () => {
      render(<KnowledgeEntryCard entry={makeEntry()} />)
      expect(screen.getByTestId('knowledge-content-preview')).toHaveTextContent(
        'This is our company overview for RFP responses.'
      )
    })

    it('truncates content longer than 200 characters', () => {
      const longContent = 'A'.repeat(250)
      render(<KnowledgeEntryCard entry={makeEntry({ content: longContent })} />)
      const preview = screen.getByTestId('knowledge-content-preview')
      expect(preview.textContent?.length).toBeLessThan(210) // 200 + ellipsis
      expect(preview.textContent).toContain('…')
    })

    it('does not truncate content shorter than 200 characters', () => {
      const shortContent = 'Short content.'
      render(<KnowledgeEntryCard entry={makeEntry({ content: shortContent })} />)
      expect(screen.getByTestId('knowledge-content-preview')).toHaveTextContent('Short content.')
    })
  })

  describe('type badge', () => {
    it.each([
      ['past_rfp', 'Past RFP'],
      ['case_study', 'Case Study'],
      ['certification', 'Certification'],
      ['company_doc', 'Company Doc'],
      ['manual_entry', 'Manual Entry'],
    ] as const)('shows %s type as %s', (type, label) => {
      render(<KnowledgeEntryCard entry={makeEntry({ type })} />)
      expect(screen.getByTestId('knowledge-type-badge')).toHaveTextContent(label)
    })
  })

  describe('delete button', () => {
    it('does not show delete button when onDelete not provided', () => {
      render(<KnowledgeEntryCard entry={makeEntry()} />)
      expect(screen.queryByTestId('knowledge-delete-button')).not.toBeInTheDocument()
    })

    it('shows delete button when onDelete provided', () => {
      render(<KnowledgeEntryCard entry={makeEntry()} onDelete={vi.fn()} />)
      expect(screen.getByTestId('knowledge-delete-button')).toBeInTheDocument()
    })

    it('calls onDelete with entry id when clicked', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      render(<KnowledgeEntryCard entry={makeEntry({ id: 'entry-42' })} onDelete={onDelete} />)
      await user.click(screen.getByTestId('knowledge-delete-button'))
      expect(onDelete).toHaveBeenCalledWith('entry-42')
    })
  })

  describe('dates', () => {
    it('renders metadata section with dates', () => {
      render(<KnowledgeEntryCard entry={makeEntry()} />)
      expect(screen.getByTestId('knowledge-metadata')).toBeInTheDocument()
    })

    it('accepts Date objects for createdAt/updatedAt', () => {
      const entry = makeEntry({
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date('2024-03-15'),
      })
      render(<KnowledgeEntryCard entry={entry} />)
      expect(screen.getByTestId('knowledge-metadata')).toBeInTheDocument()
    })
  })
})
