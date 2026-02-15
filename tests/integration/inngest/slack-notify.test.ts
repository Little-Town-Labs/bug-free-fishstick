import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'

const {
  mockGetIntegrationConfigWithCredentials,
  mockCreateSyncEvent,
  mockUpdateSyncEvent,
} = vi.hoisted(() => ({
  mockGetIntegrationConfigWithCredentials: vi.fn(),
  mockCreateSyncEvent: vi.fn(),
  mockUpdateSyncEvent: vi.fn(),
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
}))

import { slackNotify } from '@/lib/inngest/functions/slack-notify'

function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  }
}

const WEBHOOK_URL = 'https://hooks.slack.com/services/test'

const baseEvent = {
  data: {
    organizationId: 'org-1',
    eventType: 'rfp_approved' as const,
    rfpId: 'rfp-1',
    rfpName: 'My RFP',
    actorUserId: 'user-1',
  },
}

const slackConfig = {
  id: 'cfg-1',
  isEnabled: true,
  credentials: { webhookUrl: WEBHOOK_URL },
}

describe('slack-notify Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSyncEvent.mockResolvedValue({ id: 'sync-1' })
    mockUpdateSyncEvent.mockResolvedValue(undefined)
  })

  it('calls Slack webhook with correct payload', async () => {
    mockGetIntegrationConfigWithCredentials.mockResolvedValue(slackConfig)

    let capturedBody: unknown = null
    server.use(
      http.post(WEBHOOK_URL, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({}, { status: 200 })
      })
    )

    const fn = slackNotify as unknown as (args: unknown) => Promise<unknown>
    await fn({ event: baseEvent, step: createMockStep() })

    expect(capturedBody).not.toBeNull()
    const body = capturedBody as { text: string }
    expect(body.text).toContain('My RFP')
    expect(body.text).toContain('approved')
  })

  it('creates sync_events record with status success on 2xx', async () => {
    mockGetIntegrationConfigWithCredentials.mockResolvedValue(slackConfig)
    server.use(
      http.post(WEBHOOK_URL, () => HttpResponse.json({}, { status: 200 }))
    )

    const fn = slackNotify as unknown as (args: unknown) => Promise<unknown>
    await fn({ event: baseEvent, step: createMockStep() })

    expect(mockCreateSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'rfp_approved', status: 'pending' })
    )
    expect(mockUpdateSyncEvent).toHaveBeenCalledWith(
      'sync-1',
      expect.objectContaining({ status: 'success' })
    )
  })

  it('creates sync_events record with status failed on non-2xx', async () => {
    mockGetIntegrationConfigWithCredentials.mockResolvedValue(slackConfig)
    server.use(
      http.post(WEBHOOK_URL, () => HttpResponse.json({}, { status: 500 }))
    )

    const fn = slackNotify as unknown as (args: unknown) => Promise<unknown>
    await fn({ event: baseEvent, step: createMockStep() })

    expect(mockUpdateSyncEvent).toHaveBeenCalledWith(
      'sync-1',
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('skips when Slack integration is not configured', async () => {
    mockGetIntegrationConfigWithCredentials.mockResolvedValue(null)

    const fn = slackNotify as unknown as (args: unknown) => Promise<unknown>
    const result = await fn({ event: baseEvent, step: createMockStep() }) as { skipped: boolean }

    expect(result.skipped).toBe(true)
    expect(mockCreateSyncEvent).not.toHaveBeenCalled()
  })
})
