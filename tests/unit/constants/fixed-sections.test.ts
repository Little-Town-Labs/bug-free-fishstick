import { describe, it, expect } from 'vitest'
import {
  FIXED_SECTIONS,
  getFixedSectionDef,
  FIXED_SECTION_TYPES,
  type FixedSectionType,
  type FixedSectionDefinition,
} from '@/lib/constants/fixed-sections'

describe('FIXED_SECTIONS constant', () => {
  it('defines exactly 6 sections', () => {
    expect(FIXED_SECTIONS).toHaveLength(6)
  })

  it('has unique sectionType identifiers', () => {
    const types = FIXED_SECTIONS.map((s: FixedSectionDefinition) => s.sectionType)
    expect(new Set(types).size).toBe(types.length)
  })

  it('has sequential sort orders from 1 to 6', () => {
    const orders = FIXED_SECTIONS.map((s: FixedSectionDefinition) => s.sortOrder)
    expect(orders).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('has non-empty displayName for every section', () => {
    for (const section of FIXED_SECTIONS) {
      expect(section.displayName.trim().length).toBeGreaterThan(0)
    }
  })

  it('has non-empty description for every section', () => {
    for (const section of FIXED_SECTIONS) {
      expect(section.description.trim().length).toBeGreaterThan(0)
    }
  })

  it('includes all expected section types', () => {
    const types = FIXED_SECTIONS.map((s: FixedSectionDefinition) => s.sectionType)
    expect(types).toContain('company_info')
    expect(types).toContain('company_contacts')
    expect(types).toContain('services')
    expect(types).toContain('specialties')
    expect(types).toContain('certifications')
    expect(types).toContain('past_performance')
  })
})

describe('FIXED_SECTION_TYPES', () => {
  it('is a set of all 6 section type strings', () => {
    expect(FIXED_SECTION_TYPES.size).toBe(6)
    expect(FIXED_SECTION_TYPES.has('company_info')).toBe(true)
    expect(FIXED_SECTION_TYPES.has('past_performance')).toBe(true)
  })

  it('does not contain arbitrary strings', () => {
    expect(FIXED_SECTION_TYPES.has('random_thing' as FixedSectionType)).toBe(false)
  })
})

describe('getFixedSectionDef', () => {
  it('returns the correct definition for a known type', () => {
    const def = getFixedSectionDef('company_info')
    expect(def).toBeDefined()
    expect(def!.displayName).toBe('Company Information')
    expect(def!.sortOrder).toBe(1)
  })

  it('returns undefined for an unknown type', () => {
    const def = getFixedSectionDef('not_real' as FixedSectionType)
    expect(def).toBeUndefined()
  })

  it('returns definitions with matching sectionType', () => {
    for (const section of FIXED_SECTIONS) {
      const def = getFixedSectionDef(section.sectionType)
      expect(def).toBe(section)
    }
  })
})
