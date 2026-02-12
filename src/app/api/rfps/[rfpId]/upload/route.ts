import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { put } from '@vercel/blob'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { rfpId } = await params

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Upload to Vercel Blob
    const pathname = `rfps/${rfpId}/${file.name}`
    const blob = await put(pathname, file, { access: 'public' })

    // Update RFP with file URL
    await db
      .update(rfps)
      .set({
        originalFileUrl: blob.url,
        originalFileType: file.name.endsWith('.pdf') ? 'pdf' : 'docx',
        updatedAt: new Date(),
      })
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))

    return NextResponse.json({ url: blob.url }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
