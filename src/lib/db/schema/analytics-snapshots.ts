import { pgTable, text, real, uuid, jsonb, timestamp, date, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const analyticsMetricKeys = [
  'win_rate',
  'volume',
  'avg_completion_days',
  'avg_automation_pct',
  'top_customer',
] as const
export type AnalyticsMetricKey = (typeof analyticsMetricKeys)[number]

export const analyticsPeriods = ['day', 'week', 'month'] as const
export type AnalyticsPeriod = (typeof analyticsPeriods)[number]

export const analyticsSnapshots = pgTable(
  'analytics_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    snapshotDate: date('snapshot_date').notNull(),
    period: text('period', { enum: analyticsPeriods }).notNull(),
    metricKey: text('metric_key', { enum: analyticsMetricKeys }).notNull(),
    dimensionKey: text('dimension_key'),
    metricValue: real('metric_value').notNull(),
    metadataJson: jsonb('metadata_json').$type<{
      label?: string
      count?: number
      breakdown?: Array<{ key: string; value: number; label?: string }>
    }>(),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('analytics_snapshots_unique_idx').on(
      table.organizationId,
      table.snapshotDate,
      table.period,
      table.metricKey,
      table.dimensionKey
    ),
    index('analytics_snapshots_org_period_idx').on(
      table.organizationId,
      table.period,
      table.metricKey
    ),
  ]
)

export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect
export type NewAnalyticsSnapshot = typeof analyticsSnapshots.$inferInsert
