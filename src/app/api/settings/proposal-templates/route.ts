import { NextRequest, NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import {
  listProposalTemplates,
  createProposalTemplate,
} from '@/lib/services/proposalTemplates'
import { createProposalTemplateSchema } from '@/lib/utils/validation'

export async function GET() {
  try {
    const auth = await requireAdminLimited()
    const templates = await listProposalTemplates(auth.orgId)
    return NextResponse.json({ templates })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[GET /api/settings/proposal-templates]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminLimited()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createProposalTemplateSchema.safeParse(body)
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

    const template = await createProposalTemplate(auth.orgId, auth.userId, parsed.data)
    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[POST /api/settings/proposal-templates]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
