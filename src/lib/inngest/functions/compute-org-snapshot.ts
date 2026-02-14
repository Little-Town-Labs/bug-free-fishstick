import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { analyticsSnapshots } from '@/lib/db/schema/analytics-snapshots'
import { computeOrgSnapshot } from '@/lib/services/analytics'

export const computeOrgSnapshotFunction = inngest.createFunction(
  { id: 'analytics-compute-org-snapshot', name: 'Compute Org Analytics Snapshot' },
  { event: 'analytics/compute-org-snapshot' },
  async ({ event, step }: GetFunctionInput<typeof inngest, 'analytics/compute-org-snapshot'>) => {
    const { organizationId, snapshotDate } = event.data

    const count = await step.run('compute-and-upsert', async () => {
      const rows = await computeOrgSnapshot(organizationId, 'day', snapshotDate)
      if (rows.length === 0) return 0

      for (const row of rows) {
        await db
          .insert(analyticsSnapshots)
          .values(row)
          .onConflictDoUpdate({
            target: [
              analyticsSnapshots.organizationId,
              analyticsSnapshots.snapshotDate,
              analyticsSnapshots.period,
              analyticsSnapshots.metricKey,
              analyticsSnapshots.dimensionKey,
            ],
            set: {
              metricValue: row.metricValue,
              metadataJson: row.metadataJson ?? null,
              computedAt: row.computedAt ?? new Date(),
            },
          })
      }
      return rows.length
    })

    return { organizationId, snapshotDate, metrics: count }
  }
)
