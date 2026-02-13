'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProposalDraft, ProposalDraftStatus } from '@/lib/db/schema/proposal-drafts'

const POLL_INTERVAL_MS = 3000

interface ProposalDraftPanelProps {
  rfpId: string
  initialDrafts: ProposalDraft[]
}

const statusConfig: Record<
  ProposalDraftStatus,
  { label: string; textColor: string; bgColor: string }
> = {
  awaiting_answers: {
    label: 'Awaiting Answers',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  generating: {
    label: 'Generating',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  draft: {
    label: 'Draft',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  finalized: {
    label: 'Finalized',
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  error: {
    label: 'Error',
    textColor: 'text-red-700',
    bgColor: 'bg-red-100',
  },
}

export function ProposalDraftPanel({ rfpId, initialDrafts }: ProposalDraftPanelProps) {
  const [draftsList, setDraftsList] = useState<ProposalDraft[]>(initialDrafts)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setDraftsList(initialDrafts)
  }, [initialDrafts])

  useEffect(() => {
    const hasGenerating = draftsList.some((d) => d.status === 'generating')

    if (hasGenerating && !intervalRef.current) {
      intervalRef.current = setInterval(async () => {
        const generating = draftsList.filter((d) => d.status === 'generating')
        const updates = await Promise.all(
          generating.map(async (d) => {
            try {
              const res = await fetch(`/api/rfps/${rfpId}/proposals/${d.id}`)
              if (res.ok) return (await res.json()) as ProposalDraft
            } catch {
              // ignore fetch errors during polling
            }
            return null
          })
        )

        setDraftsList((prev) => {
          const next = [...prev]
          for (const updated of updates) {
            if (!updated) continue
            const idx = next.findIndex((d) => d.id === updated.id)
            if (idx !== -1) next[idx] = updated
          }
          return next
        })
      }, POLL_INTERVAL_MS)
    }

    if (!hasGenerating && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current && !hasGenerating) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [draftsList, rfpId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  async function handleRetry() {
    setRetrying(true)
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to retry')
      }
      const data = await res.json()
      setDraftsList((prev) => [data.draft, ...prev])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry')
    } finally {
      setRetrying(false)
    }
  }

  async function handleCancel(draftId: string) {
    setCancelling(draftId)
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals/${draftId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to cancel')
      }
      const updated = (await res.json()) as ProposalDraft
      setDraftsList((prev) => prev.map((d) => (d.id === draftId ? updated : d)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel draft')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div data-testid="proposal-draft-panel" className="rounded-lg border bg-card p-4 space-y-4">
      <h2 className="text-lg font-semibold">Proposal Drafts</h2>

      {draftsList.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proposal drafts yet.</p>
      ) : (
        <ul className="space-y-3">
          {draftsList.map((draft) => {
            const config = statusConfig[draft.status]
            return (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-4 rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    v{draft.version} &middot;{' '}
                    {new Date(draft.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      config.textColor,
                      config.bgColor
                    )}
                  >
                    {config.label}
                  </span>
                  {draft.status === 'error' && draft.generationError && (
                    <p role="alert" className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {draft.generationError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/rfps/${rfpId}/proposal?draftId=${draft.id}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    View
                  </Link>
                  {draft.status === 'error' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retrying}
                      onClick={handleRetry}
                      aria-label={`Retry generating draft v${draft.version}`}
                    >
                      {retrying ? 'Retrying…' : 'Retry'}
                    </Button>
                  )}
                  {draft.status === 'generating' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelling === draft.id}
                      onClick={() => handleCancel(draft.id)}
                      aria-label={`Cancel draft v${draft.version}`}
                    >
                      {cancelling === draft.id ? 'Cancelling…' : 'Cancel'}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
