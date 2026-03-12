import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { checkRateLimit } from '@/lib/utils/rate-limit'
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

    const rateLimited = await checkRateLimit(auth.userId, 'upload')
    if (rateLimited) return rateLimited
    const { rfpId } = await params

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    // Validate file type by extension and MIME type
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    const allowedExtensions = ['.pdf', '.docx']
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!allowedMimes.includes(file.type) && !allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: 'Only PDF and DOCX files are accepted' },
        { status: 400 }
      )
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

    // Return proxy URL instead of raw blob URL to prevent public access
    return NextResponse.json({ url: `/api/rfps/${rfpId}/document` }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
