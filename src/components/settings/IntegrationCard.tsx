'use client'

import type { IntegrationConfigSummary } from '@/lib/services/integration-config'

interface IntegrationCardProps {
  integration: IntegrationConfigSummary | null
  integrationType: string
  displayName: string
  description: string
  isAdmin: boolean
  onConfigure: () => void
  onDisconnect: () => void
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Connected',
  error: 'Error',
  requires_reconnect: 'Reconnect Required',
}

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  requires_reconnect: 'bg-yellow-100 text-yellow-800',
}

export function IntegrationCard({
  integration,
  integrationType,
  displayName,
  description,
  isAdmin,
  onConfigure,
  onDisconnect,
}: IntegrationCardProps) {
  const isConnected = !!integration
  const status = integration?.status ?? null

  return (
    <div className="rounded-lg border bg-card p-4" aria-label={`${displayName} integration`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{displayName}</h3>
            {status && (
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground'}`}
                aria-label={`Status: ${STATUS_LABELS[status] ?? status}`}
              >
                {STATUS_LABELS[status] ?? status}
              </span>
            )}
            {!isConnected && (
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Not connected
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {integration?.lastVerifiedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last verified: {new Date(integration.lastVerifiedAt).toLocaleString()}
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onConfigure}
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
              aria-label={`Configure ${displayName}`}
            >
              Configure
            </button>
            {isConnected && (
              <button
                type="button"
                onClick={onDisconnect}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                aria-label={`Disconnect ${displayName}`}
              >
                Disconnect
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
