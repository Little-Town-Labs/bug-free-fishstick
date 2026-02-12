import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RfpAssignment } from '@/components/rfp/RfpAssignment'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockMembers = [
  {
    userId: 'user-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    orgRole: 'org:admin',
    joinedAt: '2024-01-01T00:00:00Z',
  },
  {
    userId: 'user-2',
    email: 'bob@example.com',
    orgRole: 'org:member',
    joinedAt: '2024-01-02T00:00:00Z',
  },
]

describe('RfpAssignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('non-admin view', () => {
    it('shows display name for current assignee', () => {
      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="user-1"
          isAdmin={false}
          members={mockMembers}
        />
      )
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })

    it('falls back to email when no name', () => {
      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="user-2"
          isAdmin={false}
          members={mockMembers}
        />
      )
      expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    })

    it('falls back to userId when member not found', () => {
      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="unknown-user"
          isAdmin={false}
          members={mockMembers}
        />
      )
      expect(screen.getByText('unknown-user')).toBeInTheDocument()
    })

    it('does not render a select dropdown', () => {
      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="user-1"
          isAdmin={false}
          members={mockMembers}
        />
      )
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })
  })

  describe('admin view', () => {
    it('renders a select dropdown', () => {
      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="user-1"
          isAdmin={true}
          members={mockMembers}
        />
      )
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('shows all members as options', () => {
      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="user-1"
          isAdmin={true}
          members={mockMembers}
        />
      )
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(2)
    })

    it('calls API and updates assignee on change', async () => {
      const user = userEvent.setup()
      const onAssignmentChange = vi.fn()
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="user-1"
          isAdmin={true}
          members={mockMembers}
          onAssignmentChange={onAssignmentChange}
        />
      )

      await user.selectOptions(screen.getByRole('combobox'), 'user-2')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/rfps/rfp-1',
          expect.objectContaining({ method: 'PUT' })
        )
        expect(onAssignmentChange).toHaveBeenCalledWith('user-2')
      })
    })

    it('shows no dropdown when no members', () => {
      render(
        <RfpAssignment
          rfpId="rfp-1"
          currentAssigneeId="user-1"
          isAdmin={true}
          members={[]}
        />
      )
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })
  })
})
