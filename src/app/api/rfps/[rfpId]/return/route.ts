import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { readJsonBody } from '@/lib/utils/request'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { validateTransition, WorkflowError } from '@/lib/services/rfp-workflow'
import { inngest } from '@/lib/inngest/client'
import { getIntegrationConfig } from '@/lib/services/integration-config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAdminLimited()
    const { rfpId } = await params

    const body = await readJsonBody(request)
    const comments = body?.comments

    if (!comments || typeof comments !== 'string' || comments.trim() === '') {
      return NextResponse.json(
        { error: 'Return comments are required' },
        { status: 400 }
      )
    }

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    validateTransition(rfp.status, 'draft')

    const [updated] = await db
      .update(rfps)
      .set({ status: 'draft', returnComments: comments.trim(), updatedAt: new Date() })
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .returning()

    // Fire Slack notification if configured
    try {
      const slackConfig = await getIntegrationConfig(auth.orgId, 'slack')
      if (slackConfig && slackConfig.isEnabled) {
        await inngest.send({
          name: 'integration/slack-notify',
          data: {
            organizationId: auth.orgId,
            eventType: 'rfp_returned',
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
      return authErrorResponse(error)
    }
    if (error instanceof WorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
