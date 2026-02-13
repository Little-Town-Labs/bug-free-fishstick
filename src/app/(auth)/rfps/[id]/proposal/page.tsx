'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ClarifyingQuestion, ProposalDraft } from '@/lib/db/schema/proposal-drafts'

const ClarifyingQuestionsForm = dynamic(
  () => import('@/components/rfp/ClarifyingQuestionsForm').then((m) => m.ClarifyingQuestionsForm),
  { ssr: false }
)

const ProposalEditor = dynamic(
  () => import('@/components/rfp/ProposalEditor').then((m) => m.ProposalEditor),
  { ssr: false }
)

const POLL_INTERVAL_MS = 3000

type Step = 'creating' | 'answering' | 'viewing'

function Spinner() {
  return (
    <div className="animate-spin h-5 w-5" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  )
}

export default function ProposalWizardPage() {
  const params = useParams<{ id: string }>()
  const rfpId = params.id
  const searchParams = useSearchParams()
  const existingDraftId = searchParams.get('draftId')

  const [step, setStep] = useState<Step>(existingDraftId ? 'viewing' : 'creating')
  const [draft, setDraft] = useState<ProposalDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 1: create a new draft
  useEffect(() => {
    if (step !== 'creating') return

    const controller = new AbortController()

    async function createDraft() {
      try {
        const res = await fetch(`/api/rfps/${rfpId}/proposals`, {
          method: 'POST',
          signal: controller.signal,
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Failed to create proposal draft')
        }
        const data = await res.json()
        setDraft(data.draft)
        setStep('answering')
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to create proposal draft')
        toast.error(err instanceof Error ? err.message : 'Failed to create proposal draft')
      }
    }

    createDraft()
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Step 3: poll for completion when viewing
  useEffect(() => {
    if (step !== 'viewing') return

    const draftId = draft?.id ?? existingDraftId
    if (!draftId) return

    // If we jumped here from query param, load the draft first
    if (!draft) {
      const controller = new AbortController()
      fetch(`/api/rfps/${rfpId}/proposals/${draftId}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: ProposalDraft) => setDraft(data))
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return
          setError('Failed to load draft')
        })
      return () => controller.abort()
    }

    if (draft.status !== 'generating') return

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/rfps/${rfpId}/proposals/${draftId}`)
        if (res.ok) {
          const updated = (await res.json()) as ProposalDraft
          setDraft(updated)
          if (updated.status !== 'generating') {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
          }
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [step, draft?.status, rfpId, existingDraftId])

  function handleAnswersSubmitted(updatedDraft: ProposalDraft) {
    setDraft(updatedDraft)
    setStep('viewing')
  }

  async function handleExport() {
    if (!draft) return
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals/${draft.id}/export`)
      if (!res.ok) {
        toast.error('Export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposal.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/rfps/${rfpId}`}>
          <Button variant="outline" size="sm">Back to RFP</Button>
        </Link>
        <h1 className="text-2xl font-bold">Generate Proposal</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 'creating' && !error && (
        <div className="flex items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
          <Spinner />
          <span>Preparing questions…</span>
        </div>
      )}

      {step === 'answering' && draft && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Answer Clarifying Questions</h2>
          <ClarifyingQuestionsForm
            rfpId={rfpId}
            draftId={draft.id}
            questions={(draft.clarifyingQuestions ?? []) as ClarifyingQuestion[]}
            onSubmitted={handleAnswersSubmitted}
          />
        </div>
      )}

      {step === 'viewing' && (
        <div className="space-y-4">
          {!draft || draft.status === 'generating' ? (
            <div className="flex items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
              <Spinner />
              <span>Generating your proposal…</span>
            </div>
          ) : null}

          {draft?.status === 'error' && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {draft.generationError ?? 'Generation failed. Please try again.'}
            </div>
          )}

          {(draft?.status === 'draft' || draft?.status === 'finalized') && draft.markdownContent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {draft.status === 'finalized' ? 'Finalized Proposal' : 'Proposal Preview'}
                </h2>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={draft.status !== 'draft' && draft.status !== 'finalized'}
                  className="text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Export proposal as Markdown file"
                >
                  Download .md
                </button>
              </div>
              <ProposalEditor
                rfpId={rfpId}
                draftId={draft.id}
                initialContent={draft.markdownContent}
                status={draft.status as 'draft' | 'finalized'}
                onSaved={setDraft}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
