import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)

    const rfpsList = await db
      .select()
      .from(rfps)
      .where(eq(rfps.organizationId, auth.orgId))

    return NextResponse.json({ rfps: rfpsList }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!body.customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    const [createdRfp] = await db
      .insert(rfps)
      .values({
        organizationId: auth.orgId,
        assignedUserId: auth.userId,
        name: body.name,
        customerId: body.customerId,
      })
      .returning()

    return NextResponse.json({ rfp: createdRfp }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
