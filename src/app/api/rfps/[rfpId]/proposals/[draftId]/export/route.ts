import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { getDraft } from '@/lib/services/proposal-draft'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

type Params = { params: Promise<{ rfpId: string; draftId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireAuth()
    const { rfpId, draftId } = await params

    const draft = await getDraft(draftId, orgId)
    if (!draft) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!draft.markdownContent) {
      return NextResponse.json(
        { error: 'Draft has no content yet — still generating or in error state' },
        { status: 422 }
      )
    }

    // Get RFP name for filename
    const [rfp] = await db
      .select({ name: rfps.name })
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, orgId)))
      .limit(1)

    const rfpName = rfp?.name ?? 'proposal'
    const filename = `proposal-${rfpName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.md`

    return new NextResponse(draft.markdownContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
