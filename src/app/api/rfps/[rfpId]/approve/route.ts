import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { validateTransition, WorkflowError } from '@/lib/services/rfp-workflow'
import { inngest } from '@/lib/inngest/client'
import { getIntegrationConfig } from '@/lib/services/integration-config'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAdminLimited()
    const { rfpId } = await params

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    validateTransition(rfp.status, 'approved')

    const [updated] = await db
      .update(rfps)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .returning()

    await inngest.send({
      name: 'rfp/extract-learnings',
      data: { rfpId, organizationId: auth.orgId },
    })

    // Fire Slack notification if configured
    try {
      const slackConfig = await getIntegrationConfig(auth.orgId, 'slack')
      if (slackConfig && slackConfig.isEnabled) {
        await inngest.send({
          name: 'integration/slack-notify',
          data: {
            organizationId: auth.orgId,
            eventType: 'rfp_approved',
            rfpId,
            rfpName: updated?.name ?? rfpId,
            actorUserId: auth.userId,
          },
        })
      }
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ rfp: updated })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof WorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
