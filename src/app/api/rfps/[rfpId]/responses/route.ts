import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { db } from '@/lib/db'
import { rfpResponses } from '@/lib/db/schema/rfp-responses'
import { eq } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    await requireAuthLimited()
    const { rfpId } = await params

    const responses = await db
      .select()
      .from(rfpResponses)
      .where(eq(rfpResponses.rfpId, rfpId))

    return NextResponse.json({ responses }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}
