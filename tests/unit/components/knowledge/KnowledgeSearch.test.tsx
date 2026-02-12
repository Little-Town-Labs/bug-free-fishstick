import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeSearch } from '@/components/knowledge/KnowledgeSearch'

const makeResult = (overrides = {}) => ({
  id: 'r1',
  title: 'Company Overview',
  content: 'A brief overview of our company for RFP responses.',
  type: 'company_doc' as const,
  similarity: 0.87,
  ...overrides,
})

describe('KnowledgeSearch', () => {
  const defaultProps = {
    results: [],
    isSearching: false,
    onSearch: vi.fn(),
  }

  describe('rendering', () => {
    it('renders the search input', () => {
      render(<KnowledgeSearch {...defaultProps} />)
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    it('does not show loading indicator by default', () => {
      render(<KnowledgeSearch {...defaultProps} />)
      expect(screen.queryByTestId('search-loading')).not.toBeInTheDocument()
    })

    it('shows loading indicator when isSearching is true', () => {
      render(<KnowledgeSearch {...defaultProps} isSearching={true} />)
      expect(screen.getByTestId('search-loading')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('does not show empty state when query is empty', () => {
      render(<KnowledgeSearch {...defaultProps} results={[]} />)
      expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument()
    })

    it('shows empty state when query exists, no results, not searching', async () => {
      const user = userEvent.setup()
      render(<KnowledgeSearch {...defaultProps} results={[]} />)
      await user.type(screen.getByTestId('search-input'), 'xyz')
      expect(screen.getByTestId('search-empty-state')).toBeInTheDocument()
    })

    it('does not show empty state while searching', async () => {
      const user = userEvent.setup()
      render(<KnowledgeSearch {...defaultProps} results={[]} isSearching={true} />)
      await user.type(screen.getByTestId('search-input'), 'xyz')
      expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument()
    })
  })

  describe('search input', () => {
    it('calls onSearch when input changes', async () => {
      const user = userEvent.setup()
      const onSearch = vi.fn()
      render(<KnowledgeSearch {...defaultProps} onSearch={onSearch} />)
      await user.type(screen.getByTestId('search-input'), 'RFP')
      expect(onSearch).toHaveBeenCalled()
    })
  })

  describe('results list', () => {
    const results = [
      makeResult({ id: 'r1', title: 'Doc One', similarity: 0.9 }),
      makeResult({ id: 'r2', title: 'Doc Two', similarity: 0.7, type: 'case_study' }),
    ]

    it('renders result items', () => {
      render(<KnowledgeSearch {...defaultProps} results={results} />)
      expect(screen.getAllByTestId('search-result-item')).toHaveLength(2)
    })

    it('shows result title', () => {
      render(<KnowledgeSearch {...defaultProps} results={[makeResult({ title: 'My Doc' })]} />)
      expect(screen.getByTestId('result-title')).toHaveTextContent('My Doc')
    })

    it('shows similarity percentage', () => {
      render(<KnowledgeSearch {...defaultProps} results={[makeResult({ similarity: 0.87 })]} />)
      expect(screen.getByTestId('result-similarity')).toHaveTextContent('87% match')
    })

    it('truncates long content', () => {
      const longContent = 'B'.repeat(300)
      render(<KnowledgeSearch {...defaultProps} results={[makeResult({ content: longContent })]} />)
      const preview = screen.getByTestId('result-content-preview')
      expect(preview.textContent?.length).toBeLessThan(210)
      expect(preview.textContent).toContain('…')
    })

    it('shows type badge label', () => {
      render(<KnowledgeSearch {...defaultProps} results={[makeResult({ type: 'case_study' })]} />)
      expect(screen.getByText('Case Study')).toBeInTheDocument()
    })
  })
})
