import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { readJsonBody } from '@/lib/utils/request'
import { db } from '@/lib/db'
import { learnings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { captureManualLearning } from '@/lib/services/learning-capture'

// GET /api/learnings?customerId=xxx — any authenticated member
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthLimited()
    const customerId = request.nextUrl.searchParams.get('customerId')

    const whereClause = customerId
      ? and(eq(learnings.organizationId, auth.orgId), eq(learnings.customerId, customerId))
      : eq(learnings.organizationId, auth.orgId)

    const rows = await db.select().from(learnings).where(whereClause)

    return NextResponse.json({ learnings: rows })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}

// POST /api/learnings — any authenticated member can add manual learning
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthLimited()
    const body = await readJsonBody(request)

    if (!body.content || typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const learning = await captureManualLearning({
      organizationId: auth.orgId,
      customerId: body.customerId ?? null,
      content: body.content.trim(),
      createdBy: auth.userId,
    })

    return NextResponse.json({ learning }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}
