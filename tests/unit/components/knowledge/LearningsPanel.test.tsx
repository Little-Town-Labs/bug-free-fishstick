import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LearningsPanel } from '@/components/knowledge/LearningsPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockLearnings = [
  {
    id: 'l1',
    organizationId: 'org-1',
    customerId: null,
    content: 'Learning one',
    sourceType: 'manual_entry',
    sourceRfpId: null,
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'l2',
    organizationId: 'org-1',
    customerId: 'cust-1',
    content: 'Learning two',
    sourceType: 'rfp_approval',
    sourceRfpId: 'rfp-1',
    createdAt: new Date('2024-01-02').toISOString(),
  },
]

describe('LearningsPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows loading text initially', () => {
      vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}))
      render(<LearningsPanel />)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows no learnings message when empty', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ learnings: [] }),
      } as Response)

      render(<LearningsPanel />)
      await waitFor(() => {
        expect(screen.getByText('No learnings yet.')).toBeInTheDocument()
      })
    })
  })

  describe('with learnings', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ learnings: mockLearnings }),
      } as Response)
    })

    it('renders learning entries', async () => {
      render(<LearningsPanel />)
      await waitFor(() => {
        expect(screen.getAllByTestId('learning-entry')).toHaveLength(2)
      })
    })

    it('shows panel title', async () => {
      render(<LearningsPanel />)
      expect(screen.getByText('Learnings & Insights')).toBeInTheDocument()
    })

    it('fetches without customerId filter by default', async () => {
      render(<LearningsPanel />)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/learnings')
      })
    })

    it('fetches with customerId filter when provided', async () => {
      render(<LearningsPanel customerId="cust-42" />)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/learnings?customerId=cust-42')
      })
    })
  })

  describe('with fetch error', () => {
    it('hides loading and shows empty state on error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response)

      render(<LearningsPanel />)
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
        // on error, learnings remain empty so we see "No learnings yet"
        expect(screen.getByText('No learnings yet.')).toBeInTheDocument()
      })
    })
  })
})
