import { inngest } from '@/lib/inngest/client'
import { getSyncEvent, updateSyncEvent } from '@/lib/services/integration-config'

export const retryFailedSync = inngest.createFunction(
  { id: 'retry-failed-sync', retries: 3 },
  { event: 'integration/retry-failed' },
  async ({ event, step }) => {
    const { syncEventId } = event.data as { syncEventId: string }

    const syncEvent = await step.run('load-sync-event', async () => {
      return getSyncEvent(syncEventId)
    })

    if (!syncEvent) {
      return { skipped: true, reason: `Sync event ${syncEventId} not found` }
    }

    if (syncEvent.status !== 'failed') {
      return { skipped: true, reason: `Sync event is not in failed status: ${syncEvent.status}` }
    }

    // Increment attempt count
    await step.run('increment-attempt', async () => {
      await updateSyncEvent(syncEventId, {
        attemptCount: (syncEvent.attemptCount ?? 0) + 1,
        lastAttemptAt: new Date(),
        status: 'pending',
      })
    })

    // Re-dispatch the original integration event based on integrationType
    await step.run('re-dispatch', async () => {
      const requestPayload = (syncEvent.requestPayload ?? {}) as Record<string, unknown>

      if (syncEvent.integrationType === 'slack') {
        await inngest.send({
          name: 'integration/slack-notify',
          data: {
            organizationId: syncEvent.organizationId,
            eventType: syncEvent.eventType as import('@/lib/db/schema/sync-events').SyncEventType,
            rfpId: String(requestPayload.rfpId ?? syncEvent.referenceId),
            rfpName: String(requestPayload.rfpName ?? ''),
            actorUserId: String(requestPayload.actorUserId ?? ''),
          },
        })
      } else {
        // HubSpot or Salesforce
        const outcome = (requestPayload.outcome === 'lost' ? 'lost' : 'won') as 'won' | 'lost'
        const crmDealId = requestPayload.crmDealId != null ? String(requestPayload.crmDealId) : undefined
        await inngest.send({
          name: 'integration/crm-sync-rfp',
          data: {
            organizationId: syncEvent.organizationId,
            rfpId: String(requestPayload.rfpId ?? syncEvent.referenceId),
            outcome,
            crmDealId,
          },
        })
      }
    })

    return { syncEventId, retried: true }
  }
)
