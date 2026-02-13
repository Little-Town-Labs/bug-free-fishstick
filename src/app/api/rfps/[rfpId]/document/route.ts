import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'
import { downloadFile } from '@/lib/storage/blob'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { rfpId } = await params

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    if (!rfp.originalFileUrl) {
      return NextResponse.json({ error: 'No document uploaded for this RFP' }, { status: 404 })
    }

    const buffer = await downloadFile(rfp.originalFileUrl)

    const contentType = rfp.originalFileType === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="document.${rfp.originalFileType || 'pdf'}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
