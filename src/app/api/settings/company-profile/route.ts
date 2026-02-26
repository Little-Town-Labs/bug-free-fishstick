import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin, AuthError } from '@/lib/utils/auth'
import { getCompanyProfile, upsertCompanyProfile } from '@/lib/services/company-profile'
import { updateCompanyProfileSchema } from '@/lib/utils/validation'

export async function GET() {
  try {
    const auth = await requireAuth()
    const result = await getCompanyProfile(auth.orgId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[GET /api/settings/company-profile]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = updateCompanyProfileSchema.safeParse(body)

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

    await upsertCompanyProfile(auth.orgId, parsed.data.companyProfile)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[PATCH /api/settings/company-profile]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
