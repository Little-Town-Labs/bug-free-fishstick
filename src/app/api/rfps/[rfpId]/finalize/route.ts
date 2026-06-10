import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { validateTransition, WorkflowError } from '@/lib/services/rfp-workflow'
import { createVersionSnapshot } from '@/lib/services/rfp-versions'
import { inngest } from '@/lib/inngest/client'

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

    validateTransition(rfp.status, 'finalized')

    // Create version snapshot before finalizing
    await createVersionSnapshot(rfpId, auth.orgId, auth.userId, 'Finalized')

    const [updated] = await db
      .update(rfps)
      .set({ status: 'finalized', updatedAt: new Date() })
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .returning()

    // Queue background document generation
    await inngest.send({
      name: 'rfp/generate-completed-document',
      data: {
        rfpId,
        organizationId: auth.orgId,
      },
    })

    return NextResponse.json({ rfp: updated, documentGenerationQueued: true })
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
