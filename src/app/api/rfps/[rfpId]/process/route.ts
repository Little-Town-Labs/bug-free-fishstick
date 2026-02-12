import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { inngest } from '@/lib/inngest/client'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { rfpId } = await params

    // Fetch RFP to check status
    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    // Check if already processing
    if (rfp.status === 'processing') {
      return NextResponse.json(
        { error: 'RFP is already being processed' },
        { status: 409 }
      )
    }

    // Send Inngest event
    await inngest.send({
      name: 'rfp/process',
      data: {
        rfpId,
        organizationId: rfp.organizationId,
      },
    })

    return NextResponse.json(
      { message: 'RFP processing started' },
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
