import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { eq } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    await requireAuth()
    const { rfpId } = await params

    const responses = await db
      .select()
      .from(rfpResponses)
      .where(eq(rfpResponses.rfpId, rfpId))

    return NextResponse.json({ responses }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
