import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'

const {
  mockGetIntegrationConfigWithCredentials,
  mockCreateSyncEvent,
  mockUpdateSyncEvent,
  mockUpdateIntegrationStatus,
} = vi.hoisted(() => ({
  mockGetIntegrationConfigWithCredentials: vi.fn(),
  mockCreateSyncEvent: vi.fn(),
  mockUpdateSyncEvent: vi.fn(),
  mockUpdateIntegrationStatus: vi.fn(),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(
      (_config: unknown, _eventConfig: unknown, handler: unknown) => handler
    ),
  },
}))

vi.mock('@/lib/services/integration-config', () => ({
  getIntegrationConfigWithCredentials: mockGetIntegrationConfigWithCredentials,
  createSyncEvent: mockCreateSyncEvent,
  updateSyncEvent: mockUpdateSyncEvent,
  updateIntegrationStatus: mockUpdateIntegrationStatus,
}))

import { crmSyncRfp } from '@/lib/inngest/functions/crm-sync-rfp'

function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  }
}

const baseEvent = {
  data: {
    organizationId: 'org-1',
    rfpId: 'rfp-1',
    outcome: 'won' as const,
    crmDealId: 'deal-123',
  },
}

describe('crm-sync-rfp Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSyncEvent.mockResolvedValue({ id: 'sync-1' })
    mockUpdateSyncEvent.mockResolvedValue(undefined)
    mockUpdateIntegrationStatus.mockResolvedValue(undefined)
  })

  it('calls HubSpot API when HubSpot is configured', async () => {
    mockGetIntegrationConfigWithCredentials.mockImplementation((_orgId: string, type: string) => {
      if (type === 'hubspot') {
        return Promise.resolve({ id: 'cfg-1', isEnabled: true, credentials: { accessToken: 'token-hs' } })
      }
      return Promise.resolve(null)
    })

    server.use(
      http.patch('https://api.hubapi.com/crm/v3/objects/deals/:dealId', () =>
        HttpResponse.json({ id: 'deal-123' }, { status: 200 })
      )
    )

    const fn = crmSyncRfp as unknown as (args: unknown) => Promise<unknown>
    const result = await fn({ event: baseEvent, step: createMockStep() }) as { success: boolean; crmType: string }

    expect(result.success).toBe(true)
    expect(result.crmType).toBe('hubspot')
  })

  it('calls Salesforce API when only Salesforce is configured', async () => {
    mockGetIntegrationConfigWithCredentials.mockImplementation((_orgId: string, type: string) => {
      if (type === 'salesforce') {
        return Promise.resolve({ id: 'cfg-2', isEnabled: true, credentials: { accessToken: 'token-sf', instanceUrl: 'https://test.salesforce.com' } })
      }
      return Promise.resolve(null)
    })

    server.use(
      http.patch('https://test.salesforce.com/services/data/:version/sobjects/Opportunity/:id', () =>
        new HttpResponse(null, { status: 204 })
      )
    )

    const fn = crmSyncRfp as unknown as (args: unknown) => Promise<unknown>
    const result = await fn({ event: baseEvent, step: createMockStep() }) as { crmType: string }

    expect(result.crmType).toBe('salesforce')
  })

  it('sets integration_configs.status to error on 401', async () => {
    mockGetIntegrationConfigWithCredentials.mockImplementation((_orgId: string, type: string) => {
      if (type === 'hubspot') {
        return Promise.resolve({ id: 'cfg-1', isEnabled: true, credentials: { accessToken: 'bad-token' } })
      }
      return Promise.resolve(null)
    })

    server.use(
      http.patch('https://api.hubapi.com/crm/v3/objects/deals/:dealId', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    )

    const fn = crmSyncRfp as unknown as (args: unknown) => Promise<unknown>
    await fn({ event: baseEvent, step: createMockStep() })

    expect(mockUpdateIntegrationStatus).toHaveBeenCalledWith('org-1', 'hubspot', 'error')
    expect(mockUpdateSyncEvent).toHaveBeenCalledWith(
      'sync-1',
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('skips when no CRM integration is configured', async () => {
    mockGetIntegrationConfigWithCredentials.mockResolvedValue(null)

    const fn = crmSyncRfp as unknown as (args: unknown) => Promise<unknown>
    const result = await fn({ event: baseEvent, step: createMockStep() }) as { skipped: boolean }

    expect(result.skipped).toBe(true)
  })
})
