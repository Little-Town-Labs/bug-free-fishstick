import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { sql } from 'drizzle-orm'

export const computeSnapshots = inngest.createFunction(
  {
    id: 'analytics-compute-snapshots',
    name: 'Compute Analytics Snapshots (Cron)',
  },
  {
    cron: '*/30 * * * *', // Every 30 minutes
  },
  async ({ step }: GetFunctionInput<typeof inngest, 'analytics/compute-snapshots'>) => {
    const orgIds = await step.run('fetch-org-ids', async () => {
      const rows = await db
        .selectDistinct({ organizationId: rfps.organizationId })
        .from(rfps)
      return rows.map((r) => r.organizationId)
    })

    if (orgIds.length === 0) {
      return { status: 'no_orgs', count: 0 }
    }

    const today = new Date().toISOString().split('T')[0]!

    await step.run('fan-out', async () => {
      const events = orgIds.map((organizationId) => ({
        name: 'analytics/compute-org-snapshot' as const,
        data: { organizationId, snapshotDate: today },
      }))
      await inngest.send(events)
    })

    return { status: 'queued', count: orgIds.length, snapshotDate: today }
  }
)
