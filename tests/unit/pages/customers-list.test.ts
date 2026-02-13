import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => createElement('a', { href }, children),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => createElement('div', { 'data-testid': 'card', ...props }, children),
  CardHeader: ({ children }: any) => createElement('div', null, children),
  CardTitle: ({ children }: any) => createElement('h3', null, children),
  CardContent: ({ children }: any) => createElement('div', null, children),
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => createElement('button', props, children),
}))
vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => createElement('input', props),
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => createElement('label', props, children),
}))
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => createElement('div', { 'data-testid': 'skeleton' }),
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => createElement('div', null, children),
  DialogContent: ({ children }: any) => createElement('div', null, children),
  DialogDescription: ({ children }: any) => createElement('p', null, children),
  DialogHeader: ({ children }: any) => createElement('div', null, children),
  DialogTitle: ({ children }: any) => createElement('h2', null, children),
  DialogTrigger: ({ children }: any) => children,
}))

import CustomersPage from '@/app/(auth)/customers/page'

describe('Customers List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders customer rows with names', async () => {
    server.use(
      http.get('*/api/customers', () => {
        return HttpResponse.json({
          customers: [
            { id: '1', name: 'Acme Corp', description: 'Test', createdAt: '2025-01-01' },
            { id: '2', name: 'Globex Inc', description: null, createdAt: '2025-01-02' },
          ],
        })
      })
    )

    render(createElement(CustomersPage))

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy()
      expect(screen.getByText('Globex Inc')).toBeTruthy()
    })
  })

  it('handles empty state', async () => {
    server.use(
      http.get('*/api/customers', () => {
        return HttpResponse.json({ customers: [] })
      })
    )

    render(createElement(CustomersPage))

    await waitFor(() => {
      expect(screen.getByText(/No customers yet/)).toBeTruthy()
    })
  })

  it('shows loading skeletons initially', () => {
    server.use(
      http.get('*/api/customers', () => {
        return new Promise(() => {}) // never resolves
      })
    )

    render(createElement(CustomersPage))
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })
})
