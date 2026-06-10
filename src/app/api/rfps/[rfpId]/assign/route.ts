import { NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { readJsonBody } from '@/lib/utils/request'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { getIntegrationConfig } from '@/lib/services/integration-config'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const authContext = await requireAdminLimited()
    const { rfpId } = await params
    const { assignedUserId } = await readJsonBody(request)

    if (!assignedUserId || typeof assignedUserId !== 'string') {
      return NextResponse.json({ error: 'assignedUserId is required' }, { status: 400 })
    }

    const updated = await db
      .update(rfps)
      .set({ assignedUserId })
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, authContext.orgId)))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    // Fire Slack notification if configured
    try {
      const slackConfig = await getIntegrationConfig(authContext.orgId, 'slack')
      if (slackConfig && slackConfig.isEnabled) {
        await inngest.send({
          name: 'integration/slack-notify',
          data: {
            organizationId: authContext.orgId,
            eventType: 'rfp_assigned',
            rfpId,
            rfpName: updated[0]?.name ?? rfpId,
            actorUserId: authContext.userId,
          },
        })
      }
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ rfp: updated[0] })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
