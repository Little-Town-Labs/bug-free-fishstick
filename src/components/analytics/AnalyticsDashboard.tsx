'use client'

import { useState, useEffect, useCallback } from 'react'
import { MetricCard } from './MetricCard'
import { VolumeChart } from './VolumeChart'
import { WinLossBreakdown } from './WinLossBreakdown'
import { TopContributors } from './TopContributors'
import type { AnalyticsFilters } from '@/lib/services/analytics'
import type { AnalyticsSnapshot } from '@/lib/db/schema/analytics-snapshots'

interface AnalyticsDashboardProps {
  snapshots: AnalyticsSnapshot[]
  filters: AnalyticsFilters
  isAdmin: boolean
  dataAsOf: string
}

function extractMetricValue(snapshots: AnalyticsSnapshot[], key: string): number {
  return snapshots.find((s) => s.metricKey === key && !s.dimensionKey)?.metricValue ?? 0
}

export function AnalyticsDashboard({
  snapshots: initialSnapshots,
  filters: initialFilters,
  isAdmin,
  dataAsOf: initialDataAsOf,
}: AnalyticsDashboardProps) {
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters)
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>(initialSnapshots)
  const [dataAsOf, setDataAsOf] = useState(initialDataAsOf)
  const [loading, setLoading] = useState(false)

  const fetchSnapshots = useCallback(async (f: AnalyticsFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.period) params.set('period', f.period)
      if (f.startDate) params.set('startDate', f.startDate)
      if (f.endDate) params.set('endDate', f.endDate)
      const res = await fetch(`/api/analytics?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json() as { snapshots: AnalyticsSnapshot[]; dataAsOf?: string }
      setSnapshots(data.snapshots)
      if (data.dataAsOf) setDataAsOf(data.dataAsOf)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSnapshots(filters)
  }, [filters, fetchSnapshots])

  const totalRfps = extractMetricValue(snapshots, 'volume')
  const winRate = extractMetricValue(snapshots, 'win_rate')
  const avgDays = extractMetricValue(snapshots, 'avg_completion_days')
  const avgAutoPercent = extractMetricValue(snapshots, 'avg_automation_pct')

  // Empty state
  if (totalRfps === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-lg font-semibold mb-2">No RFP data yet</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Complete your first RFP to start seeing analytics. Metrics are refreshed every 30
          minutes.
        </p>
      </div>
    )
  }

  // Build volume chart data from 'volume' snapshots with dimensionKey (day-level breakdowns)
  const volumeData = snapshots
    .filter((s) => s.metricKey === 'volume' && s.dimensionKey?.startsWith('date:'))
    .map((s) => ({
      date: s.dimensionKey?.replace('date:', '') ?? s.snapshotDate,
      count: Math.round(s.metricValue),
    }))

  // Win/loss breakdown placeholder (would come from dimensioned snapshots)
  const winLossData = [
    { type: 'All', won: Math.round(winRate * totalRfps), lost: Math.round((1 - winRate) * totalRfps) },
  ]

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Period:</span>
          <select
            value={filters.period ?? 'day'}
            onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value as AnalyticsFilters['period'] }))}
            className="rounded border bg-background px-2 py-1 text-sm"
            aria-label="Filter by period"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">From:</span>
          <input
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
            className="rounded border bg-background px-2 py-1 text-sm"
            aria-label="Start date filter"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">To:</span>
          <input
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
            className="rounded border bg-background px-2 py-1 text-sm"
            aria-label="End date filter"
          />
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? 'Loading...' : `Data as of ${new Date(dataAsOf).toLocaleString()}`}
        </span>
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          metricKey="volume"
          label="Total RFPs"
          value={Math.round(totalRfps)}
        />
        <MetricCard
          metricKey="win_rate"
          label="Win Rate"
          value={`${(winRate * 100).toFixed(1)}%`}
        />
        <MetricCard
          metricKey="avg_completion_days"
          label="Avg Completion"
          value={avgDays.toFixed(1)}
          unit="days"
        />
        <MetricCard
          metricKey="avg_automation_pct"
          label="Avg Automation"
          value={`${(avgAutoPercent * 100).toFixed(0)}%`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">RFP Volume Over Time</h3>
          <VolumeChart data={volumeData} />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Win / Loss Breakdown</h3>
          <WinLossBreakdown data={winLossData} />
        </div>
      </div>

      {/* Top contributors (admin only) */}
      {isAdmin && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Top Contributors</h3>
          <TopContributors contributors={[]} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  )
}
