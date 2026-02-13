import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'cust-1' }),
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => createElement('a', { href }, children),
}))
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => createElement('div', { 'data-testid': 'card' }, children),
  CardHeader: ({ children }: any) => createElement('div', null, children),
  CardTitle: ({ children }: any) => createElement('h3', null, children),
  CardContent: ({ children }: any) => createElement('div', null, children),
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => createElement('button', props, children),
}))
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => createElement('span', null, children),
}))
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => createElement('div', { 'data-testid': 'skeleton' }),
}))
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => createElement('div', null, children),
  TabsContent: ({ children, value }: any) => createElement('div', { 'data-testid': `tab-${value}` }, children),
  TabsList: ({ children }: any) => createElement('div', null, children),
  TabsTrigger: ({ children }: any) => createElement('button', null, children),
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => createElement('div', null, children),
  DialogContent: ({ children }: any) => createElement('div', null, children),
  DialogHeader: ({ children }: any) => createElement('div', null, children),
  DialogTitle: ({ children }: any) => createElement('h2', null, children),
  DialogTrigger: ({ children }: any) => children,
}))
vi.mock('@/components/knowledge/KnowledgeEntryCard', () => ({
  KnowledgeEntryCard: () => createElement('div', { 'data-testid': 'kb-card' }),
}))
vi.mock('@/components/knowledge/KnowledgeUploader', () => ({
  KnowledgeUploader: () => createElement('div'),
}))
vi.mock('@/components/customers/CustomerSettingsForm', () => ({
  CustomerSettingsForm: () => createElement('div', { 'data-testid': 'settings-form' }, 'Settings Form'),
}))

import CustomerDetailPage from '@/app/(auth)/customers/[id]/page'

describe('Customer Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    server.use(
      http.get('*/api/customers/cust-1', () => {
        return HttpResponse.json({
          customer: {
            id: 'cust-1',
            name: 'Acme Corp',
            description: 'Big company',
            settings: { preferredTone: 'formal' },
            createdAt: '2025-01-01',
            stats: { knowledgeEntries: 5, totalRfps: 3 },
          },
        })
      }),
      http.get('*/api/customers/cust-1/knowledge', () => {
        return HttpResponse.json({ entries: [] })
      }),
      http.get('*/api/rfps', () => {
        return HttpResponse.json({ rfps: [] })
      })
    )
  })

  it('renders customer profile with name', async () => {
    render(createElement(CustomerDetailPage))

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy()
    })
  })

  it('renders settings form', async () => {
    render(createElement(CustomerDetailPage))

    await waitFor(() => {
      expect(screen.getByTestId('settings-form')).toBeTruthy()
    })
  })

  it('renders RFP history tab', async () => {
    render(createElement(CustomerDetailPage))

    await waitFor(() => {
      expect(screen.getByText('RFP History')).toBeTruthy()
    })
  })

  it('renders knowledge base tab', async () => {
    render(createElement(CustomerDetailPage))

    await waitFor(() => {
      expect(screen.getByText('Knowledge Entries')).toBeTruthy()
    })
  })
})
