import { describe, it, expect } from 'vitest'
import {
  proposalTemplateSectionSchema,
  createProposalTemplateSchema,
  updateProposalTemplateSchema,
  reorderProposalTemplatesSchema,
} from '@/lib/utils/validation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when Zod parse succeeds. */
function isValid(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown): boolean {
  return schema.safeParse(value).success
}

/** Returns the error paths from a failed Zod parse. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errorPaths(schema: { safeParse: (v: unknown) => any }, value: unknown): (string | number)[][] {
  const result = schema.safeParse(value)
  if (result.success) return []
  return result.error?.issues?.map((e: { path: (string | number)[] }) => e.path) ?? []
}

// Builds a string of exactly `n` characters.
function repeat(n: number): string {
  return 'a'.repeat(n)
}

// ---------------------------------------------------------------------------
// proposalTemplateSectionSchema
// ---------------------------------------------------------------------------

describe('proposalTemplateSectionSchema', () => {
  const validSections = [
    'assumptions',
    'exclusions',
    'payment_terms',
    'change_management',
    'ip_ownership',
    'liability',
    'force_majeure',
    'warranty',
  ] as const

  it.each(validSections)('accepts valid section "%s"', (section) => {
    expect(isValid(proposalTemplateSectionSchema, section)).toBe(true)
  })

  it('rejects an unknown section value', () => {
    expect(isValid(proposalTemplateSectionSchema, 'invalid_section')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValid(proposalTemplateSectionSchema, '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createProposalTemplateSchema
// ---------------------------------------------------------------------------

describe('createProposalTemplateSchema', () => {
  const minimal = {
    section: 'assumptions',
    title: 'Test Template',
    content: 'Some content here.',
  }

  // --- acceptance ---

  it('accepts a minimum valid payload (only required fields)', () => {
    expect(isValid(createProposalTemplateSchema, minimal)).toBe(true)
  })

  it('accepts a fully-populated valid payload', () => {
    const full = {
      section: 'payment_terms',
      title: 'Payment Terms Template',
      content: 'We invoice net-30.',
      isRequired: false,
      triggerRfpTypes: ['government', 'commercial'],
      triggerIndustryTags: ['finance', 'healthcare'],
      evaluateCoverage: true,
      sortOrder: 5,
    }
    expect(isValid(createProposalTemplateSchema, full)).toBe(true)
  })

  it('accepts isRequired: true with evaluateCoverage: false', () => {
    expect(isValid(createProposalTemplateSchema, { ...minimal, isRequired: true, evaluateCoverage: false })).toBe(true)
  })

  it('accepts isRequired: false with evaluateCoverage: true', () => {
    expect(isValid(createProposalTemplateSchema, { ...minimal, isRequired: false, evaluateCoverage: true })).toBe(true)
  })

  it('accepts content that is exactly 50,000 characters (boundary)', () => {
    expect(isValid(createProposalTemplateSchema, { ...minimal, content: repeat(50000) })).toBe(true)
  })

  it('accepts tag arrays with valid non-empty string items', () => {
    const payload = {
      ...minimal,
      triggerRfpTypes: ['federal', 'state'],
      triggerIndustryTags: ['tech'],
    }
    expect(isValid(createProposalTemplateSchema, payload)).toBe(true)
  })

  // --- rejection ---

  it('rejects a payload missing section', () => {
    const { section: _s, ...noSection } = minimal as { section: string; title: string; content: string }
    expect(isValid(createProposalTemplateSchema, noSection)).toBe(false)
  })

  it('rejects a payload missing title', () => {
    const { title: _t, ...noTitle } = minimal as { section: string; title: string; content: string }
    expect(isValid(createProposalTemplateSchema, noTitle)).toBe(false)
  })

  it('rejects an empty string title', () => {
    expect(isValid(createProposalTemplateSchema, { ...minimal, title: '' })).toBe(false)
  })

  it('rejects a payload missing content', () => {
    const { content: _c, ...noContent } = minimal as { section: string; title: string; content: string }
    expect(isValid(createProposalTemplateSchema, noContent)).toBe(false)
  })

  it('rejects an empty string content', () => {
    expect(isValid(createProposalTemplateSchema, { ...minimal, content: '' })).toBe(false)
  })

  it('rejects content that is 50,001 characters (one over limit)', () => {
    expect(isValid(createProposalTemplateSchema, { ...minimal, content: repeat(50001) })).toBe(false)
  })

  it('rejects isRequired: true AND evaluateCoverage: true (cross-field constraint)', () => {
    expect(
      isValid(createProposalTemplateSchema, { ...minimal, isRequired: true, evaluateCoverage: true }),
    ).toBe(false)
  })

  it('reports the error path as ["isRequired"] for the cross-field constraint violation', () => {
    const paths = errorPaths(createProposalTemplateSchema, {
      ...minimal,
      isRequired: true,
      evaluateCoverage: true,
    })
    expect(paths).toContainEqual(['isRequired'])
  })

  it('rejects tag array items that are empty strings (min(1) on item)', () => {
    expect(
      isValid(createProposalTemplateSchema, { ...minimal, triggerRfpTypes: ['valid', ''] }),
    ).toBe(false)
  })

  it('rejects triggerIndustryTags array items that are empty strings', () => {
    expect(
      isValid(createProposalTemplateSchema, { ...minimal, triggerIndustryTags: [''] }),
    ).toBe(false)
  })

  // --- default values ---

  it('defaults isRequired to false when omitted', () => {
    const result = createProposalTemplateSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isRequired).toBe(false)
    }
  })

  it('defaults evaluateCoverage to false when omitted', () => {
    const result = createProposalTemplateSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.evaluateCoverage).toBe(false)
    }
  })

  it('defaults triggerRfpTypes to null when omitted', () => {
    const result = createProposalTemplateSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.triggerRfpTypes).toBeNull()
    }
  })

  it('defaults triggerIndustryTags to null when omitted', () => {
    const result = createProposalTemplateSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.triggerIndustryTags).toBeNull()
    }
  })

  it('defaults sortOrder to 0 when omitted', () => {
    const result = createProposalTemplateSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sortOrder).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// updateProposalTemplateSchema
// ---------------------------------------------------------------------------

describe('updateProposalTemplateSchema', () => {
  // --- acceptance ---

  it('accepts an empty object (all fields optional for partial PATCH)', () => {
    expect(isValid(updateProposalTemplateSchema, {})).toBe(true)
  })

  it('accepts a partial payload with only title', () => {
    expect(isValid(updateProposalTemplateSchema, { title: 'New Title' })).toBe(true)
  })

  it('accepts a partial payload with only content', () => {
    expect(isValid(updateProposalTemplateSchema, { content: 'Updated content.' })).toBe(true)
  })

  it('accepts triggerRfpTypes: null (explicitly nulling out the field)', () => {
    expect(isValid(updateProposalTemplateSchema, { triggerRfpTypes: null })).toBe(true)
  })

  it('accepts { isRequired: true, evaluateCoverage: true } without error (constraint lives in service layer)', () => {
    expect(isValid(updateProposalTemplateSchema, { isRequired: true, evaluateCoverage: true })).toBe(true)
  })

  // --- rejection ---

  it('rejects empty string title when title is provided', () => {
    expect(isValid(updateProposalTemplateSchema, { title: '' })).toBe(false)
  })

  it('rejects empty string content when content is provided', () => {
    expect(isValid(updateProposalTemplateSchema, { content: '' })).toBe(false)
  })

  // --- section field must NOT exist ---

  it('does not accept a section field (section is immutable after creation)', () => {
    // If the schema strips unknown keys it will succeed but silently drop section.
    // We verify that the parsed output does NOT include section regardless of
    // whether the schema accepts or rejects the input.
    const result = updateProposalTemplateSchema.safeParse({ section: 'assumptions', title: 'X' })
    if (result.success) {
      // Schema accepted the input — section must have been stripped / not present
      expect((result.data as Record<string, unknown>).section).toBeUndefined()
    }
    // If it failed, that is also acceptable — section is not part of the schema.
    // Either outcome (reject or strip) satisfies the contract.
  })
})

// ---------------------------------------------------------------------------
// reorderProposalTemplatesSchema
// ---------------------------------------------------------------------------

describe('reorderProposalTemplatesSchema', () => {
  const uuid1 = '00000000-0000-4000-a000-000000000001'
  const uuid2 = '00000000-0000-4000-a000-000000000002'

  const validItems = [
    { id: uuid1, sortOrder: 0 },
    { id: uuid2, sortOrder: 1 },
  ]

  // --- acceptance ---

  it('accepts a valid array of two items', () => {
    expect(isValid(reorderProposalTemplatesSchema, { items: validItems })).toBe(true)
  })

  it('accepts a single-item array', () => {
    expect(isValid(reorderProposalTemplatesSchema, { items: [{ id: uuid1, sortOrder: 0 }] })).toBe(true)
  })

  it('accepts negative sortOrder values (valid for reordering)', () => {
    const payload = { items: [{ id: uuid1, sortOrder: -1 }, { id: uuid2, sortOrder: -2 }] }
    expect(isValid(reorderProposalTemplatesSchema, payload)).toBe(true)
  })

  // --- rejection ---

  it('rejects an empty items array (min(1) on array)', () => {
    expect(isValid(reorderProposalTemplatesSchema, { items: [] })).toBe(false)
  })

  it('rejects items with non-UUID id values', () => {
    const bad = { items: [{ id: 'not-a-uuid', sortOrder: 0 }] }
    expect(isValid(reorderProposalTemplatesSchema, bad)).toBe(false)
  })

  it('rejects a payload missing the items field entirely', () => {
    expect(isValid(reorderProposalTemplatesSchema, {})).toBe(false)
  })
})
