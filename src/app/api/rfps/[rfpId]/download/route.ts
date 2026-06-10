import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'
import { downloadFile } from '@/lib/storage/blob'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { rfpId } = await params

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    if (rfp.completedFileUrl) {
      // Blobs are private — proxy the bytes rather than redirecting to the
      // blob URL, which is not directly readable by the browser.
      const buffer = await downloadFile(rfp.completedFileUrl)

      const fileType = rfp.originalFileType === 'docx' ? 'docx' : 'pdf'
      const contentType = fileType === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="completed-rfp.${fileType}"`,
          'Cache-Control': 'private, max-age=0',
        },
      })
    }

    return NextResponse.json(
      {
        error: 'Completed document not available',
        completedFileError: rfp.completedFileError ?? null,
      },
      { status: 404 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}
