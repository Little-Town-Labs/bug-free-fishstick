import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and, inArray } from 'drizzle-orm'

interface UserScore {
  userId: string
  score: number
}

export async function suggestAssignee(
  organizationId: string,
  rfpType: string | null,
  memberIds: string[],
): Promise<string | null> {
  if (memberIds.length === 0) return null
  if (memberIds.length === 1) return memberIds[0] ?? null

  // Score each member
  const scores: UserScore[] = []

  for (const userId of memberIds) {
    let score = 0

    // Past assignments with same type (higher = more experience)
    if (rfpType) {
      const pastSameType = await db
        .select({ id: rfps.id })
        .from(rfps)
        .where(
          and(
            eq(rfps.organizationId, organizationId),
            eq(rfps.assignedUserId, userId),
            eq(rfps.rfpType, rfpType as typeof rfps.rfpType.enumValues[number])
          )
        )
        .limit(20)
      score += pastSameType.length * 2
    }

    // Current in-progress workload (lower = better)
    const inProgress = await db
      .select({ id: rfps.id })
      .from(rfps)
      .where(
        and(
          eq(rfps.organizationId, organizationId),
          eq(rfps.assignedUserId, userId),
          inArray(rfps.status, ['draft', 'processing', 'submitted'])
        )
      )
      .limit(20)
    score -= inProgress.length * 3

    scores.push({ userId, score })
  }

  scores.sort((a, b) => b.score - a.score)
  return scores[0]?.userId ?? null
}
