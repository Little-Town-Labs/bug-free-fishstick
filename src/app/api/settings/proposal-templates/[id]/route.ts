import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import {
  updateProposalTemplate,
  deleteProposalTemplate,
} from '@/lib/services/proposalTemplates'
import { updateProposalTemplateSchema } from '@/lib/utils/validation'

const idSchema = z.string().uuid()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    const { id } = await params

    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = updateProposalTemplateSchema.safeParse(body)
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

    const template = await updateProposalTemplate(auth.orgId, id, parsed.data)
    if (template === null) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof Error && error.message === 'isRequired and evaluateCoverage cannot both be true') {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[PATCH /api/settings/proposal-templates/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    const { id } = await params

    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })
    }

    const deleted = await deleteProposalTemplate(auth.orgId, id)
    if (!deleted) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[DELETE /api/settings/proposal-templates/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
