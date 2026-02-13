import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { createDraft, listDrafts } from '@/lib/services/proposal-draft'

type Params = { params: Promise<{ rfpId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireAuth()
    const { rfpId } = await params

    const drafts = await listDrafts(rfpId, orgId)
    return NextResponse.json({ drafts })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId, orgId } = await requireAuth()
    const { rfpId } = await params

    const draft = await createDraft(rfpId, orgId, userId)
    return NextResponse.json({ draft }, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    const statusCode = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode
    if (statusCode === 422) {
      return NextResponse.json({ error: (err as Error).message }, { status: 422 })
    }
    if (statusCode === 404) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
