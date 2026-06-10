import { NextRequest, NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { reorderProposalTemplates } from '@/lib/services/proposalTemplates'
import { reorderProposalTemplatesSchema } from '@/lib/utils/validation'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminLimited()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = reorderProposalTemplatesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      )
    }

    await reorderProposalTemplates(auth.orgId, parsed.data.items)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    if (error instanceof Error && error.message === 'INVALID_IDS') {
      return NextResponse.json(
        { error: 'One or more template IDs are invalid or do not belong to this organization' },
        { status: 400 }
      )
    }
    console.error('[POST /api/settings/proposal-templates/reorder]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
