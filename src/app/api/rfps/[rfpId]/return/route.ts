import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { validateTransition, WorkflowError } from '@/lib/services/rfp-workflow'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAdmin()
    const { rfpId } = await params

    const body = await request.json()
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
