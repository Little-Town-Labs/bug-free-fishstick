import { inngest } from '@/lib/inngest/client'
import { getIntegrationConfigWithCredentials, createSyncEvent, updateSyncEvent } from '@/lib/services/integration-config'
import type { SyncEventType } from '@/lib/db/schema/sync-events'

export const slackNotify = inngest.createFunction(
  { id: 'slack-notify', retries: 3 },
  { event: 'integration/slack-notify' },
  async ({ event, step }) => {
    const { organizationId, eventType, rfpId, rfpName, actorUserId } = event.data as {
      organizationId: string
      eventType: SyncEventType
      rfpId: string
      rfpName: string
      actorUserId: string
    }

    const config = await step.run('fetch-config', async () => {
      return getIntegrationConfigWithCredentials(organizationId, 'slack')
    })

    if (!config || !config.isEnabled) {
      return { skipped: true, reason: 'Slack integration not configured or disabled' }
    }

    const credentials = config.credentials as { webhookUrl?: string }
    const webhookUrl = credentials.webhookUrl

    if (!webhookUrl) {
      return { skipped: true, reason: 'No webhook URL configured' }
    }

    // Create a pending sync event record
    const syncEventId = await step.run('create-sync-event', async () => {
      const syncEvent = await createSyncEvent({
        integrationConfigId: config.id,
        organizationId,
        integrationType: 'slack',
        eventType,
        referenceId: rfpId,
        requestPayload: { eventType, rfpId, rfpName, actorUserId },
        status: 'pending',
      })
      return syncEvent.id
    })

    const result = await step.run('send-webhook', async () => {
      const text = buildSlackMessage(eventType, rfpName)
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      return { ok: response.ok, status: response.status }
    })

    await step.run('record-result', async () => {
      await updateSyncEvent(syncEventId as string, {
        status: result.ok ? 'success' : 'failed',
        errorMessage: result.ok ? null : `Slack webhook returned ${result.status}`,
        lastAttemptAt: new Date(),
        attemptCount: 1,
      })
    })

    return { syncEventId, success: result.ok }
  }
)

function buildSlackMessage(eventType: string, rfpName: string): string {
  switch (eventType) {
    case 'rfp_assigned':
      return `RFP "${rfpName}" has been assigned.`
    case 'rfp_approved':
      return `RFP "${rfpName}" has been approved.`
    case 'rfp_returned':
      return `RFP "${rfpName}" was returned for revisions.`
    case 'rfp_won':
      return `:trophy: RFP "${rfpName}" was marked as *Won*!`
    case 'rfp_lost':
      return `RFP "${rfpName}" was marked as Lost.`
    default:
      return `RFP "${rfpName}" — ${eventType}`
  }
}
