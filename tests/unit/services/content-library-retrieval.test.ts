import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RateCard } from '@/lib/db/schema/tenant-settings'

// ─── formatRateCardRoles ────────────────────────────────────────────────────

describe('formatRateCardRoles', () => {
  let formatRateCardRoles: (rateCard: RateCard | null | undefined) => string

  beforeEach(async () => {
    const mod = await import('@/lib/services/content-library-retrieval')
    formatRateCardRoles = mod.formatRateCardRoles
  })

  it('returns empty string for null rate card', () => {
    expect(formatRateCardRoles(null)).toBe('')
  })

  it('returns empty string for undefined rate card', () => {
    expect(formatRateCardRoles(undefined)).toBe('')
  })

  it('returns empty string for blended mode', () => {
    const rc: RateCard = {
      mode: 'blended',
      blendedRate: 150,
      blendedRateUnit: 'hour',
      roles: [],
      defaultMarginPct: 0.2,
      currency: 'USD',
      discounts: [],
    }
    expect(formatRateCardRoles(rc)).toBe('')
  })

  it('returns empty string for by_role with zero roles', () => {
    const rc: RateCard = {
      mode: 'by_role',
      blendedRate: null,
      blendedRateUnit: null,
      roles: [],
      defaultMarginPct: 0.2,
      currency: 'USD',
      discounts: [],
    }
    expect(formatRateCardRoles(rc)).toBe('')
  })

  it('formats by_role mode with multiple roles as markdown table', () => {
    const rc: RateCard = {
      mode: 'by_role',
      blendedRate: null,
      blendedRateUnit: null,
      roles: [
        { name: 'Project Manager', unit: 'hour', rate: 175 },
        { name: 'Senior Developer', unit: 'hour', rate: 200 },
        { name: 'Quality Assurance', unit: 'hour', rate: 120 },
      ],
      defaultMarginPct: 0.2,
      currency: 'USD',
      discounts: [],
    }
    const result = formatRateCardRoles(rc)
    expect(result).toContain('**Standard Hourly Rates by Role**')
    expect(result).toContain('| Role | Rate |')
    expect(result).toContain('| Project Manager | USD 175.00 |')
    expect(result).toContain('| Senior Developer | USD 200.00 |')
    expect(result).toContain('| Quality Assurance | USD 120.00 |')
  })

  it('uses the rate card currency', () => {
    const rc: RateCard = {
      mode: 'by_role',
      blendedRate: null,
      blendedRateUnit: null,
      roles: [{ name: 'Developer', unit: 'hour', rate: 100 }],
      defaultMarginPct: 0.2,
      currency: 'EUR',
      discounts: [],
    }
    const result = formatRateCardRoles(rc)
    expect(result).toContain('EUR 100.00')
  })

  it('formats rates with 2 decimal places', () => {
    const rc: RateCard = {
      mode: 'by_role',
      blendedRate: null,
      blendedRateUnit: null,
      roles: [{ name: 'Analyst', unit: 'hour', rate: 99.5 }],
      defaultMarginPct: 0.2,
      currency: 'USD',
      discounts: [],
    }
    const result = formatRateCardRoles(rc)
    expect(result).toContain('USD 99.50')
  })
})

// ─── fetchFixedSectionsForProposal ──────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('fetchFixedSectionsForProposal', () => {
  let fetchFixedSectionsForProposal: typeof import('@/lib/services/content-library-retrieval').fetchFixedSectionsForProposal

  beforeEach(async () => {
    vi.resetModules()

    // Re-mock after resetModules
    vi.doMock('@/lib/db', () => ({
      db: {
        select: vi.fn(),
      },
    }))

    vi.doMock('@/lib/services/content-library-search', () => ({
      searchContentLibrary: vi.fn().mockResolvedValue([]),
      searchContentLibraryByCategory: vi.fn().mockResolvedValue([]),
    }))

    const mod = await import('@/lib/services/content-library-retrieval')
    fetchFixedSectionsForProposal = mod.fetchFixedSectionsForProposal
  })

  it('returns populated fixed sections as Record<sectionType, content>', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { sectionType: 'company_info', content: 'Acme Solutions Inc.' },
          { sectionType: 'services', content: 'We provide cloud migration services.' },
        ]),
      }),
    } as never)

    const result = await fetchFixedSectionsForProposal('org-1')
    expect(result).toEqual({
      company_info: 'Acme Solutions Inc.',
      services: 'We provide cloud migration services.',
    })
  })

  it('skips fixed sections with empty content', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { sectionType: 'company_info', content: 'Acme Solutions' },
          { sectionType: 'company_contacts', content: '' },
          { sectionType: 'services', content: '   ' },
        ]),
      }),
    } as never)

    const result = await fetchFixedSectionsForProposal('org-1')
    expect(result).toEqual({ company_info: 'Acme Solutions' })
  })

  it('returns empty record when no fixed sections exist', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const result = await fetchFixedSectionsForProposal('org-1')
    expect(result).toEqual({})
  })
})

// ─── fetchContentLibraryForProposal (custom entries only) ──────────────────

describe('fetchContentLibraryForProposal', () => {
  let fetchContentLibraryForProposal: typeof import('@/lib/services/content-library-retrieval').fetchContentLibraryForProposal
  let mockSearchContentLibrary: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    vi.doMock('@/lib/db', () => ({
      db: { select: vi.fn() },
    }))

    vi.doMock('@/lib/services/content-library-search', () => ({
      searchContentLibrary: vi.fn().mockResolvedValue([]),
      searchContentLibraryByCategory: vi.fn().mockResolvedValue([]),
    }))

    const searchMod = await import('@/lib/services/content-library-search')
    mockSearchContentLibrary = searchMod.searchContentLibrary as ReturnType<typeof vi.fn>

    const mod = await import('@/lib/services/content-library-retrieval')
    fetchContentLibraryForProposal = mod.fetchContentLibraryForProposal
  })

  const ORG_ID = 'org-123'

  it('returns empty array when no RFP fields provided', async () => {
    const result = await fetchContentLibraryForProposal(ORG_ID, [])
    expect(result).toEqual([])
  })

  it('calls semantic search and returns custom entries', async () => {
    mockSearchContentLibrary.mockResolvedValue([
      { id: 'cl-1', name: 'Migration Approach', category: 'Services', content: 'We do migrations', sectionType: null, similarity: 0.8, organizationId: ORG_ID, createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date() },
    ])

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Describe your approach to data migration' },
    ])

    expect(mockSearchContentLibrary).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('cl-1')
  })

  it('filters out fixed sections from semantic search results', async () => {
    mockSearchContentLibrary.mockResolvedValue([
      { id: 'cl-custom', name: 'SLA', category: 'SLA Terms', content: 'Our SLA...', sectionType: null, similarity: 0.9, organizationId: ORG_ID, createdBy: 'u1', createdAt: new Date(), updatedAt: new Date() },
      { id: 'cl-fixed', name: 'Company Information', category: 'Company Information', content: 'Acme', sectionType: 'company_info', similarity: 0.85, organizationId: ORG_ID, createdBy: 'system', createdAt: new Date(), updatedAt: new Date() },
    ])

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Tell us about your company' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('cl-custom')
  })

  it('caps results at 10 entries', async () => {
    const manyEntries = Array.from({ length: 15 }, (_, i) => ({
      id: `cl-${i}`, organizationId: ORG_ID, name: `Entry ${i}`, category: 'General',
      content: `Content ${i}`, sectionType: null, similarity: 0.9 - i * 0.05,
      createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date(),
    }))
    mockSearchContentLibrary.mockResolvedValue(manyEntries)

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'General question' },
    ])

    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('returns empty array when search throws', async () => {
    mockSearchContentLibrary.mockRejectedValue(new Error('DB error'))

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Some question' },
    ])

    expect(result).toEqual([])
  })
})
