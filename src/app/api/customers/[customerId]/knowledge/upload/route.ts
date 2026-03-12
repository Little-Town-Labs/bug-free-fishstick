import { NextRequest, NextResponse, after } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { db } from '@/lib/db'
import { knowledgeEntries, KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'
import { inngest } from '@/lib/inngest/client'
import { put } from '@vercel/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAdmin()

    const rateLimited = await checkRateLimit(auth.userId, 'upload')
    if (rateLimited) return rateLimited
    const { customerId } = await params

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const title = formData.get('title') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 })
    }

    // Validate file type
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]
    const allowedExtensions = ['.pdf', '.docx', '.txt']
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!allowedMimes.includes(file.type) && !allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Only PDF, DOCX, and TXT files are accepted' }, { status: 400 })
    }

    if (!type || !title) {
      return NextResponse.json({ error: 'Type and title are required' }, { status: 400 })
    }

    // Upload file and parse content in parallel
    const [blob, content] = await Promise.all([
      put(`knowledge/${auth.orgId}/${customerId}/${file.name}`, file, { access: 'public' }),
      file.arrayBuffer().then((buf) => {
        const buffer = Buffer.from(buf)
        if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
          return parsePdf(buffer).then((p) => p.text)
        } else if (
          file.name.endsWith('.docx') ||
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          return parseWord(buffer).then((p) => p.text)
        }
        return buffer.toString('utf-8')
      }),
    ])

    // Create knowledge entry
    const [created] = await db
      .insert(knowledgeEntries)
      .values({
        organizationId: auth.orgId,
        customerId,
        type: type as KnowledgeEntryType,
        title,
        content,
        metadata: {
          sourceFile: file.name,
          sourceUrl: blob.url,
        },
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create knowledge entry')
    }

    // Trigger embedding generation after response is sent — non-blocking
    after(() => inngest.send({
      name: 'rfp/generate-embeddings',
      data: {
        knowledgeEntryId: created.id,
        organizationId: auth.orgId,
        content,
      },
    }))

    return NextResponse.json({ entry: created }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
