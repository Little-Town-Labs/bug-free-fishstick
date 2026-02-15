'use client'

import { useState } from 'react'
import type { Rfp } from '@/lib/db/schema/rfps'

interface OutcomeSelectorProps {
  rfp: Pick<Rfp, 'id' | 'status' | 'outcome' | 'crmDealId'>
  onOutcomeSet?: (outcome: 'won' | 'lost') => void
}

export function OutcomeSelector({ rfp, onOutcomeSet }: OutcomeSelectorProps) {
  const [pending, setPending] = useState<'won' | 'lost' | null>(null)
  const [crmDealId, setCrmDealId] = useState(rfp.crmDealId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (rfp.status !== 'finalized') return null

  const handleSave = async () => {
    if (!pending) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rfps/${rfp.id}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: pending, crmDealId: crmDealId || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save outcome')
      }
      setSuccess(true)
      onOutcomeSet?.(pending)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (rfp.outcome) {
    return (
      <span
        className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
          rfp.outcome === 'won' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}
        aria-label={`Outcome: ${rfp.outcome}`}
      >
        {rfp.outcome === 'won' ? 'Won' : 'Lost'}
      </span>
    )
  }

  if (success) {
    return (
      <span className="text-sm text-green-600" role="status">
        Outcome saved
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {!pending ? (
        <>
          <button
            type="button"
            onClick={() => setPending('won')}
            className="rounded border border-green-600 px-3 py-1 text-sm text-green-700 hover:bg-green-50"
            aria-label="Mark RFP as won"
          >
            Mark Won
          </button>
          <button
            type="button"
            onClick={() => setPending('lost')}
            className="rounded border border-red-500 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
            aria-label="Mark RFP as lost"
          >
            Mark Lost
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded border p-2">
          <span className="text-sm font-medium">
            Mark as <strong>{pending}</strong>?
          </span>
          <input
            type="text"
            value={crmDealId}
            onChange={(e) => setCrmDealId(e.target.value)}
            placeholder="CRM deal ID (optional)"
            className="rounded border px-2 py-1 text-xs"
            aria-label="CRM deal ID"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setPending(null)}
            className="rounded border px-2 py-1 text-xs"
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
