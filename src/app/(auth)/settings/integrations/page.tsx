'use client'

import { useState, useEffect, useCallback } from 'react'
import { IntegrationCard } from '@/components/settings/IntegrationCard'
import { SlackConfigForm } from '@/components/settings/SlackConfigForm'
import { CrmConfigForm } from '@/components/settings/CrmConfigForm'
import { SyncEventLog } from '@/components/settings/SyncEventLog'
import type { IntegrationConfigSummary, SyncEventSummary } from '@/lib/services/integration-config'

type ConfigureTarget = 'slack' | 'hubspot' | 'salesforce' | null

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationConfigSummary[]>([])
  const [syncEvents, setSyncEvents] = useState<SyncEventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [configuring, setConfiguring] = useState<ConfigureTarget>(null)

  const fetchData = useCallback(async () => {
    try {
      const [intRes, evRes] = await Promise.allSettled([
        fetch('/api/settings/integrations'),
        fetch('/api/settings/integrations/sync-events'),
      ])

      if (intRes.status === 'fulfilled' && intRes.value.ok) {
        const data = await intRes.value.json() as { integrations: IntegrationConfigSummary[] }
        setIntegrations(data.integrations)
        setIsAdmin(true)
      } else if (intRes.status === 'fulfilled' && intRes.value.status === 403) {
        setIsAdmin(false)
      }

      if (evRes.status === 'fulfilled' && evRes.value.ok) {
        const data = await evRes.value.json() as { events: SyncEventSummary[] }
        setSyncEvents(data.events)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getIntegration = (type: string) =>
    integrations.find((i) => i.integrationType === type) ?? null

  const handleSaveIntegration = async (type: string, credentials: Record<string, unknown>) => {
    const res = await fetch(`/api/settings/integrations/${type}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials }),
    })
    if (!res.ok) {
      const data = await res.json() as { error: string }
      throw new Error(data.error)
    }
    setConfiguring(null)
    await fetchData()
  }

  const handleDisconnect = async (type: string) => {
    await fetch(`/api/settings/integrations/${type}`, { method: 'DELETE' })
    setConfiguring(null)
    await fetchData()
  }

  const handleRetry = async (syncEventId: string) => {
    const res = await fetch(`/api/settings/integrations/sync-events/${syncEventId}/retry`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json() as { error: string }
      throw new Error(data.error)
    }
    await fetchData()
  }

  if (loading) {
    return <div className="container mx-auto py-8"><p className="text-muted-foreground">Loading integrations…</p></div>
  }

  const slackIntegration = getIntegration('slack')
  const hubspotIntegration = getIntegration('hubspot')
  const salesforceIntegration = getIntegration('salesforce')

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="mt-1 text-muted-foreground">Connect RFP Automator with your external tools.</p>
      </div>

      <section aria-labelledby="integrations-heading">
        <h2 id="integrations-heading" className="mb-4 text-lg font-semibold">Connected Services</h2>
        <div className="space-y-3">
          <IntegrationCard
            integration={slackIntegration}
            integrationType="slack"
            displayName="Slack"
            description="Send notifications to Slack when RFPs are assigned, approved, or closed."
            isAdmin={isAdmin}
            onConfigure={() => setConfiguring('slack')}
            onDisconnect={() => handleDisconnect('slack')}
          />

          {configuring === 'slack' && (
            <div className="rounded-lg border p-4">
              <h3 className="mb-4 font-medium">Configure Slack</h3>
              <SlackConfigForm
                webhookUrl={(slackIntegration as unknown as { credentials?: { webhookUrl?: string } } | null)?.credentials?.webhookUrl}
                onSave={(data) => handleSaveIntegration('slack', data)}
                onCancel={() => setConfiguring(null)}
              />
            </div>
          )}

          <IntegrationCard
            integration={hubspotIntegration}
            integrationType="hubspot"
            displayName="HubSpot"
            description="Sync RFP outcomes to HubSpot deals automatically."
            isAdmin={isAdmin}
            onConfigure={() => setConfiguring('hubspot')}
            onDisconnect={() => handleDisconnect('hubspot')}
          />

          {configuring === 'hubspot' && (
            <div className="rounded-lg border p-4">
              <h3 className="mb-4 font-medium">Configure HubSpot</h3>
              <CrmConfigForm
                crmType="hubspot"
                isConnected={!!hubspotIntegration}
                onSave={(creds) => handleSaveIntegration('hubspot', creds)}
                onDisconnect={() => handleDisconnect('hubspot')}
                onCancel={() => setConfiguring(null)}
              />
            </div>
          )}

          <IntegrationCard
            integration={salesforceIntegration}
            integrationType="salesforce"
            displayName="Salesforce"
            description="Sync RFP outcomes to Salesforce opportunities automatically."
            isAdmin={isAdmin}
            onConfigure={() => setConfiguring('salesforce')}
            onDisconnect={() => handleDisconnect('salesforce')}
          />

          {configuring === 'salesforce' && (
            <div className="rounded-lg border p-4">
              <h3 className="mb-4 font-medium">Configure Salesforce</h3>
              <CrmConfigForm
                crmType="salesforce"
                isConnected={!!salesforceIntegration}
                onSave={(creds) => handleSaveIntegration('salesforce', creds)}
                onDisconnect={() => handleDisconnect('salesforce')}
                onCancel={() => setConfiguring(null)}
              />
            </div>
          )}
        </div>
      </section>

      {isAdmin && (
        <section aria-labelledby="sync-events-heading">
          <h2 id="sync-events-heading" className="mb-4 text-lg font-semibold">Sync History</h2>
          <SyncEventLog events={syncEvents} onRetry={handleRetry} />
        </section>
      )}
    </div>
  )
}
