import { sql, and, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { analyticsSnapshots, type AnalyticsPeriod, type AnalyticsMetricKey } from '@/lib/db/schema/analytics-snapshots'
import type { NewAnalyticsSnapshot } from '@/lib/db/schema/analytics-snapshots'

export interface OrgSnapshotRow {
  metricKey: AnalyticsMetricKey
  dimensionKey: string | null
  metricValue: number
  metadata: {
    label?: string
    count?: number
    breakdown?: Array<{ key: string; value: number; label?: string }>
  } | null
}

export interface AnalyticsFilters {
  period?: AnalyticsPeriod
  startDate?: string
  endDate?: string
  customerId?: string
  rfpType?: string
  assignedUserId?: string
}

/**
 * Computes org-level analytics metrics from live RFP data.
 * Returns rows ready for upsert into analytics_snapshots.
 */
export async function computeOrgSnapshot(
  orgId: string,
  period: AnalyticsPeriod,
  snapshotDate: string
): Promise<NewAnalyticsSnapshot[]> {
  // Base filter: always scoped to org
  const baseWhere = eq(rfps.organizationId, orgId)

  // Total volume
  const volumeResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rfps)
    .where(baseWhere)

  const totalVolume = volumeResult[0]?.count ?? 0

  // Win rate: won / (won + lost)  — only for RFPs with an outcome set
  const outcomeResult = await db
    .select({
      outcome: rfps.outcome,
      count: sql<number>`count(*)::int`,
    })
    .from(rfps)
    .where(and(baseWhere, sql`${rfps.outcome} IS NOT NULL`))
    .groupBy(rfps.outcome)

  const outcomeCounts: Record<string, number> = {}
  for (const row of outcomeResult) {
    if (row.outcome) outcomeCounts[row.outcome] = row.count
  }
  const wonCount = outcomeCounts['won'] ?? 0
  const lostCount = outcomeCounts['lost'] ?? 0
  const totalDecided = wonCount + lostCount
  const winRate = totalDecided > 0 ? wonCount / totalDecided : 0

  // Average days to completion: avg(completionDate - receiveDate) for finalized RFPs
  const avgCompletionResult = await db
    .select({
      avgDays: sql<number>`avg(extract(epoch from (${rfps.updatedAt} - ${rfps.createdAt})) / 86400.0)::real`,
    })
    .from(rfps)
    .where(and(baseWhere, eq(rfps.status, 'finalized')))

  const avgCompletionDays = avgCompletionResult[0]?.avgDays ?? 0

  // Average automation percentage
  const avgAutoResult = await db
    .select({
      avgAuto: sql<number>`avg(${rfps.automationPercentage})::real`,
    })
    .from(rfps)
    .where(baseWhere)

  const avgAutomationPct = avgAutoResult[0]?.avgAuto ?? 0

  const now = new Date()

  const rows: NewAnalyticsSnapshot[] = [
    {
      organizationId: orgId,
      snapshotDate,
      period,
      metricKey: 'volume',
      dimensionKey: null,
      metricValue: totalVolume,
      metadataJson: { count: totalVolume },
      computedAt: now,
    },
    {
      organizationId: orgId,
      snapshotDate,
      period,
      metricKey: 'win_rate',
      dimensionKey: null,
      metricValue: winRate,
      metadataJson: {
        count: totalDecided,
        breakdown: [
          { key: 'won', value: wonCount, label: 'Won' },
          { key: 'lost', value: lostCount, label: 'Lost' },
        ],
      },
      computedAt: now,
    },
    {
      organizationId: orgId,
      snapshotDate,
      period,
      metricKey: 'avg_completion_days',
      dimensionKey: null,
      metricValue: avgCompletionDays,
      metadataJson: null,
      computedAt: now,
    },
    {
      organizationId: orgId,
      snapshotDate,
      period,
      metricKey: 'avg_automation_pct',
      dimensionKey: null,
      metricValue: avgAutomationPct,
      metadataJson: null,
      computedAt: now,
    },
  ]

  return rows
}

/**
 * Queries the analytics_snapshots table with optional filters.
 * Returns raw snapshot rows for the dashboard.
 */
export async function queryAnalyticsSnapshots(
  orgId: string,
  filters: AnalyticsFilters = {}
): Promise<(typeof analyticsSnapshots.$inferSelect)[]> {
  const conditions = [eq(analyticsSnapshots.organizationId, orgId)]

  if (filters.period) conditions.push(eq(analyticsSnapshots.period, filters.period))
  if (filters.startDate) conditions.push(gte(analyticsSnapshots.snapshotDate, filters.startDate))
  if (filters.endDate) conditions.push(lte(analyticsSnapshots.snapshotDate, filters.endDate))

  const rows = await db
    .select()
    .from(analyticsSnapshots)
    .where(and(...(conditions as [typeof conditions[0], ...typeof conditions])))
    .orderBy(analyticsSnapshots.snapshotDate)

  return rows
}
