import { NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const authContext = await requireAdmin()
    const { rfpId } = await params
    const { assignedUserId } = await request.json()

    if (!assignedUserId || typeof assignedUserId !== 'string') {
      return NextResponse.json({ error: 'assignedUserId is required' }, { status: 400 })
    }

    const updated = await db
      .update(rfps)
      .set({ assignedUserId })
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, authContext.orgId)))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    return NextResponse.json({ rfp: updated[0] })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
