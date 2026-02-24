'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProgressTracker } from '@/components/rfp/ProgressTracker'
import { RfpEditor } from '@/components/rfp/RfpEditor'
import { RfpDetailSkeleton } from '@/components/shared/Skeletons'
import type { ParsedStructure } from '@/components/rfp/DocumentPreview'
import { DocumentViewer, type DocumentViewerHandle } from '@/components/rfp/DocumentViewer'
import type { ProposalDraft } from '@/lib/db/schema/proposal-drafts'
import { ClassificationBadge } from '@/components/rfp/ClassificationBadge'
import { AssignmentSuggestion } from '@/components/rfp/AssignmentSuggestion'
import { PresenceIndicator } from '@/components/rfp/PresenceIndicator'
import { ActivityLog } from '@/components/rfp/ActivityLog'
import { OutcomeSelector } from '@/components/rfp/OutcomeSelector'
import type { Rfp } from '@/lib/db/schema/rfps'
import type { RfpResponse } from '@/lib/db/schema/rfp-responses'

const ProposalDraftPanel = dynamic(
  () => import('@/components/rfp/ProposalDraftPanel').then((m) => m.ProposalDraftPanel),
  { ssr: false }
)

export default function RfpDetailPage() {
  const params = useParams<{ id: string }>()
  const rfpId = params.id
  const { userId } = useAuth()

  const [rfp, setRfp] = useState<Rfp | null>(null)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<ProposalDraft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [responses, setResponses] = useState<RfpResponse[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const docViewerRef = useRef<DocumentViewerHandle>(null)
  const esRef = useRef<EventSource | null>(null)
  const esReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch RFP data
  useEffect(() => {
    const controller = new AbortController()
    async function loadRfp() {
      try {
        const res = await fetch(`/api/rfps/${rfpId}`, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          setRfp(data.rfp)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      } finally {
        setLoading(false)
      }
    }
    loadRfp()
    return () => controller.abort()
  }, [rfpId])

  // Fetch drafts
  useEffect(() => {
    const controller = new AbortController()
    async function loadDrafts() {
      try {
        const res = await fetch(`/api/rfps/${rfpId}/proposals`, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          setDrafts(data.drafts ?? [])
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      } finally {
        setLoadingDrafts(false)
      }
    }
    loadDrafts()
    return () => controller.abort()
  }, [rfpId])

  // Poll for completedFileUrl when finalized but no URL yet
  useEffect(() => {
    if (rfp?.status === 'finalized' && !rfp.completedFileUrl && !rfp.completedFileError) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/rfps/${rfpId}`)
          if (res.ok) {
            const data = await res.json()
            setRfp(data.rfp)
            if (data.rfp.completedFileUrl || data.rfp.completedFileError) {
              if (pollRef.current) clearInterval(pollRef.current)
            }
          }
        } catch {
          // ignore polling errors
        }
      }, 3000)
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [rfp?.status, rfp?.completedFileUrl, rfp?.completedFileError, rfpId])

  // SSE stream for real-time field updates
  useEffect(() => {
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const es = new EventSource(`/api/rfps/${rfpId}/stream`)
      esRef.current = es

      es.addEventListener('field-updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data as string) as {
            fieldId: string
            value: string | null
            version: number
            updatedAt: string
          }
          setResponses((prev) =>
            prev.map((r) =>
              r.fieldId === payload.fieldId
                ? {
                    ...r,
                    responseText: payload.value,
                    version: payload.version,
                    updatedAt: new Date(payload.updatedAt),
                  }
                : r
            )
          )
        } catch {
          // ignore malformed events
        }
      })

      es.onerror = () => {
        es.close()
        esRef.current = null
        if (!cancelled) {
          esReconnectRef.current = setTimeout(connect, 5_000)
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (esReconnectRef.current) clearTimeout(esReconnectRef.current)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [rfpId])

  const handleMarkdownExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals`)
      if (!res.ok) return
      const data = await res.json()
      const draft = data.drafts?.find(
        (d: ProposalDraft) => d.status === 'finalized' || d.status === 'draft'
      )
      if (draft?.markdownContent) {
        const blob = new Blob([draft.markdownContent], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${rfp?.name || 'rfp'}-export.md`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // ignore
    }
  }, [rfpId, rfp?.name])

  if (loading) return <RfpDetailSkeleton />

  if (!rfp) {
    return (
      <div className="container mx-auto py-8">
        <p>RFP not found.</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  const isFinalized = rfp.status === 'finalized'
  const isGenerating = isFinalized && !rfp.completedFileUrl && !rfp.completedFileError

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{rfp.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          {userId && <PresenceIndicator rfpId={rfpId} currentUserId={userId} />}
          {isFinalized && (
            <>
              <OutcomeSelector
                rfp={{
                  id: rfp.id,
                  status: rfp.status,
                  outcome: rfp.outcome ?? null,
                  crmDealId: rfp.crmDealId ?? null,
                }}
                onOutcomeSet={(outcome) => setRfp((prev) => (prev ? { ...prev, outcome } : prev))}
              />
              <Button
                variant="default"
                disabled={isGenerating}
                onClick={() => {
                  if (rfp.completedFileUrl) {
                    window.open(`/api/rfps/${rfpId}/download`, '_blank')
                  }
                }}
                aria-label="Download completed RFP document"
              >
                {isGenerating
                  ? 'Generating...'
                  : rfp.completedFileError
                    ? 'Generation Failed'
                    : 'Download Completed RFP'}
              </Button>
              <Button
                variant="outline"
                onClick={handleMarkdownExport}
                aria-label="Export RFP as markdown"
              >
                Export Markdown
              </Button>
            </>
          )}
          {(() => {
            const bestDraft =
              drafts.find((d) => d.status === 'draft' || d.status === 'finalized') ??
              drafts.find((d) => d.status === 'awaiting_answers' || d.status === 'generating') ??
              drafts[0]
            return bestDraft ? (
              <Link href={`/rfps/${rfpId}/proposal?draftId=${bestDraft.id}`}>
                <Button variant="default">
                  {bestDraft.status === 'draft' || bestDraft.status === 'finalized'
                    ? 'View Proposal'
                    : 'Continue Proposal'}
                </Button>
              </Link>
            ) : (
              <Link href={`/rfps/${rfpId}/proposal`}>
                <Button variant="default">Generate Proposal</Button>
              </Link>
            )
          })()}
        </div>
      </div>

      {(rfp.rfpType || rfp.complexity) && (
        <div className="flex items-center gap-4 flex-wrap">
          <ClassificationBadge
            rfpType={rfp.rfpType ?? null}
            complexity={rfp.complexity ?? null}
            industryTags={rfp.industryTags as string[] | null}
          />
          <AssignmentSuggestion
            rfpId={rfpId}
            currentAssignee={rfp.assignedUserId}
            suggestedAssigneeId={rfp.suggestedAssigneeId ?? null}
            isAdmin={true}
          />
        </div>
      )}

      {rfp.completedFileError && (
        <p role="alert" className="text-sm text-red-600">
          Document generation failed: {rfp.completedFileError}
        </p>
      )}

      <Suspense fallback={<RfpDetailSkeleton />}>
        <ProgressTracker
          totalFields={0}
          completedFields={0}
          automationPercentage={rfp.automationPercentage ?? 0}
          status={
            rfp.status === 'submitted'
              ? 'review'
              : rfp.status === 'finalized'
                ? 'completed'
                : (rfp.status as 'draft' | 'processing' | 'approved')
          }
        />

        <RfpEditor
          rfpId={rfpId}
          documentUrl={rfp.originalFileUrl ?? null}
          documentType={rfp.originalFileType as 'pdf' | 'docx' | null}
          parsedStructure={rfp.parsedStructure as ParsedStructure | null}
          responses={responses}
          onItemClick={(_fieldId, page) => {
            if (page !== undefined) docViewerRef.current?.scrollToPage(page)
          }}
          documentViewer={
            rfp.originalFileUrl ? (
              <DocumentViewer
                ref={docViewerRef}
                documentUrl={`/api/rfps/${rfpId}/document`}
                documentType={rfp.originalFileType as 'pdf' | 'docx' | null}
              />
            ) : undefined
          }
        />
      </Suspense>

      {responses.length > 0 && (
        <section aria-label="Activity log">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recent Edits</h2>
          <ActivityLog responses={responses} />
        </section>
      )}

      {!loadingDrafts && <ProposalDraftPanel rfpId={rfpId} initialDrafts={drafts} />}
    </div>
  )
}
