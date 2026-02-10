import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
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
    const { customerId } = await params

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const title = formData.get('title') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!type || !title) {
      return NextResponse.json({ error: 'Type and title are required' }, { status: 400 })
    }

    // Upload file to blob storage
    const blob = await put(`knowledge/${auth.orgId}/${customerId}/${file.name}`, file, {
      access: 'public',
    })

    // Parse file content
    const buffer = Buffer.from(await file.arrayBuffer())
    let content: string

    if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
      content = await parsePdf(buffer)
    } else if (
      file.name.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      content = await parseWord(buffer)
    } else {
      // For plain text or other formats, read as text
      content = buffer.toString('utf-8')
    }

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

    // Trigger embedding generation
    await inngest.send({
      name: 'rfp/generate-embeddings',
      data: {
        knowledgeEntryId: created.id,
        organizationId: auth.orgId,
        content,
      },
    })

    return NextResponse.json({ entry: created }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
