import { NextRequest, NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { db } from '@/lib/db'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import { eq, and, isNull } from 'drizzle-orm'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const auth = await requireAdminLimited()
    const { entryId } = await params

    const result = await db
      .delete(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.organizationId, auth.orgId),
          isNull(knowledgeEntries.customerId)
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
