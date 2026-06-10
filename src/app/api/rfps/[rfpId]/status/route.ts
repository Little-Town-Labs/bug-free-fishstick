import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { rfpId } = await params

    const [[rfp], allResponses] = await Promise.all([
      db.select().from(rfps)
        .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
        .limit(1),
      db.select().from(rfpResponses).where(eq(rfpResponses.rfpId, rfpId)),
    ])

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    const totalResponses = allResponses.length
    const completedResponses = allResponses.filter(
      (r) => r.status === 'approved' || r.status === 'manually_filled'
    ).length
    const completionPercentage =
      totalResponses === 0 ? 0 : Math.round((completedResponses / totalResponses) * 100)

    return NextResponse.json(
      {
        status: rfp.status,
        automationPercentage: rfp.automationPercentage,
        completionPercentage,
        totalResponses,
        completedResponses,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
