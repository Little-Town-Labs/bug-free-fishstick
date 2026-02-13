'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProgressTracker } from '@/components/rfp/ProgressTracker'
import { RfpEditor } from '@/components/rfp/RfpEditor'
import { RfpDetailSkeleton } from '@/components/shared/Skeletons'
import { DocumentViewer, type DocumentViewerHandle } from '@/components/rfp/DocumentViewer'
import type { ProposalDraft } from '@/lib/db/schema/proposal-drafts'
import type { Rfp } from '@/lib/db/schema/rfps'

const ProposalDraftPanel = dynamic(
  () => import('@/components/rfp/ProposalDraftPanel').then((m) => m.ProposalDraftPanel),
  { ssr: false }
)

export default function RfpDetailPage() {
  const params = useParams<{ id: string }>()
  const rfpId = params.id

  const [rfp, setRfp] = useState<Rfp | null>(null)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<ProposalDraft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const docViewerRef = useRef<DocumentViewerHandle>(null)

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

  const handleMarkdownExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals`)
      if (!res.ok) return
      const data = await res.json()
      const draft = data.drafts?.find((d: ProposalDraft) => d.status === 'finalized' || d.status === 'draft')
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
        <Link href="/dashboard"><Button variant="outline" className="mt-4">Back to Dashboard</Button></Link>
      </div>
    )
  }

  const isFinalized = rfp.status === 'finalized'
  const isGenerating = isFinalized && !rfp.completedFileUrl && !rfp.completedFileError

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">Back to Dashboard</Button>
        </Link>
        <h1 className="text-2xl font-bold">{rfp.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          {isFinalized && (
            <>
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
                {isGenerating ? 'Generating...' : rfp.completedFileError ? 'Generation Failed' : 'Download Completed RFP'}
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
          <Link href={`/rfps/${rfpId}/proposal`}>
            <Button variant="default">Generate Proposal</Button>
          </Link>
        </div>
      </div>

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
          status={rfp.status === 'submitted' ? 'review' : rfp.status === 'finalized' ? 'completed' : rfp.status as any}
        />

        <RfpEditor
          rfpId={rfpId}
          documentUrl={rfp.originalFileUrl ?? null}
          documentType={rfp.originalFileType as 'pdf' | 'docx' | null}
          parsedStructure={rfp.parsedStructure as any}
          responses={[]}
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

      {!loadingDrafts && (
        <ProposalDraftPanel rfpId={rfpId} initialDrafts={drafts} />
      )}
    </div>
  )
}
