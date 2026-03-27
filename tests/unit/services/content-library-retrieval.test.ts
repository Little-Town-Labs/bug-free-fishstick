import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RateCard } from '@/lib/db/schema/tenant-settings'

// ─── A1: isVendorProfileField ───────────────────────────────────────────────

describe('isVendorProfileField', () => {
  let isVendorProfileField: (question: string) => boolean

  beforeEach(async () => {
    const mod = await import('@/lib/services/content-library-retrieval')
    isVendorProfileField = mod.isVendorProfileField
  })

  it('detects "Company Name"', () => {
    expect(isVendorProfileField('Company Name')).toBe(true)
  })

  it('detects "Corporate Headquarters Address"', () => {
    expect(isVendorProfileField('Corporate Headquarters Address')).toBe(true)
  })

  it('detects "Primary Point of Contact"', () => {
    expect(isVendorProfileField('Primary Point of Contact')).toBe(true)
  })

  it('detects "Contact Email & Phone"', () => {
    expect(isVendorProfileField('Contact Email & Phone')).toBe(true)
  })

  it('detects "Years in Business"', () => {
    expect(isVendorProfileField('Years in Business')).toBe(true)
  })

  it('detects "Company Website"', () => {
    expect(isVendorProfileField('Company Website')).toBe(true)
  })

  it('detects "Legal Name"', () => {
    expect(isVendorProfileField('Legal Name')).toBe(true)
  })

  it('detects "Mailing Address"', () => {
    expect(isVendorProfileField('Mailing Address')).toBe(true)
  })

  it('detects "Year Founded"', () => {
    expect(isVendorProfileField('Year Founded')).toBe(true)
  })

  it('rejects "Describe your approach to data migration"', () => {
    expect(isVendorProfileField('Describe your approach to data migration')).toBe(false)
  })

  it('rejects "List certifications"', () => {
    expect(isVendorProfileField('List certifications')).toBe(false)
  })

  it('rejects "Proposed Delivery Timeline"', () => {
    expect(isVendorProfileField('Proposed Delivery Timeline')).toBe(false)
  })

  it('rejects "Service Types & Specialties"', () => {
    expect(isVendorProfileField('Service Types & Specialties')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(isVendorProfileField('COMPANY NAME')).toBe(true)
    expect(isVendorProfileField('company name')).toBe(true)
    expect(isVendorProfileField('Company name')).toBe(true)
  })

  it('matches partial strings containing keywords', () => {
    expect(isVendorProfileField('Please provide your company name and title')).toBe(true)
    expect(isVendorProfileField('Enter the primary contact email address')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isVendorProfileField('')).toBe(false)
  })
})

// ─── A2: formatRateCardRoles ────────────────────────────────────────────────

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

// ─── A3: fetchContentLibraryForProposal ─────────────────────────────────────

vi.mock('@/lib/services/content-library-search', () => ({
  searchContentLibrary: vi.fn(),
  searchContentLibraryByCategory: vi.fn(),
}))

describe('fetchContentLibraryForProposal', () => {
  let fetchContentLibraryForProposal: typeof import('@/lib/services/content-library-retrieval').fetchContentLibraryForProposal
  let mockSearchContentLibrary: ReturnType<typeof vi.fn>
  let mockSearchContentLibraryByCategory: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    const searchMod = await import('@/lib/services/content-library-search')
    mockSearchContentLibrary = searchMod.searchContentLibrary as ReturnType<typeof vi.fn>
    mockSearchContentLibraryByCategory = searchMod.searchContentLibraryByCategory as ReturnType<typeof vi.fn>
    mockSearchContentLibrary.mockResolvedValue([])
    mockSearchContentLibraryByCategory.mockResolvedValue([])

    const mod = await import('@/lib/services/content-library-retrieval')
    fetchContentLibraryForProposal = mod.fetchContentLibraryForProposal
  })

  const ORG_ID = 'org-123'

  it('returns empty array when no RFP fields provided', async () => {
    const result = await fetchContentLibraryForProposal(ORG_ID, [])
    expect(result).toEqual([])
  })

  it('calls semantic search for non-vendor fields', async () => {
    mockSearchContentLibrary.mockResolvedValue([
      { id: 'cl-1', name: 'Migration Approach', category: 'Services', content: 'We do migrations', similarity: 0.8, organizationId: ORG_ID, createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date() },
    ])

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Describe your approach to data migration' },
    ])

    expect(mockSearchContentLibrary).toHaveBeenCalled()
    expect(mockSearchContentLibraryByCategory).not.toHaveBeenCalled()
    expect(result.length).toBeGreaterThan(0)
  })

  it('calls both semantic and category search for vendor profile fields', async () => {
    mockSearchContentLibrary.mockResolvedValue([])
    mockSearchContentLibraryByCategory.mockResolvedValue([
      { id: 'cl-addr', organizationId: ORG_ID, name: 'HQ Address', category: 'Vendor Profile', content: '123 Main St', createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date() },
    ])

    await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Corporate Headquarters Address' },
    ])

    expect(mockSearchContentLibrary).toHaveBeenCalled()
    expect(mockSearchContentLibraryByCategory).toHaveBeenCalled()
  })

  it('deduplicates entries returned by both semantic and category search', async () => {
    const sharedEntry = {
      id: 'cl-dup',
      organizationId: ORG_ID,
      name: 'Company Address',
      category: 'Vendor Profile',
      content: '123 Main St',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockSearchContentLibrary.mockResolvedValue([{ ...sharedEntry, similarity: 0.7 }])
    mockSearchContentLibraryByCategory.mockResolvedValue([sharedEntry])

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Company Address' },
    ])

    const ids = result.map((r) => r.id)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })

  it('caps results at 10 entries', async () => {
    const manyEntries = Array.from({ length: 15 }, (_, i) => ({
      id: `cl-${i}`,
      organizationId: ORG_ID,
      name: `Entry ${i}`,
      category: 'General',
      content: `Content ${i}`,
      similarity: 0.9 - i * 0.05,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    mockSearchContentLibrary.mockResolvedValue(manyEntries)

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Company Name' },
    ])

    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('passes organizationId to all search calls', async () => {
    await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Company Name' },
    ])

    const calls = mockSearchContentLibrary.mock.calls as unknown[][]
    const orgIds = calls.map((c) => c[1])
    expect(orgIds).toContain(ORG_ID)
  })

  it('returns empty array when search throws', async () => {
    mockSearchContentLibrary.mockRejectedValue(new Error('DB error'))

    const result = await fetchContentLibraryForProposal(ORG_ID, [
      { id: 'f1', question: 'Company Name' },
    ])

    expect(result).toEqual([])
  })
})
