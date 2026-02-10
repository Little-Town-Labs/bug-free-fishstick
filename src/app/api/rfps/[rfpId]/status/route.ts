import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    const { rfpId } = await params

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        status: rfp.status,
        automationPercentage: rfp.automationPercentage,
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
