import { NextRequest, NextResponse, after } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { db } from '@/lib/db'
import { knowledgeEntries, KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'
import { customers } from '@/lib/db/schema/customers'
import { inngest } from '@/lib/inngest/client'
import { eq, and } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { sanitizeFilename } from '@/lib/storage/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAdminLimited('upload')

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

    // Verify the customer exists and belongs to this org before writing to storage
    const [existingCustomer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.organizationId, auth.orgId)))
      .limit(1)

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Upload file and parse content in parallel
    const [blob, content] = await Promise.all([
      put(`knowledge/${auth.orgId}/${customerId}/${sanitizeFilename(file.name)}`, file, { access: 'private' }),
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
    const estimatedTokens = Math.ceil(content.length / 4)
    const [created] = await db
      .insert(knowledgeEntries)
      .values({
        organizationId: auth.orgId,
        customerId,
        type: type as KnowledgeEntryType,
        title,
        content,
        processingStatus: estimatedTokens > 2000 ? 'pending' : 'complete',
        metadata: {
          sourceFile: file.name,
          sourceUrl: blob.url,
        },
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create knowledge entry')
    }

    // Large documents get chunked first; small ones get direct embedding
    if (estimatedTokens > 2000) {
      after(() => inngest.send({
        name: 'knowledge/chunk-document',
        data: {
          knowledgeEntryId: created.id,
          organizationId: auth.orgId,
        },
      }))
    } else {
      after(() => inngest.send({
        name: 'rfp/generate-embeddings',
        data: {
          knowledgeEntryId: created.id,
          organizationId: auth.orgId,
          content,
        },
      }))
    }

    return NextResponse.json({ entry: created }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    console.error('[POST /api/customers/knowledge/upload]', error instanceof Error ? error.message : String(error))
    const message =
      error instanceof Error ? error.message : 'Failed to upload document'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
