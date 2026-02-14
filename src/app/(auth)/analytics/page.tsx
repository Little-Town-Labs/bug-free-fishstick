import { Suspense } from 'react'
import { requireAuth, isAdmin } from '@/lib/utils/auth'
import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { queryAnalyticsSnapshots } from '@/lib/services/analytics'

async function AnalyticsDashboardServer() {
  const auth = await requireAuth().catch(() => null)
  if (!auth) redirect('/sign-in')

  const filters = { period: 'day' as const }
  const snapshots = await queryAnalyticsSnapshots(auth.orgId, filters)

  return (
    <AnalyticsDashboard
      snapshots={snapshots}
      filters={filters}
      isAdmin={isAdmin(auth.orgRole)}
      dataAsOf={new Date().toISOString()}
    />
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsDashboardServer />
      </Suspense>
    </div>
  )
}
