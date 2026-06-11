import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { readJsonBody } from '@/lib/utils/request'
import { knowledgeSearchSchema } from '@/lib/utils/validation'
import { searchSimilar } from '@/lib/services/vector-search'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { customerId } = await params
    const body = await readJsonBody(request)

    const parsed = knowledgeSearchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const results = await searchSimilar(
      parsed.data.query,
      auth.orgId,
      parsed.data.limit,
      customerId
    )

    return NextResponse.json({ results }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}
