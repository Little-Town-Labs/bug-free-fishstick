import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { rfpVersions } from '@/lib/db/schema/rfp-versions'
import type { RfpVersion } from '@/lib/db/schema/rfp-versions'

export async function createVersionSnapshot(
  rfpId: string,
  orgId: string,
  createdBy: string,
  changeSummary: string
): Promise<RfpVersion> {
  // 1. Fetch all responses for this RFP
  const responses = await db
    .select()
    .from(rfpResponses)
    .where(eq(rfpResponses.rfpId, rfpId))

  // 2. Fetch the RFP to get current version and automationPercentage
  const rfpRows = await db
    .select()
    .from(rfps)
    .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, orgId)))
    .limit(1)

  const rfp = rfpRows[0]
  if (!rfp) {
    throw new Error(`RFP not found: ${rfpId}`)
  }

  const versionNumber = rfp.version

  // 3. Insert version snapshot
  const versionRows = await db
    .insert(rfpVersions)
    .values({
      rfpId,
      versionNumber,
      createdBy,
      changeSummary,
      snapshot: {
        responses: responses.map((r) => ({
          fieldId: r.fieldId,
          responseText: r.responseText ?? '',
          status: r.status,
        })),
        automationPercentage: rfp.automationPercentage ?? 0,
      },
    })
    .returning()

  const version = versionRows[0]
  if (!version) {
    throw new Error('Failed to create version snapshot')
  }

  // 4. Increment the rfp version counter
  await db
    .update(rfps)
    .set({ version: versionNumber + 1 })
    .where(eq(rfps.id, rfpId))

  return version
}
