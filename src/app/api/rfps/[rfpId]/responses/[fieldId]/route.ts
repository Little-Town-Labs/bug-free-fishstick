import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import type { NewRfpResponse } from '@/lib/db/schema/rfp-responses'
import { eq, and } from 'drizzle-orm'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string; fieldId: string }> }
) {
  try {
    await requireAuth()
    const { rfpId, fieldId } = await params
    const body = await request.json()

    // Validate required field
    if (!body.responseText && body.responseText !== '') {
      return NextResponse.json(
        { error: 'responseText is required' },
        { status: 400 }
      )
    }

    const updateData: Partial<NewRfpResponse> = {
      updatedAt: new Date(),
    }

    if (body.responseText !== undefined) {
      updateData.responseText = body.responseText
    }

    if (body.status) {
      updateData.status = body.status
    }

    const [updatedResponse] = await db
      .update(rfpResponses)
      .set(updateData)
      .where(
        and(
          eq(rfpResponses.rfpId, rfpId),
          eq(rfpResponses.fieldId, fieldId)
        )
      )
      .returning()

    if (!updatedResponse) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 })
    }

    return NextResponse.json({ response: updatedResponse }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
