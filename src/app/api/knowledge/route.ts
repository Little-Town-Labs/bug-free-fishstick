import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { readJsonBody } from '@/lib/utils/request'
import { db } from '@/lib/db'
import { knowledgeEntries, KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'
import { createOrgKnowledgeEntrySchema } from '@/lib/utils/validation'
import { inngest } from '@/lib/inngest/client'
import { eq, and, isNull } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthLimited()

    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)

    const entries = await db
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
          eq(knowledgeEntries.organizationId, auth.orgId),
          isNull(knowledgeEntries.customerId),
          ...(type ? [eq(knowledgeEntries.type, type as KnowledgeEntryType)] : [])
        )
      )
      .limit(limit)

    return NextResponse.json({ entries }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminLimited()
    const body = await readJsonBody(request)

    const parsed = createOrgKnowledgeEntrySchema.safeParse(body)
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
        customerId: null,
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
      return authErrorResponse(error)
    }
    throw error
  }
}
