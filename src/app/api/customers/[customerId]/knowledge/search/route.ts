import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { knowledgeSearchSchema } from '@/lib/utils/validation'
import { searchSimilar } from '@/lib/services/vector-search'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { customerId } = await params
    const body = await request.json()

    const parsed = knowledgeSearchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const results = await searchSimilar(
      parsed.data.query,
      customerId,
      auth.orgId,
      parsed.data.limit
    )

    return NextResponse.json({ results }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
