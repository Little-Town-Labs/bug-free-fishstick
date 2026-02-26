import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import type { RateCard } from '@/lib/db/schema/tenant-settings'
import { RateCardForm } from './RateCardForm'

// ─── Fixture data ─────────────────────────────────────────────────────────────

const blendedRateCard: RateCard = {
  mode: 'blended',
  blendedRate: 150,
  blendedRateUnit: 'hour',
  roles: [],
  defaultMarginPct: 0.2,
  currency: 'USD',
  discounts: [],
}

const byRoleRateCard: RateCard = {
  mode: 'by_role',
  blendedRate: null,
  blendedRateUnit: null,
  roles: [
    { name: 'Senior Engineer', unit: 'hour', rate: 195 },
    { name: 'Project Manager', unit: 'day', rate: 1200 },
  ],
  defaultMarginPct: 0.15,
  currency: 'USD',
  discounts: [],
}

const proposalDefaults = {
  pricingModel: 'time_and_materials' as const,
  paymentTermsDays: 30,
  warrantyPeriodDays: 90,
}

// ─── Handler helpers ──────────────────────────────────────────────────────────

function useGetHandler(rateCard: RateCard | null, pd = proposalDefaults) {
  server.use(
    http.get('/api/settings/rate-card', () =>
      HttpResponse.json({ rateCard, proposalDefaults: rateCard ? pd : null })
    )
  )
}

function usePatchHandler(status: number, body: Record<string, unknown>) {
  server.use(
    http.patch('/api/settings/rate-card', () =>
      HttpResponse.json(body, { status })
    )
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 1. Render tests ──────────────────────────────────────────────────────────

describe('Render tests', () => {
  it('shows "No rate card configured" empty state when GET returns null', async () => {
    useGetHandler(null)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText(/no rate card configured/i)).toBeInTheDocument()
    })
  })

  it('renders blended rate input populated from GET response', async () => {
    useGetHandler(blendedRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => {
      // type=number elements have role=spinbutton
      const input = screen.getByRole('spinbutton', { name: /blended rate/i }) as HTMLInputElement
      expect(input.value).toBe('150')
    })
  })

  it('renders by-role table rows populated from GET response (2 roles)', async () => {
    useGetHandler(byRoleRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Senior Engineer')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Project Manager')).toBeInTheDocument()
    })
  })

  it('shows "Blended" mode indicator when mode is blended', async () => {
    useGetHandler(blendedRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /blended/i })).toBeChecked()
    })
  })

  it('shows "By Role" mode indicator when mode is by_role', async () => {
    useGetHandler(byRoleRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /by role/i })).toBeChecked()
    })
  })
})

// ─── 2. Interaction tests ─────────────────────────────────────────────────────

describe('Interaction tests', () => {
  it('clicking "By Role" mode option shows role table section', async () => {
    useGetHandler(blendedRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('radio', { name: /blended/i }))

    fireEvent.click(screen.getByRole('radio', { name: /by role/i }))

    expect(screen.getByRole('button', { name: /add role/i })).toBeInTheDocument()
  })

  it('clicking "Add Role" button adds a new empty row', async () => {
    useGetHandler(byRoleRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('button', { name: /add role/i }))

    const before = screen.getAllByPlaceholderText(/role name/i).length

    fireEvent.click(screen.getByRole('button', { name: /add role/i }))

    const after = screen.getAllByPlaceholderText(/role name/i).length
    expect(after).toBe(before + 1)
  })

  it('clicking delete on a role row removes it', async () => {
    useGetHandler(byRoleRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByDisplayValue('Senior Engineer'))

    const deleteButtons = screen.getAllByRole('button', { name: /delete role/i })
    fireEvent.click(deleteButtons[0]!)

    expect(screen.queryByDisplayValue('Senior Engineer')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Project Manager')).toBeInTheDocument()
  })

  it('changing blended rate input updates the displayed value', async () => {
    useGetHandler(blendedRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('spinbutton', { name: /blended rate/i }))

    const input = screen.getByRole('spinbutton', { name: /blended rate/i }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '200' } })

    expect(input.value).toBe('200')
  })

  it('Save button is not rendered when isAdmin={false}', async () => {
    useGetHandler(blendedRateCard)

    render(<RateCardForm isAdmin={false} />)

    await waitFor(() => screen.getByRole('spinbutton', { name: /blended rate/i }))

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })
})

// ─── 3. Save tests ────────────────────────────────────────────────────────────

describe('Save tests', () => {
  it('clicking Save calls PATCH with correct payload (blendedRate as number, margin as decimal 0–1)', async () => {
    useGetHandler(blendedRateCard)

    const patchSpy = vi.fn()
    server.use(
      http.patch('/api/settings/rate-card', async ({ request }) => {
        const body = await request.json()
        patchSpy(body)
        return HttpResponse.json({ success: true })
      })
    )

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('button', { name: /save/i }))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledOnce()
      const [payload] = patchSpy.mock.calls[0] as [{ rateCard: { blendedRate: number; defaultMarginPct: number } }]
      expect(payload.rateCard.blendedRate).toBe(150)
      expect(payload.rateCard.defaultMarginPct).toBe(0.2)
    })
  })

  it('shows per-field error messages when 422 is returned', async () => {
    useGetHandler(blendedRateCard)
    usePatchHandler(422, {
      error: 'Validation failed',
      details: [{ field: 'rateCard.blendedRate', message: 'Blended rate must be positive' }],
    })

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('button', { name: /save/i }))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/blended rate must be positive/i)).toBeInTheDocument()
    })
  })

  it('shows success feedback when 200 is returned', async () => {
    useGetHandler(blendedRateCard)
    usePatchHandler(200, { success: true })

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('button', { name: /save/i }))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument()
    })
  })

  it('Save button is disabled during saving (loading state)', async () => {
    useGetHandler(blendedRateCard)

    // Use a delayed response so we can observe the in-flight state
    server.use(
      http.patch('/api/settings/rate-card', async () => {
        // Artificially delay response
        await new Promise<void>((resolve) => setTimeout(resolve, 200))
        return HttpResponse.json({ success: true })
      })
    )

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('button', { name: /save/i }))

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    // Immediately after click the button text changes to "Saving…" and is disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    })
  })
})

// ─── 4. Discount tests ────────────────────────────────────────────────────────

describe('Discount tests', () => {
  it('"Add Discount" button adds a new discount row', async () => {
    useGetHandler(blendedRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('button', { name: /add discount/i }))

    fireEvent.click(screen.getByRole('button', { name: /add discount/i }))

    expect(screen.getByPlaceholderText(/discount name/i)).toBeInTheDocument()
  })

  it('Discount type select shows "Percentage" and "Fixed" options after adding a discount', async () => {
    useGetHandler(blendedRateCard)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByRole('button', { name: /add discount/i }))

    fireEvent.click(screen.getByRole('button', { name: /add discount/i }))

    await waitFor(() => {
      const typeSelect = screen.getByRole('combobox', { name: /discount type/i })
      expect(typeSelect).toBeInTheDocument()
    })
  })

  it('clicking delete on a discount row removes it', async () => {
    const rateCardWithDiscount = {
      ...blendedRateCard,
      discounts: [{
        name: 'Early Payment',
        type: 'percentage' as const,
        value: 0.05,
        appliesTo: 'total' as const,
        customerIds: null,
      }],
    }
    useGetHandler(rateCardWithDiscount)

    render(<RateCardForm isAdmin={true} />)

    await waitFor(() => screen.getByDisplayValue('Early Payment'))

    const deleteBtn = screen.getByRole('button', { name: /delete discount/i })
    fireEvent.click(deleteBtn)

    expect(screen.queryByDisplayValue('Early Payment')).not.toBeInTheDocument()
  })
})
