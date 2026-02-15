import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { getIntegrationConfig } from '@/lib/services/integration-config'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { rfpId } = await params
    const body = await request.json()

    const outcome = body.outcome as string | undefined
    if (outcome !== 'won' && outcome !== 'lost') {
      return NextResponse.json({ error: 'outcome must be "won" or "lost"' }, { status: 400 })
    }

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    if (rfp.status !== 'finalized') {
      return NextResponse.json(
        { error: 'Outcome can only be set on finalized RFPs' },
        { status: 400 }
      )
    }

    const now = new Date()
    const crmDealId = body.crmDealId ?? rfp.crmDealId ?? null

    const [updated] = await db
      .update(rfps)
      .set({ outcome, outcomeSetAt: now, crmDealId, updatedAt: now })
      .where(eq(rfps.id, rfpId))
      .returning()

    // Fire CRM sync if integration is configured
    try {
      const crmTypes = ['hubspot', 'salesforce'] as const
      for (const crmType of crmTypes) {
        const config = await getIntegrationConfig(auth.orgId, crmType)
        if (config && config.isEnabled) {
          await inngest.send({
            name: 'integration/crm-sync-rfp',
            data: {
              organizationId: auth.orgId,
              rfpId,
              outcome: outcome as 'won' | 'lost',
              crmDealId: crmDealId ?? undefined,
            },
          })
          break // Only send once for first configured CRM
        }
      }
    } catch {
      // CRM sync failure is non-blocking
    }

    // Fire Slack notification
    try {
      const slackConfig = await getIntegrationConfig(auth.orgId, 'slack')
      if (slackConfig && slackConfig.isEnabled) {
        await inngest.send({
          name: 'integration/slack-notify',
          data: {
            organizationId: auth.orgId,
            eventType: outcome === 'won' ? 'rfp_won' : 'rfp_lost',
            rfpId,
            rfpName: rfp.name,
            actorUserId: auth.userId,
          },
        })
      }
    } catch {
      // Slack notification failure is non-blocking
    }

    return NextResponse.json({ rfp: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[PATCH /api/rfps/[rfpId]/outcome]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
