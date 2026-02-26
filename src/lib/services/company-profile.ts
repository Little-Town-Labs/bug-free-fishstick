import { db } from '@/lib/db'
import { tenantSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getCompanyProfile(
  orgId: string
): Promise<{ companyProfile: string | null }> {
  const [row] = await db
    .select({ companyProfile: tenantSettings.companyProfile })
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, orgId))
    .limit(1)

  return { companyProfile: row?.companyProfile ?? null }
}

export async function upsertCompanyProfile(
  orgId: string,
  companyProfile: string | null
): Promise<void> {
  await db
    .insert(tenantSettings)
    .values({
      organizationId: orgId,
      companyProfile,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tenantSettings.organizationId,
      set: { companyProfile, updatedAt: new Date() },
    })
}
