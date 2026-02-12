import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VersionHistory } from '@/components/rfp/VersionHistory'

describe('VersionHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows loading skeletons initially', () => {
      vi.spyOn(global, 'fetch').mockImplementation(
        () => new Promise(() => {}) // never resolves
      )
      render(<VersionHistory rfpId="rfp-1" />)
      expect(screen.getByTestId('version-history-loading')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty message when no versions returned', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ versions: [] }),
      } as Response)

      render(<VersionHistory rfpId="rfp-1" />)
      await waitFor(() => {
        expect(screen.getByTestId('version-history-empty')).toBeInTheDocument()
      })
    })
  })

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response)

      render(<VersionHistory rfpId="rfp-1" />)
      await waitFor(() => {
        expect(screen.getByTestId('version-history-error')).toBeInTheDocument()
        expect(screen.getByText('Failed to load versions')).toBeInTheDocument()
      })
    })
  })

  describe('with versions', () => {
    const mockVersions = [
      {
        id: 'v1',
        versionNumber: 1,
        changeSummary: 'Initial version',
        createdBy: 'user-1',
        createdAt: '2024-01-15T10:30:00.000Z',
      },
      {
        id: 'v2',
        versionNumber: 2,
        changeSummary: null,
        createdBy: 'user-2',
        createdAt: '2024-01-16T14:00:00.000Z',
      },
    ]

    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ versions: mockVersions }),
      } as Response)
    })

    it('renders version items', async () => {
      render(<VersionHistory rfpId="rfp-1" />)
      await waitFor(() => {
        expect(screen.getAllByTestId('version-item')).toHaveLength(2)
      })
    })

    it('shows version numbers', async () => {
      render(<VersionHistory rfpId="rfp-1" />)
      await waitFor(() => {
        expect(screen.getByText('Version 1')).toBeInTheDocument()
        expect(screen.getByText('Version 2')).toBeInTheDocument()
      })
    })

    it('shows change summary when present', async () => {
      render(<VersionHistory rfpId="rfp-1" />)
      await waitFor(() => {
        expect(screen.getByText('Initial version')).toBeInTheDocument()
      })
    })

    it('does not show summary when null', async () => {
      render(<VersionHistory rfpId="rfp-1" />)
      await waitFor(() => {
        expect(screen.getAllByTestId('version-summary')).toHaveLength(1)
      })
    })

    it('fetches correct URL', async () => {
      render(<VersionHistory rfpId="rfp-abc" />)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/rfps/rfp-abc/versions')
      })
    })
  })
})
