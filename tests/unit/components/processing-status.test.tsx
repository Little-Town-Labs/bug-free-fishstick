import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProcessingStatus } from '@/components/knowledge/ProcessingStatus'

describe('ProcessingStatus', () => {
  it('renders nothing for complete status', () => {
    const { container } = render(<ProcessingStatus status="complete" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders pending badge', () => {
    render(<ProcessingStatus status="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByLabelText('Processing status: Pending')).toBeInTheDocument()
  })

  it('renders chunking badge', () => {
    render(<ProcessingStatus status="chunking" />)
    expect(screen.getByText('Chunking')).toBeInTheDocument()
  })

  it('renders embedding badge', () => {
    render(<ProcessingStatus status="embedding" />)
    expect(screen.getByText('Embedding')).toBeInTheDocument()
  })

  it('renders error badge', () => {
    render(<ProcessingStatus status="error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })
})
