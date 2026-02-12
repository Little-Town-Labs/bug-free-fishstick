'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProgressTracker } from '@/components/rfp/ProgressTracker'
import { RfpEditor } from '@/components/rfp/RfpEditor'
import { RfpDetailSkeleton } from '@/components/shared/Skeletons'

export default function RfpDetailPage() {
  const params = useParams<{ id: string }>()
  const rfpId = params.id

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
    </div>
  )
}
