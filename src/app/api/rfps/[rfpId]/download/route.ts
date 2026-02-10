import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    const { rfpId } = await params

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    if (!rfp.completedFileUrl) {
      return NextResponse.json(
        { error: 'No completed file available' },
        { status: 404 }
      )
    }

    // Fetch the file from blob storage
    const fileResponse = await fetch(rfp.completedFileUrl)

    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      )
    }

    const blob = await fileResponse.blob()
    const contentType = fileResponse.headers?.get('content-type') || 'application/octet-stream'

    return new Response(blob, {
      status: 200,
      headers: {
        'content-type': contentType,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
