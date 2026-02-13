'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProgressTracker } from '@/components/rfp/ProgressTracker'
import { RfpEditor } from '@/components/rfp/RfpEditor'
import { RfpDetailSkeleton } from '@/components/shared/Skeletons'
import type { ProposalDraft } from '@/lib/db/schema/proposal-drafts'

const ProposalDraftPanel = dynamic(
  () => import('@/components/rfp/ProposalDraftPanel').then((m) => m.ProposalDraftPanel),
  { ssr: false }
)

export default function RfpDetailPage() {
  const params = useParams<{ id: string }>()
  const rfpId = params.id

  const [drafts, setDrafts] = useState<ProposalDraft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)

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
        // ignore; panel will show empty state
      } finally {
        setLoadingDrafts(false)
      }
    }
    loadDrafts()
    return () => controller.abort()
  }, [rfpId])

  // Placeholder data - will be replaced by useRfp hook
  const rfp = {
    id: rfpId,
    name: 'Loading...',
    status: 'draft' as const,
    documentUrl: null,
    documentType: null as 'pdf' | 'docx' | null,
    parsedStructure: null,
    automationPercentage: 0,
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">Back to Dashboard</Button>
        </Link>
        <h1 className="text-2xl font-bold">{rfp.name}</h1>
        <div className="ml-auto">
          <Link href={`/rfps/${rfpId}/proposal`}>
            <Button variant="default">Generate Proposal</Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<RfpDetailSkeleton />}>
        <ProgressTracker
          totalFields={0}
          completedFields={0}
          automationPercentage={rfp.automationPercentage}
          status={rfp.status}
        />

        <RfpEditor
          rfpId={rfpId}
          documentUrl={rfp.documentUrl}
          documentType={rfp.documentType}
          parsedStructure={rfp.parsedStructure}
          responses={[]}
        />
      </Suspense>

      {!loadingDrafts && (
        <ProposalDraftPanel rfpId={rfpId} initialDrafts={drafts} />
      )}
    </div>
  )
}
