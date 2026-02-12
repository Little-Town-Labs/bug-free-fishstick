import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { validateTransition, WorkflowError } from '@/lib/services/rfp-workflow'
import { inngest } from '@/lib/inngest/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAdmin()
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
