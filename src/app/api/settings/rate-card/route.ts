import { NextRequest, NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { getRateCard, upsertRateCard } from '@/lib/services/rate-card'
import { createRateCardPatchSchema } from '@/lib/utils/validation'

export async function GET() {
  try {
    const auth = await requireAdminLimited()
    const result = await getRateCard(auth.orgId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    console.error('[GET /api/settings/rate-card]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminLimited()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createRateCardPatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 422 }
      )
    }

    await upsertRateCard(auth.orgId, parsed.data.rateCard, parsed.data.proposalDefaults)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    console.error('[PATCH /api/settings/rate-card]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
