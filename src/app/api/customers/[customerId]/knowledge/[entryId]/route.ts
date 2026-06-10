import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { db } from '@/lib/db'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string; entryId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { customerId, entryId } = await params

    const [entry] = await db
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
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.customerId, customerId),
          eq(knowledgeEntries.organizationId, auth.orgId)
        )
      )
      .limit(1)

    if (!entry) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 })
    }

    return NextResponse.json({ entry }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string; entryId: string }> }
) {
  try {
    const auth = await requireAdminLimited()
    const { customerId, entryId } = await params

    const result = await db
      .delete(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.customerId, customerId),
          eq(knowledgeEntries.organizationId, auth.orgId)
        )
      )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error)
    }
    throw error
  }
}
