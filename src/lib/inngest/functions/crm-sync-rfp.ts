import { inngest } from '@/lib/inngest/client'
import {
  getIntegrationConfigWithCredentials,
  createSyncEvent,
  updateSyncEvent,
  updateIntegrationStatus,
} from '@/lib/services/integration-config'
import type { IntegrationType } from '@/lib/services/integration-config'

interface CrmCredentials {
  accessToken: string
  instanceUrl?: string // Salesforce
  portalId?: string   // HubSpot
}

async function syncToHubSpot(credentials: CrmCredentials, rfpId: string, outcome: 'won' | 'lost', crmDealId?: string): Promise<{ ok: boolean; status: number }> {
  const dealId = crmDealId ?? rfpId
  const portalId = credentials.portalId ?? ''
  const url = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.accessToken}`,
    },
    body: JSON.stringify({
      properties: { dealstage: outcome === 'won' ? 'closedwon' : 'closedlost', hs_object_id: portalId },
    }),
  })
  return { ok: response.ok, status: response.status }
}

async function syncToSalesforce(credentials: CrmCredentials, rfpId: string, outcome: 'won' | 'lost', crmDealId?: string): Promise<{ ok: boolean; status: number }> {
  const instanceUrl = credentials.instanceUrl ?? 'https://login.salesforce.com'
  const opportunityId = crmDealId ?? rfpId
  const url = `${instanceUrl}/services/data/v58.0/sobjects/Opportunity/${opportunityId}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.accessToken}`,
    },
    body: JSON.stringify({
      StageName: outcome === 'won' ? 'Closed Won' : 'Closed Lost',
    }),
  })
  return { ok: response.ok, status: response.status }
}

export const crmSyncRfp = inngest.createFunction(
  { id: 'crm-sync-rfp', retries: 3 },
  { event: 'integration/crm-sync-rfp' },
  async ({ event, step }) => {
    const { organizationId, rfpId, outcome, crmDealId } = event.data as {
      organizationId: string
      rfpId: string
      outcome: 'won' | 'lost'
      crmDealId?: string
    }

    const configResult = await step.run('fetch-config', async () => {
      // Try HubSpot first, then Salesforce
      for (const type of ['hubspot', 'salesforce'] as const) {
        const config = await getIntegrationConfigWithCredentials(organizationId, type)
        if (config && config.isEnabled) return { config, type }
      }
      return null
    })

    if (!configResult) {
      return { skipped: true, reason: 'No active CRM integration configured' }
    }

    const { config, type } = configResult as { config: { id: string; credentials: unknown; isEnabled: boolean }; type: IntegrationType }
    const credentials = config.credentials as CrmCredentials

    const syncEventId = await step.run('create-sync-event', async () => {
      const syncEvent = await createSyncEvent({
        integrationConfigId: config.id,
        organizationId,
        integrationType: type,
        eventType: outcome === 'won' ? 'rfp_won' : 'rfp_lost',
        referenceId: rfpId,
        requestPayload: { rfpId, outcome, crmDealId: crmDealId ?? null },
        status: 'pending',
      })
      return syncEvent.id
    })

    const result = await step.run('sync-crm', async () => {
      if (type === 'hubspot') {
        return syncToHubSpot(credentials, rfpId, outcome, crmDealId)
      } else {
        return syncToSalesforce(credentials, rfpId, outcome, crmDealId)
      }
    })

    await step.run('record-result', async () => {
      const success = result.ok

      if (!success) {
        // On 401/403, mark integration as errored
        if (result.status === 401 || result.status === 403) {
          await updateIntegrationStatus(organizationId, type, 'error')
        }
      }

      await updateSyncEvent(syncEventId as string, {
        status: success ? 'success' : 'failed',
        errorMessage: success ? null : `CRM API returned ${result.status}`,
        lastAttemptAt: new Date(),
        attemptCount: 1,
      })
    })

    return { syncEventId, success: result.ok, crmType: type }
  }
)
