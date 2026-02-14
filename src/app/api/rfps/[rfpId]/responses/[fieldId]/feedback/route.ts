import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfpId: string; fieldId: string }> }
) {
  try {
    const authContext = await requireAuth()
    const { rfpId, fieldId } = await params

    // Verify RFP belongs to org
    const rfpResults = await db
      .select({ id: rfps.id, customerId: rfps.customerId })
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, authContext.orgId)))
      .limit(1)

    if (rfpResults.length === 0) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    const body = await request.json()
    const { type, originalText, correctedText } = body

    if (!type || !['accept', 'edit', 'reject'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    await inngest.send({
      name: 'rfp/capture-learning',
      data: {
        type,
        rfpId,
        fieldId,
        organizationId: authContext.orgId,
        customerId: rfpResults[0]!.customerId ?? undefined,
        userId: authContext.userId,
        originalText,
        correctedText,
      },
    })

    return NextResponse.json({ queued: true }, { status: 202 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
