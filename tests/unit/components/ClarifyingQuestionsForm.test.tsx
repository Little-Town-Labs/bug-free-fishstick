import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClarifyingQuestionsForm } from '@/components/rfp/ClarifyingQuestionsForm'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const baseQuestions: ClarifyingQuestion[] = [
  {
    id: 'q1',
    question: 'What is your approach?',
    rfpSection: 'Technical',
    answer: null,
  },
  {
    id: 'q2',
    question: 'Security certifications?',
    rfpSection: 'Compliance',
    answer: null,
    suggestedAnswer: 'We hold ISO 27001 certification since 2020.',
    kbSourceId: 'kb-1',
    kbSourceTitle: 'ISO 27001 Cert',
    suggestionConfidence: 0.85,
  },
]

const defaultProps = {
  rfpId: 'rfp-1',
  draftId: 'draft-1',
  questions: baseQuestions,
  onSubmitted: vi.fn(),
}

describe('ClarifyingQuestionsForm — KB pre-fill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes textarea with suggestedAnswer when present', () => {
    render(<ClarifyingQuestionsForm {...defaultProps} />)

    const textarea = screen.getByLabelText('Security certifications?') as HTMLTextAreaElement
    expect(textarea.value).toBe('We hold ISO 27001 certification since 2020.')
  })

  it('initializes textarea empty when no suggestedAnswer', () => {
    render(<ClarifyingQuestionsForm {...defaultProps} />)

    const textarea = screen.getByLabelText('What is your approach?') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('renders "Auto-answered from Knowledge Base" badge when kbSourceTitle present', () => {
    render(<ClarifyingQuestionsForm {...defaultProps} />)

    expect(screen.getByText(/auto-answered from knowledge base/i)).toBeDefined()
    expect(screen.getByText('ISO 27001 Cert')).toBeDefined()
  })

  it('does NOT render badge when no suggestion exists', () => {
    render(<ClarifyingQuestionsForm {...defaultProps} />)

    // q1 has no suggestion — should not have a badge in its section
    const q1Label = screen.getByLabelText('What is your approach?')
    const q1Container = q1Label.closest('.space-y-2')
    expect(q1Container?.textContent).not.toContain('Auto-answered')
  })

  it('allows user to edit pre-filled text', () => {
    render(<ClarifyingQuestionsForm {...defaultProps} />)

    const textarea = screen.getByLabelText('Security certifications?') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'User edited text' } })
    expect(textarea.value).toBe('User edited text')
  })

  it('clear button empties textarea and removes badge', () => {
    render(<ClarifyingQuestionsForm {...defaultProps} />)

    const clearButton = screen.getByRole('button', { name: /clear suggestion/i })
    fireEvent.click(clearButton)

    const textarea = screen.getByLabelText('Security certifications?') as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    // Badge should be gone
    expect(screen.queryByText(/auto-answered from knowledge base/i)).toBeNull()
  })

  it('renders normally when no suggestion fields exist (backward compatible)', () => {
    const questionsWithoutSuggestions: ClarifyingQuestion[] = [
      { id: 'q1', question: 'Timeline?', rfpSection: 'Schedule', answer: null },
      { id: 'q2', question: 'Budget?', rfpSection: 'Pricing', answer: null },
    ]

    render(
      <ClarifyingQuestionsForm
        {...defaultProps}
        questions={questionsWithoutSuggestions}
      />
    )

    expect(screen.getByLabelText('Timeline?')).toBeDefined()
    expect(screen.getByLabelText('Budget?')).toBeDefined()
    expect(screen.queryByText(/auto-answered/i)).toBeNull()
  })
})
