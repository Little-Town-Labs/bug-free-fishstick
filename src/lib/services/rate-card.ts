import { db } from '@/lib/db'
import { tenantSettings } from '@/lib/db/schema'
import type { RateCard, ProposalDefaults } from '@/lib/db/schema/tenant-settings'
import { eq } from 'drizzle-orm'

export async function getRateCard(orgId: string): Promise<{
  rateCard: RateCard | null
  proposalDefaults: ProposalDefaults | null
}> {
  const [row] = await db
    .select({
      rateCard: tenantSettings.rateCard,
      proposalDefaults: tenantSettings.proposalDefaults,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, orgId))
    .limit(1)

  return {
    rateCard: row?.rateCard ?? null,
    proposalDefaults: row?.proposalDefaults ?? null,
  }
}

export async function upsertRateCard(
  orgId: string,
  rateCard: RateCard,
  proposalDefaults: ProposalDefaults
): Promise<void> {
  await db
    .insert(tenantSettings)
    .values({
      organizationId: orgId,
      rateCard,
      proposalDefaults,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenantSettings.organizationId,
      set: { rateCard, proposalDefaults, updatedAt: new Date() },
    })
}
