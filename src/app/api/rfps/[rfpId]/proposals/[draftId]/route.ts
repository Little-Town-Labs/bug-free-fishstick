import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { getDraft, updateDraft, cancelDraft } from '@/lib/services/proposal-draft'

type Params = { params: Promise<{ rfpId: string; draftId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireAuth()
    const { draftId } = await params

    const draft = await getDraft(draftId, orgId)
    if (!draft) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(draft)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireAuth()
    const { draftId } = await params

    const body = await req.json()
    const patch: { markdownContent?: string; status?: 'draft' | 'finalized' } = {}
    if (typeof body.markdownContent === 'string') patch.markdownContent = body.markdownContent
    if (body.status === 'draft' || body.status === 'finalized') patch.status = body.status

    const draft = await updateDraft(draftId, orgId, patch)
    return NextResponse.json(draft)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    const statusCode = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode
    if (statusCode === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (statusCode === 409) return NextResponse.json({ error: (err as Error).message }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireAuth()
    const { draftId } = await params

    const draft = await cancelDraft(draftId, orgId)
    return NextResponse.json(draft)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    const statusCode = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode
    if (statusCode === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (statusCode === 409) return NextResponse.json({ error: (err as Error).message }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
