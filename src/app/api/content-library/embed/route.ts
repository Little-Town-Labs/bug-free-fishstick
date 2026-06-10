import { NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { db } from '@/lib/db'
import { proposalContentLibrary } from '@/lib/db/schema/proposal-content-library'
import { eq, and, isNull } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'

export async function POST() {
  try {
    const authContext = await requireAdminLimited()

    const unembedded = await db
      .select({ id: proposalContentLibrary.id })
      .from(proposalContentLibrary)
      .where(
        and(
          eq(proposalContentLibrary.organizationId, authContext.orgId),
          isNull(proposalContentLibrary.embedding)
        )
      )

    if (unembedded.length === 0) {
      return NextResponse.json({ count: 0, message: 'All entries already embedded' }, { status: 200 })
    }

    await inngest.send({
      name: 'content-library/batch-embed',
      data: { organizationId: authContext.orgId },
    })

    return NextResponse.json({ count: unembedded.length, queued: true }, { status: 202 })
  } catch (err) {
    if (err instanceof AuthError) {
      return authErrorResponse(err)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
