import { NextRequest, NextResponse, after } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { knowledgeEntries, KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'
import { inngest } from '@/lib/inngest/client'
import { put } from '@vercel/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin()

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

    // Upload file and parse content in parallel
    const [blob, content] = await Promise.all([
      put(`knowledge/${auth.orgId}/company/${file.name}`, file, { access: 'public' }),
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

    // Create knowledge entry with null customerId (org-level)
    const estimatedTokens = Math.ceil(content.length / 4)
    const [created] = await db
      .insert(knowledgeEntries)
      .values({
        organizationId: auth.orgId,
        customerId: null,
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
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
