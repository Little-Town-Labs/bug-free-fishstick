import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LearningEntry } from '@/components/knowledge/LearningEntry'
import type { Learning } from '@/lib/db/schema'

const makeLearning = (overrides: Partial<Learning> = {}): Learning => ({
  id: 'learn-1',
  organizationId: 'org-1',
  customerId: null,
  content: 'This customer prefers formal language in RFP responses.',
  sourceType: 'manual_entry',
  sourceMetadata: null,
  fieldId: null,
  questionType: null,
  confidence: null,
  createdBy: 'user-1',
  createdAt: new Date('2024-06-15T00:00:00.000Z'),
  ...overrides,
})

describe('LearningEntry', () => {
  it('renders the learning content', () => {
    render(<LearningEntry learning={makeLearning()} />)
    expect(screen.getByText('This customer prefers formal language in RFP responses.')).toBeInTheDocument()
  })

  it('shows source label for manual_entry', () => {
    render(<LearningEntry learning={makeLearning({ sourceType: 'manual_entry' })} />)
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('shows source label for rfp_approval', () => {
    render(<LearningEntry learning={makeLearning({ sourceType: 'rfp_approval' })} />)
    expect(screen.getByText('Auto-learned')).toBeInTheDocument()
  })

  it('shows source label for user_correction', () => {
    render(<LearningEntry learning={makeLearning({ sourceType: 'user_correction' })} />)
    expect(screen.getByText('Correction')).toBeInTheDocument()
  })

  it('falls back to raw sourceType for unknown source', () => {
    render(<LearningEntry learning={makeLearning({ sourceType: 'unknown_type' as 'manual_entry' })} />)
    expect(screen.getByText('unknown_type')).toBeInTheDocument()
  })

  it('renders the data-testid', () => {
    render(<LearningEntry learning={makeLearning()} />)
    expect(screen.getByTestId('learning-entry')).toBeInTheDocument()
  })
})
