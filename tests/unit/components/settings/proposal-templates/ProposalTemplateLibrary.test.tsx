/**
 * TDD Red-Phase Unit Tests — ProposalTemplateLibrary
 *
 * The component file does NOT exist yet. All tests are expected to FAIL
 * until `src/components/settings/proposal-templates/ProposalTemplateLibrary.tsx`
 * is created and implemented.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { ProposalTemplateLibrary } from '@/components/settings/proposal-templates/ProposalTemplateLibrary'

// ---------------------------------------------------------------------------
// Clerk mock — component likely calls useOrganization or useAuth
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs', () => ({
  useOrganization: vi.fn(() => ({ organization: { id: 'org_test' } })),
  useAuth: vi.fn(() => ({ orgId: 'org_test', userId: 'user-1' })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockTemplate = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  organizationId: 'org_test',
  section: 'assumptions',
  title: 'Standard Assumptions',
  content: 'All work performed during business hours.',
  isRequired: true,
  triggerRfpTypes: null,
  triggerIndustryTags: ['technology'],
  evaluateCoverage: false,
  sortOrder: 0,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-01-01').toISOString(),
}

const mockSituationalTemplate = {
  ...mockTemplate,
  id: '660e8400-e29b-41d4-a716-446655440001',
  title: 'Situational Template',
  isRequired: false,
  section: 'exclusions',
  sortOrder: 0,
}

// ---------------------------------------------------------------------------
// MSW handler helpers
// ---------------------------------------------------------------------------

function registerTemplatesHandler(templates: unknown[]) {
  server.use(
    http.get('/api/settings/proposal-templates', () => {
      return HttpResponse.json({ templates })
    })
  )
}

function registerNeverResolvingHandler() {
  server.use(
    http.get('/api/settings/proposal-templates', () => {
      return new Promise(() => {
        // intentionally never resolves — simulates loading state
      })
    })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProposalTemplateLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Section rendering', () => {
    it('renders all 8 section headings even when no templates exist', async () => {
      registerTemplatesHandler([])
      render(<ProposalTemplateLibrary isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getByText(/assumptions/i)).toBeInTheDocument()
        expect(screen.getByText(/exclusions/i)).toBeInTheDocument()
        expect(screen.getByText(/payment terms/i)).toBeInTheDocument()
        expect(screen.getByText(/change management/i)).toBeInTheDocument()
        expect(screen.getByText(/ip ownership/i)).toBeInTheDocument()
        expect(screen.getByText(/liability/i)).toBeInTheDocument()
        expect(screen.getByText(/force majeure/i)).toBeInTheDocument()
        expect(screen.getByText(/warranty/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('shows loading state while fetching', () => {
      registerNeverResolvingHandler()
      render(<ProposalTemplateLibrary isAdmin={false} />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Template rendering', () => {
    it('renders template titles when data loads', async () => {
      registerTemplatesHandler([mockTemplate])
      render(<ProposalTemplateLibrary isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getByText('Standard Assumptions')).toBeInTheDocument()
      })
    })

    it('renders "Required" badge for isRequired=true templates', async () => {
      registerTemplatesHandler([mockTemplate])
      render(<ProposalTemplateLibrary isAdmin={false} />)

      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument()
      })
    })

    it('renders "Situational" badge for isRequired=false templates', async () => {
      registerTemplatesHandler([mockSituationalTemplate])
      render(<ProposalTemplateLibrary isAdmin={false} />)

      // Note: template title "Situational Template" also matches /situational/i,
      // so we assert that at least one matching element is present.
      await waitFor(() => {
        expect(screen.getAllByText(/situational/i).length).toBeGreaterThan(0)
      })
    })
  })

  describe('Admin controls — Add Template', () => {
    it('shows "Add Template" buttons for admins', async () => {
      registerTemplatesHandler([])
      render(<ProposalTemplateLibrary isAdmin={true} />)

      await waitFor(() => {
        const addButtons = screen.getAllByRole('button', { name: /add template/i })
        expect(addButtons.length).toBeGreaterThan(0)
      })
    })

    it('does NOT show "Add Template" button for non-admins', async () => {
      registerTemplatesHandler([])
      render(<ProposalTemplateLibrary isAdmin={false} />)

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /add template/i })
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Admin controls — Edit and Delete', () => {
    it('shows edit and delete buttons for admins on each template', async () => {
      registerTemplatesHandler([mockTemplate])
      render(<ProposalTemplateLibrary isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })
    })

    it('does NOT show edit/delete buttons for non-admins', async () => {
      registerTemplatesHandler([mockTemplate])
      render(<ProposalTemplateLibrary isAdmin={false} />)

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /edit/i })
        ).not.toBeInTheDocument()
        expect(
          screen.queryByRole('button', { name: /delete/i })
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Dialog interaction', () => {
    it('opens add dialog when "Add Template" button is clicked (admin)', async () => {
      registerTemplatesHandler([])
      render(<ProposalTemplateLibrary isAdmin={true} />)

      const addBtn = await screen.findAllByRole('button', { name: /add template/i })
      fireEvent.click(addBtn[0])

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
