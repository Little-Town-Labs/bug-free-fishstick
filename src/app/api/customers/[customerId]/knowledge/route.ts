import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { knowledgeEntries, KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'
import { createKnowledgeEntrySchema } from '@/lib/utils/validation'
import { inngest } from '@/lib/inngest/client'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAuth()
    const { customerId } = await params

    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)

    const query = db
      .select({
        id: knowledgeEntries.id,
        organizationId: knowledgeEntries.organizationId,
        customerId: knowledgeEntries.customerId,
        type: knowledgeEntries.type,
        title: knowledgeEntries.title,
        content: knowledgeEntries.content,
        metadata: knowledgeEntries.metadata,
        createdAt: knowledgeEntries.createdAt,
        updatedAt: knowledgeEntries.updatedAt,
      })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.customerId, customerId),
          eq(knowledgeEntries.organizationId, auth.orgId),
          ...(type ? [eq(knowledgeEntries.type, type as KnowledgeEntryType)] : [])
        )
      )
      .limit(limit)

    const entries = await query

    return NextResponse.json({ entries }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAdmin()
    const { customerId } = await params
    const body = await request.json()

    const parsed = createKnowledgeEntrySchema.safeParse({
      ...body,
      customerId,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const [created] = await db
      .insert(knowledgeEntries)
      .values({
        organizationId: auth.orgId,
        customerId,
        type: parsed.data.type,
        title: parsed.data.title,
        content: parsed.data.content,
        metadata: parsed.data.metadata,
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create knowledge entry')
    }

    // Trigger embedding generation
    await inngest.send({
      name: 'rfp/generate-embeddings',
      data: {
        knowledgeEntryId: created.id,
        organizationId: auth.orgId,
        content: parsed.data.content,
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
