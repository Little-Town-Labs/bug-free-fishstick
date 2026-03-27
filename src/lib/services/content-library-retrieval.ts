import { searchContentLibrary, searchContentLibraryByCategory } from '@/lib/services/content-library-search'
import type { ContentLibraryEntryWithSimilarity } from '@/lib/services/content-library-search'
import type { RateCard } from '@/lib/db/schema/tenant-settings'
import type { RequirementField } from '@/lib/services/proposal-retrieval'

// Re-export for consumers
export type { ContentLibraryEntryWithSimilarity } from '@/lib/services/content-library-search'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_CL_RESULTS = 10
const CL_SEARCH_LIMIT = 5
const MAX_QUERY_LENGTH = 8000

const VENDOR_PROFILE_KEYWORDS = [
  'company name',
  'legal name',
  'corporate headquarters',
  'headquarters address',
  'company address',
  'mailing address',
  'company website',
  'website url',
  'web address',
  'primary contact',
  'point of contact',
  'contact name',
  'contact person',
  'contact email',
  'email address',
  'contact phone',
  'phone number',
  'telephone',
  'years in business',
  'year founded',
  'year established',
  'date of incorporation',
]

const VENDOR_CATEGORIES = [
  'Vendor Profile',
  'Contact Information',
  'Company Information',
]

// ─── isVendorProfileField ───────────────────────────────────────────────────

export function isVendorProfileField(question: string): boolean {
  if (!question) return false
  const lower = question.toLowerCase()
  return VENDOR_PROFILE_KEYWORDS.some((kw) => lower.includes(kw))
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

// ─── fetchContentLibraryForProposal ─────────────────────────────────────────

export async function fetchContentLibraryForProposal(
  organizationId: string,
  rfpFields: RequirementField[],
  openaiApiKey?: string,
): Promise<ContentLibraryEntryWithSimilarity[]> {
  if (rfpFields.length === 0) return []

  const dedupeMap = new Map<string, ContentLibraryEntryWithSimilarity>()

  try {
    const hasVendorFields = rfpFields.some((f) => isVendorProfileField(f.question))

    // Semantic search: use a combined query from all field questions (capped to avoid token limits)
    const combinedQuery = rfpFields.map((f) => f.question).join('. ').slice(0, MAX_QUERY_LENGTH)
    const semanticResults = await searchContentLibrary(
      combinedQuery,
      organizationId,
      CL_SEARCH_LIMIT,
      openaiApiKey,
    )

    for (const entry of semanticResults) {
      const existing = dedupeMap.get(entry.id)
      if (!existing || entry.similarity > existing.similarity) {
        dedupeMap.set(entry.id, entry)
      }
    }

    // Category-based search for vendor profile fields (parallel)
    if (hasVendorFields) {
      const categorySettled = await Promise.allSettled(
        VENDOR_CATEGORIES.map((category) =>
          searchContentLibraryByCategory(organizationId, category, CL_SEARCH_LIMIT)
        )
      )
      for (const result of categorySettled) {
        if (result.status !== 'fulfilled') continue
        for (const entry of result.value) {
          if (!dedupeMap.has(entry.id)) {
            // Map ProposalContentLibraryEntry to ContentLibraryEntryWithSimilarity
            const { embedding: _embedding, ...rest } = entry
            dedupeMap.set(entry.id, { ...rest, similarity: 0 })
          }
        }
      }
    }
  } catch {
    return []
  }

  // Sort by similarity descending and cap
  return Array.from(dedupeMap.values())
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, MAX_CL_RESULTS)
}
