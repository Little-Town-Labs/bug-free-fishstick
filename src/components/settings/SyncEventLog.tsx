'use client'

import { useState } from 'react'
import type { SyncEventSummary } from '@/lib/services/integration-config'

interface SyncEventLogProps {
  events: SyncEventSummary[]
  onRetry?: (syncEventId: string) => Promise<void>
}

const STATUS_CLASSES: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  skipped: 'bg-muted text-muted-foreground',
}

export function SyncEventLog({ events, onRetry }: SyncEventLogProps) {
  const [retrying, setRetrying] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No sync events recorded yet.</p>
  }

  const handleRetry = async (syncEventId: string) => {
    if (!onRetry) return
    setRetrying(syncEventId)
    setRetryError(null)
    try {
      await onRetry(syncEventId)
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : 'Retry failed')
    } finally {
      setRetrying(null)
    }
  }

  return (
    <div>
      {retryError && (
        <p role="alert" className="mb-2 text-sm text-red-600">{retryError}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Sync events">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Type</th>
              <th className="pb-2 pr-4 font-medium">Event</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Error</th>
              <th className="pb-2 pr-4 font-medium">Attempts</th>
              <th className="pb-2 font-medium">Date</th>
              {onRetry && <th className="pb-2 pl-4 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((event) => (
              <tr key={event.id} className="align-top">
                <td className="py-2 pr-4 capitalize">{event.integrationType}</td>
                <td className="py-2 pr-4">{event.eventType}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {event.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs text-red-600 max-w-xs truncate">
                  {event.errorMessage ?? '—'}
                </td>
                <td className="py-2 pr-4 text-center">{event.attemptCount}</td>
                <td className="py-2 text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </td>
                {onRetry && (
                  <td className="py-2 pl-4">
                    {event.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetry(event.id)}
                        disabled={retrying === event.id}
                        className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                        aria-label={`Retry sync event ${event.id}`}
                      >
                        {retrying === event.id ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
