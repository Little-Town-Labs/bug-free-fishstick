import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { CompanyProfileForm } from './CompanyProfileForm'

// ─── Handler helpers ──────────────────────────────────────────────────────────

function useGetHandler(companyProfile: string | null) {
  server.use(
    http.get('/api/settings/company-profile', () =>
      HttpResponse.json({ companyProfile })
    )
  )
}

function usePatchHandler(status: number, body: Record<string, unknown>) {
  server.use(
    http.patch('/api/settings/company-profile', () =>
      HttpResponse.json(body, { status })
    )
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 1. Initial render & loading ─────────────────────────────────────────────

describe('Initial render', () => {
  it('renders without crashing with isAdmin=true', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  it('renders without crashing with isAdmin=false', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  it('shows loading state on initial mount before GET resolves', () => {
    // Handler will hang, so loading indicator appears
    server.use(
      http.get('/api/settings/company-profile', async () => {
        await new Promise(() => {}) // never resolves
        return HttpResponse.json({ companyProfile: null })
      })
    )
    render(<CompanyProfileForm isAdmin={true} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

// ─── 2. GET population ────────────────────────────────────────────────────────

describe('Profile loading from GET', () => {
  it('populates textarea with fetched profile text', async () => {
    useGetHandler('# About Us\n\nWe build software.')
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('# About Us\n\nWe build software.')
    })
  })

  it('leaves textarea empty when GET returns null', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('')
    })
  })

  it('leaves textarea empty when GET returns empty string', async () => {
    useGetHandler('')
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('')
    })
  })
})

// ─── 3. Character counter ─────────────────────────────────────────────────────

describe('Character counter', () => {
  it('shows "0 / 10000" when textarea is empty', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByText('0 / 10000')).toBeInTheDocument()
    })
  })

  it('updates character count as user types', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
    expect(screen.getByText('5 / 10000')).toBeInTheDocument()
  })

  it('shows correct count when profile is pre-loaded', async () => {
    useGetHandler('# Title')
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByText('7 / 10000')).toBeInTheDocument()
    })
  })

  it('textarea has aria-describedby referencing the counter element', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    const textarea = screen.getByRole('textbox')
    const describedById = textarea.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()
    const counter = document.getElementById(describedById!)
    expect(counter).toBeInTheDocument()
  })
})

// ─── 4. Admin gating ──────────────────────────────────────────────────────────

describe('Admin gating', () => {
  it('textarea is enabled for admin', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).not.toBeDisabled()
    })
  })

  it('textarea is disabled for non-admin', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })

  it('save button is disabled for non-admin', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    })
  })

  it('shows read-only notice for non-admin', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={false} />)
    await waitFor(() => {
      expect(screen.getByText(/read.?only|view.?only|admin only|only admins/i)).toBeInTheDocument()
    })
  })

  it('does NOT show read-only notice for admin', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))
    expect(screen.queryByText(/read.?only|view.?only|admin only|only admins/i)).not.toBeInTheDocument()
  })
})

// ─── 5. Save success flow ─────────────────────────────────────────────────────

describe('Save success', () => {
  it('save button is enabled for admin with content', async () => {
    useGetHandler('# Corp')
    usePatchHandler(200, { success: true })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()
    })
  })

  it('calls PATCH /api/settings/company-profile on save', async () => {
    let patchCalled = false
    server.use(
      http.patch('/api/settings/company-profile', () => {
        patchCalled = true
        return HttpResponse.json({ success: true })
      })
    )
    useGetHandler('# Corp')
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(patchCalled).toBe(true))
  })

  it('shows "Saving…" label while request is in flight', async () => {
    server.use(
      http.patch('/api/settings/company-profile', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json({ success: true })
      })
    )
    useGetHandler('# Corp')
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/saving/i)).toBeInTheDocument()
  })

  it('shows success message after successful save', async () => {
    useGetHandler('# Corp')
    usePatchHandler(200, { success: true })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  it('success message has role="status" for accessibility', async () => {
    useGetHandler('# Corp')
    usePatchHandler(200, { success: true })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      const status = screen.getByRole('status')
      expect(status).toBeInTheDocument()
    })
  })

  it('retains profile text in textarea after successful save', async () => {
    useGetHandler(null)
    usePatchHandler(200, { success: true })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# My Corp' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => screen.getByRole('status'))

    expect(screen.getByRole('textbox')).toHaveValue('# My Corp')
  })
})

// ─── 6. Error handling ────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('shows field error message on 422 response', async () => {
    useGetHandler('# Corp')
    usePatchHandler(422, {
      error: 'Validation failed',
      details: [{ field: 'companyProfile', message: 'String must contain at most 10000 character(s)' }],
    })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('error message has role="alert" for accessibility', async () => {
    useGetHandler('# Corp')
    usePatchHandler(500, { error: 'Internal server error' })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('retains profile text after 422 error', async () => {
    useGetHandler(null)
    usePatchHandler(422, {
      error: 'Validation failed',
      details: [{ field: 'companyProfile', message: 'Too long' }],
    })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# My Corp' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => screen.getByRole('alert'))

    expect(screen.getByRole('textbox')).toHaveValue('# My Corp')
  })

  it('retains profile text after 500 error', async () => {
    useGetHandler(null)
    usePatchHandler(500, { error: 'Internal server error' })
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# My Corp' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => screen.getByRole('alert'))

    expect(screen.getByRole('textbox')).toHaveValue('# My Corp')
  })

  it('shows network error message when fetch throws', async () => {
    useGetHandler(null)
    server.use(
      http.patch('/api/settings/company-profile', () => {
        return HttpResponse.error()
      })
    )
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Corp' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('client-side validation prevents save when content exceeds 10000 chars', async () => {
    useGetHandler(null)
    const patchSpy = vi.fn()
    server.use(
      http.patch('/api/settings/company-profile', () => {
        patchSpy()
        return HttpResponse.json({ success: true })
      })
    )
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x'.repeat(10001) } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await new Promise((r) => setTimeout(r, 50))
    expect(patchSpy).not.toHaveBeenCalled()
  })
})

// ─── 7. Markdown preview ──────────────────────────────────────────────────────

describe('Markdown preview', () => {
  it('shows preview placeholder when textarea is empty', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    expect(screen.getByText(/preview will appear here/i)).toBeInTheDocument()
  })

  it('renders markdown headings in preview pane', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Hello World' } })
    await waitFor(() => {
      const heading = screen.getByRole('heading', { name: 'Hello World' })
      expect(heading).toBeInTheDocument()
    })
  })

  it('updates preview live as user types', async () => {
    useGetHandler(null)
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => screen.getByRole('textbox'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# First' } })
    await waitFor(() => screen.getByRole('heading', { name: 'First' }))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Second' } })
    await waitFor(() => screen.getByRole('heading', { name: 'Second' }))
  })

  it('preview pane is visible alongside the textarea', async () => {
    useGetHandler('# About')
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
    })
  })
})

// ─── 8. Edge case: EC-7 (empty string treated as no profile) ─────────────────

describe('EC-7: empty string profile', () => {
  it('sends empty string to PATCH when textarea is cleared', async () => {
    let patchBody: unknown = null
    server.use(
      http.patch('/api/settings/company-profile', async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json({ success: true })
      })
    )
    useGetHandler('# Corp')
    render(<CompanyProfileForm isAdmin={true} />)
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('# Corp'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => screen.getByRole('status'))

    // empty string or null both acceptable per spec Decision 4
    expect(
      (patchBody as Record<string, unknown>).companyProfile === '' ||
      (patchBody as Record<string, unknown>).companyProfile === null
    ).toBe(true)
  })
})
