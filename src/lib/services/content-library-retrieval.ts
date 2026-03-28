import { db } from '@/lib/db'
import { proposalContentLibrary } from '@/lib/db/schema/proposal-content-library'
import { searchContentLibrary } from '@/lib/services/content-library-search'
import { eq, and, isNotNull, isNull } from 'drizzle-orm'
import { FIXED_SECTIONS } from '@/lib/constants/fixed-sections'
import type { FixedSectionType } from '@/lib/constants/fixed-sections'
import type { ContentLibraryEntryWithSimilarity } from '@/lib/services/content-library-search'
import type { RateCard } from '@/lib/db/schema/tenant-settings'
import type { RequirementField } from '@/lib/services/proposal-retrieval'

// Re-export for consumers
export type { ContentLibraryEntryWithSimilarity } from '@/lib/services/content-library-search'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_CL_RESULTS = 10
const CL_SEARCH_LIMIT = 5
const MAX_QUERY_LENGTH = 8000

// ─── fetchFixedSectionsForProposal ─────────────────────────────────────────

export async function fetchFixedSectionsForProposal(
  organizationId: string,
): Promise<Record<string, string>> {
  const rows = await db
    .select({
      sectionType: proposalContentLibrary.sectionType,
      content: proposalContentLibrary.content,
    })
    .from(proposalContentLibrary)
    .where(
      and(
        eq(proposalContentLibrary.organizationId, organizationId),
        isNotNull(proposalContentLibrary.sectionType)
      )
    )

  const result: Record<string, string> = {}
  for (const row of rows) {
    if (row.sectionType && row.content.trim()) {
      result[row.sectionType] = row.content
    }
  }
  return result
}

// ─── formatRateCardRoles ────────────────────────────────────────────────────

export function formatRateCardRoles(rateCard: RateCard | null | undefined): string {
  if (!rateCard) return ''
  if (rateCard.mode !== 'by_role') return ''
  if (rateCard.roles.length === 0) return ''

  const lines: string[] = []
  lines.push('**Standard Hourly Rates by Role**')
  lines.push('')
  lines.push('| Role | Rate |')
  lines.push('|---|---|')
  for (const role of rateCard.roles) {
    lines.push(`| ${role.name} | ${rateCard.currency} ${role.rate.toFixed(2)} |`)
  }
  return lines.join('\n')
}

// ─── fetchContentLibraryForProposal (custom entries only) ──────────────────

export async function fetchContentLibraryForProposal(
  organizationId: string,
  rfpFields: RequirementField[],
  openaiApiKey?: string,
): Promise<ContentLibraryEntryWithSimilarity[]> {
  if (rfpFields.length === 0) return []

  try {
    // Semantic search across custom entries only (fixed sections handled separately)
    const combinedQuery = rfpFields.map((f) => f.question).join('. ').slice(0, MAX_QUERY_LENGTH)
    const semanticResults = await searchContentLibrary(
      combinedQuery,
      organizationId,
      CL_SEARCH_LIMIT,
      openaiApiKey,
    )

    // Filter out fixed sections from semantic results (they're injected deterministically)
    const customOnly = semanticResults.filter((entry) => !entry.sectionType)

    return customOnly
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, MAX_CL_RESULTS)
  } catch {
    return []
  }
}
