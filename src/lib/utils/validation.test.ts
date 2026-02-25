import { describe, it, expect } from 'vitest'
import {
  rateCardRoleSchema,
  rateCardDiscountSchema,
  rateCardSchema,
  proposalDefaultsSchema,
  coverageRequirementSchema,
  coverageReportSchema,
  createProposalTemplateSchema,
  updateProposalTemplateSchema,
} from './validation'

// ---------------------------------------------------------------------------
// rateCardRoleSchema
// ---------------------------------------------------------------------------

describe('rateCardRoleSchema', () => {
  it('accepts valid role with unit=hour', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: 'Senior Engineer', unit: 'hour', rate: 195 })
    ).not.toThrow()
  })

  it('accepts valid role with unit=day', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: 'Project Manager', unit: 'day', rate: 1200 })
    ).not.toThrow()
  })

  it('accepts valid role with unit=fixed', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: 'Kick-off Meeting', unit: 'fixed', rate: 500 })
    ).not.toThrow()
  })

  it('rejects negative rate', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: 'Engineer', unit: 'hour', rate: -1 })
    ).toThrow()
  })

  it('rejects rate=0 — must be positive', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: 'Engineer', unit: 'hour', rate: 0 })
    ).toThrow()
  })

  it('rejects empty name', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: '', unit: 'hour', rate: 100 })
    ).toThrow()
  })

  it('rejects unknown unit value', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: 'Engineer', unit: 'week', rate: 100 })
    ).toThrow()
  })

  it('rejects extra keys (strict mode)', () => {
    expect(() =>
      rateCardRoleSchema.parse({ name: 'Engineer', unit: 'hour', rate: 100, extra: true })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// rateCardDiscountSchema
// ---------------------------------------------------------------------------

describe('rateCardDiscountSchema', () => {
  it('accepts type=percentage with appliesTo=subtotal', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Volume discount',
        type: 'percentage',
        value: 0.1,
        appliesTo: 'subtotal',
        customerIds: null,
      })
    ).not.toThrow()
  })

  it('accepts type=fixed with appliesTo=total', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Loyalty discount',
        type: 'fixed',
        value: 500,
        appliesTo: 'total',
        customerIds: null,
      })
    ).not.toThrow()
  })

  it('accepts null customerIds (all-customer discount)', () => {
    const result = rateCardDiscountSchema.parse({
      name: 'Global discount',
      type: 'percentage',
      value: 0.05,
      appliesTo: 'subtotal',
      customerIds: null,
    })
    expect(result.customerIds).toBeNull()
  })

  it('accepts non-null customerIds array', () => {
    const result = rateCardDiscountSchema.parse({
      name: 'Preferred customer',
      type: 'percentage',
      value: 0.15,
      appliesTo: 'subtotal',
      customerIds: ['cust-abc', 'cust-def'],
    })
    expect(result.customerIds).toHaveLength(2)
  })

  it('accepts value=0 (nonnegative — zero-value discount is inert but valid)', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Placeholder',
        type: 'fixed',
        value: 0,
        appliesTo: 'total',
        customerIds: null,
      })
    ).not.toThrow()
  })

  it('rejects negative value', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Bad discount',
        type: 'fixed',
        value: -50,
        appliesTo: 'total',
        customerIds: null,
      })
    ).toThrow()
  })

  it('rejects unknown type value', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Discount',
        type: 'multiplier',
        value: 0.9,
        appliesTo: 'total',
        customerIds: null,
      })
    ).toThrow()
  })

  it('rejects unknown appliesTo value', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Discount',
        type: 'percentage',
        value: 0.1,
        appliesTo: 'line_item',
        customerIds: null,
      })
    ).toThrow()
  })

  it('rejects extra keys (strict mode)', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Discount',
        type: 'percentage',
        value: 0.1,
        appliesTo: 'subtotal',
        customerIds: null,
        extra: 'field',
      })
    ).toThrow()
  })

  it('accepts percentage discount value=1 (100% — boundary)', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Full discount',
        type: 'percentage',
        value: 1,
        appliesTo: 'total',
        customerIds: null,
      })
    ).not.toThrow()
  })

  it('rejects percentage discount value > 1 (must be decimal fraction)', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'Bad percentage',
        type: 'percentage',
        value: 1.5,
        appliesTo: 'subtotal',
        customerIds: null,
      })
    ).toThrow(/decimal fraction/)
  })

  it('allows fixed discount value > 1 (currency amount, not fraction)', () => {
    expect(() =>
      rateCardDiscountSchema.parse({
        name: 'High fixed discount',
        type: 'fixed',
        value: 999,
        appliesTo: 'total',
        customerIds: null,
      })
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// rateCardSchema (includes cross-field refines)
// ---------------------------------------------------------------------------

describe('rateCardSchema', () => {
  const validByRole = {
    mode: 'by_role' as const,
    blendedRate: null,
    roles: [
      { name: 'Senior Engineer', unit: 'hour' as const, rate: 195 },
      { name: 'Project Manager', unit: 'day' as const, rate: 1200 },
    ],
    defaultMarginPct: 0.2,
    currency: 'USD',
    discounts: [
      { name: 'Volume discount', type: 'percentage' as const, value: 0.1, appliesTo: 'subtotal' as const, customerIds: null },
    ],
  }

  const validBlended = {
    mode: 'blended' as const,
    blendedRate: 150,
    roles: [],
    defaultMarginPct: 0.15,
    currency: 'USD',
    discounts: [],
  }

  it('accepts valid by_role config with two roles and a discount', () => {
    expect(() => rateCardSchema.parse(validByRole)).not.toThrow()
  })

  it('accepts valid blended config (blendedRate set, roles empty)', () => {
    expect(() => rateCardSchema.parse(validBlended)).not.toThrow()
  })

  it('rejects mode=blended with null blendedRate (cross-field refine)', () => {
    expect(() =>
      rateCardSchema.parse({ ...validBlended, blendedRate: null })
    ).toThrow(/blendedRate/)
  })

  it('rejects mode=by_role with empty roles array (cross-field refine)', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, roles: [] })
    ).toThrow(/role/)
  })

  it('rejects negative defaultMarginPct', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, defaultMarginPct: -0.1 })
    ).toThrow()
  })

  it('rejects defaultMarginPct > 1', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, defaultMarginPct: 1.1 })
    ).toThrow()
  })

  it('accepts defaultMarginPct=0 (no margin)', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, defaultMarginPct: 0 })
    ).not.toThrow()
  })

  it('accepts defaultMarginPct=1 (100% margin)', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, defaultMarginPct: 1 })
    ).not.toThrow()
  })

  it('rejects currency shorter than 3 chars', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, currency: 'US' })
    ).toThrow()
  })

  it('rejects lowercase currency (ISO 4217 must be uppercase)', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, currency: 'usd' })
    ).toThrow(/ISO 4217/)
  })

  it('rejects extra keys (strict mode)', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, extraField: true })
    ).toThrow()
  })

  it('rejects unknown mode value', () => {
    expect(() =>
      rateCardSchema.parse({ ...validByRole, mode: 'hourly' })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// proposalDefaultsSchema
// ---------------------------------------------------------------------------

describe('proposalDefaultsSchema', () => {
  it('accepts pricing model time_and_materials', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'time_and_materials',
        paymentTermsDays: 30,
        warrantyPeriodDays: 90,
      })
    ).not.toThrow()
  })

  it('accepts pricing model fixed_price', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'fixed_price',
        paymentTermsDays: 30,
        warrantyPeriodDays: 90,
      })
    ).not.toThrow()
  })

  it('accepts pricing model cost_plus', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'cost_plus',
        paymentTermsDays: 30,
        warrantyPeriodDays: 90,
      })
    ).not.toThrow()
  })

  it('accepts paymentTermsDays=0 (immediate payment is valid)', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'time_and_materials',
        paymentTermsDays: 0,
        warrantyPeriodDays: 0,
      })
    ).not.toThrow()
  })

  it('accepts warrantyPeriodDays=0', () => {
    const result = proposalDefaultsSchema.parse({
      pricingModel: 'fixed_price',
      paymentTermsDays: 30,
      warrantyPeriodDays: 0,
    })
    expect(result.warrantyPeriodDays).toBe(0)
  })

  it('rejects negative paymentTermsDays', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'time_and_materials',
        paymentTermsDays: -1,
        warrantyPeriodDays: 90,
      })
    ).toThrow()
  })

  it('rejects float paymentTermsDays (must be integer)', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'time_and_materials',
        paymentTermsDays: 30.5,
        warrantyPeriodDays: 90,
      })
    ).toThrow()
  })

  it('rejects unknown pricing model value', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'hourly',
        paymentTermsDays: 30,
        warrantyPeriodDays: 90,
      })
    ).toThrow()
  })

  it('rejects extra keys (strict mode)', () => {
    expect(() =>
      proposalDefaultsSchema.parse({
        pricingModel: 'fixed_price',
        paymentTermsDays: 30,
        warrantyPeriodDays: 90,
        notes: 'extra field',
      })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// coverageRequirementSchema
// ---------------------------------------------------------------------------

describe('coverageRequirementSchema', () => {
  it('accepts addressed=true with evidence, gap=null', () => {
    expect(() =>
      coverageRequirementSchema.parse({
        requirementId: 'req-1',
        question: 'Does the vendor have ISO 27001 certification?',
        addressed: true,
        evidence: 'See Section 3.2 — certifications',
        gap: null,
      })
    ).not.toThrow()
  })

  it('accepts addressed=false with gap, evidence=null', () => {
    expect(() =>
      coverageRequirementSchema.parse({
        requirementId: 'req-2',
        question: 'What is the SLA uptime guarantee?',
        addressed: false,
        evidence: null,
        gap: 'SLA terms not mentioned in proposal',
      })
    ).not.toThrow()
  })

  it('accepts both evidence and gap as null', () => {
    expect(() =>
      coverageRequirementSchema.parse({
        requirementId: 'req-3',
        question: 'Describe your security policy.',
        addressed: false,
        evidence: null,
        gap: null,
      })
    ).not.toThrow()
  })

  it('rejects empty requirementId', () => {
    expect(() =>
      coverageRequirementSchema.parse({
        requirementId: '',
        question: 'Question?',
        addressed: true,
        evidence: null,
        gap: null,
      })
    ).toThrow()
  })

  it('rejects empty question', () => {
    expect(() =>
      coverageRequirementSchema.parse({
        requirementId: 'req-1',
        question: '',
        addressed: true,
        evidence: null,
        gap: null,
      })
    ).toThrow()
  })

  it('rejects extra keys (strict mode)', () => {
    expect(() =>
      coverageRequirementSchema.parse({
        requirementId: 'req-1',
        question: 'Question?',
        addressed: true,
        evidence: null,
        gap: null,
        score: 0.9,
      })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// coverageReportSchema
// ---------------------------------------------------------------------------

describe('coverageReportSchema', () => {
  const validReport = {
    coverageScore: 0.85,
    evaluatedAt: '2026-02-25T10:00:00.000Z',
    requirements: [
      {
        requirementId: 'req-1',
        question: 'ISO certification?',
        addressed: true,
        evidence: 'Mentioned in Section 3',
        gap: null,
      },
    ],
  }

  it('accepts score=0 (lower bound)', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, coverageScore: 0 })
    ).not.toThrow()
  })

  it('accepts score=1 (upper bound)', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, coverageScore: 1 })
    ).not.toThrow()
  })

  it('accepts score=0.85 (typical value)', () => {
    const result = coverageReportSchema.parse(validReport)
    expect(result.coverageScore).toBe(0.85)
  })

  it('rejects score < 0', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, coverageScore: -0.01 })
    ).toThrow()
  })

  it('rejects score > 1', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, coverageScore: 1.01 })
    ).toThrow()
  })

  it('accepts valid ISO 8601 datetime string for evaluatedAt', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, evaluatedAt: '2026-02-25T10:00:00.000Z' })
    ).not.toThrow()
  })

  it('rejects non-datetime string for evaluatedAt', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, evaluatedAt: '2026-02-25' })
    ).toThrow()
  })

  it('accepts empty requirements array (RFP with no parsed fields)', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, requirements: [] })
    ).not.toThrow()
  })

  it('accepts requirements array with two entries', () => {
    const result = coverageReportSchema.parse({
      ...validReport,
      requirements: [
        { requirementId: 'r1', question: 'Q1?', addressed: true, evidence: 'E1', gap: null },
        { requirementId: 'r2', question: 'Q2?', addressed: false, evidence: null, gap: 'G2' },
      ],
    })
    expect(result.requirements).toHaveLength(2)
  })

  it('rejects extra keys (strict mode)', () => {
    expect(() =>
      coverageReportSchema.parse({ ...validReport, generatedBy: 'claude' })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// createProposalTemplateSchema
// ---------------------------------------------------------------------------

describe('createProposalTemplateSchema', () => {
  const validTemplate = {
    section: 'assumptions' as const,
    title: 'Standard Assumptions',
    content: 'This proposal assumes all work will be performed during business hours.',
    isRequired: false,
    triggerRfpTypes: null,
    triggerIndustryTags: null,
    evaluateCoverage: false,
    sortOrder: 0,
  }

  it('accepts section=assumptions', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'assumptions' })
    ).not.toThrow()
  })

  it('accepts section=exclusions', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'exclusions' })
    ).not.toThrow()
  })

  it('accepts section=payment_terms', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'payment_terms' })
    ).not.toThrow()
  })

  it('accepts section=change_management', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'change_management' })
    ).not.toThrow()
  })

  it('accepts section=ip_ownership', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'ip_ownership' })
    ).not.toThrow()
  })

  it('accepts section=liability', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'liability' })
    ).not.toThrow()
  })

  it('accepts section=force_majeure', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'force_majeure' })
    ).not.toThrow()
  })

  it('accepts section=warranty', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'warranty' })
    ).not.toThrow()
  })

  it('rejects unknown section value', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, section: 'introduction' })
    ).toThrow()
  })

  it('accepts isRequired=true with evaluateCoverage=false', () => {
    expect(() =>
      createProposalTemplateSchema.parse({
        ...validTemplate,
        isRequired: true,
        evaluateCoverage: false,
      })
    ).not.toThrow()
  })

  it('accepts isRequired=false with evaluateCoverage=true', () => {
    expect(() =>
      createProposalTemplateSchema.parse({
        ...validTemplate,
        isRequired: false,
        evaluateCoverage: true,
      })
    ).not.toThrow()
  })

  it('accepts null triggerRfpTypes', () => {
    const result = createProposalTemplateSchema.parse({ ...validTemplate, triggerRfpTypes: null })
    expect(result.triggerRfpTypes).toBeNull()
  })

  it('accepts null triggerIndustryTags', () => {
    const result = createProposalTemplateSchema.parse({ ...validTemplate, triggerIndustryTags: null })
    expect(result.triggerIndustryTags).toBeNull()
  })

  it('accepts string array for triggerRfpTypes', () => {
    const result = createProposalTemplateSchema.parse({
      ...validTemplate,
      triggerRfpTypes: ['technical', 'compliance'],
    })
    expect(result.triggerRfpTypes).toEqual(['technical', 'compliance'])
  })

  it('accepts string array for triggerIndustryTags', () => {
    const result = createProposalTemplateSchema.parse({
      ...validTemplate,
      triggerIndustryTags: ['government', 'healthcare'],
    })
    expect(result.triggerIndustryTags).toEqual(['government', 'healthcare'])
  })

  it('rejects empty title', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, title: '' })
    ).toThrow()
  })

  it('rejects title exceeding 255 chars', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, title: 'a'.repeat(256) })
    ).toThrow()
  })

  it('accepts title at exactly 255 chars', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, title: 'a'.repeat(255) })
    ).not.toThrow()
  })

  it('rejects empty content', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, content: '' })
    ).toThrow()
  })

  it('rejects content exceeding 50000 chars', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, content: 'x'.repeat(50001) })
    ).toThrow()
  })

  it('accepts content at exactly 50000 chars (boundary)', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, content: 'x'.repeat(50000) })
    ).not.toThrow()
  })

  it('rejects triggerRfpTypes item exceeding 100 chars', () => {
    expect(() =>
      createProposalTemplateSchema.parse({
        ...validTemplate,
        triggerRfpTypes: ['a'.repeat(101)],
      })
    ).toThrow()
  })

  it('accepts triggerRfpTypes items within 100 chars', () => {
    expect(() =>
      createProposalTemplateSchema.parse({
        ...validTemplate,
        triggerRfpTypes: ['technical', 'compliance'],
      })
    ).not.toThrow()
  })

  it('accepts sortOrder=0 (default)', () => {
    const result = createProposalTemplateSchema.parse({ ...validTemplate, sortOrder: 0 })
    expect(result.sortOrder).toBe(0)
  })

  it('rejects negative sortOrder', () => {
    expect(() =>
      createProposalTemplateSchema.parse({ ...validTemplate, sortOrder: -1 })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// updateProposalTemplateSchema (partial)
// ---------------------------------------------------------------------------

describe('updateProposalTemplateSchema', () => {
  it('accepts empty object (all fields optional via .partial())', () => {
    expect(() => updateProposalTemplateSchema.parse({})).not.toThrow()
  })

  it('accepts partial update with only title', () => {
    expect(() =>
      updateProposalTemplateSchema.parse({ title: 'Updated Title' })
    ).not.toThrow()
  })

  it('accepts partial update with only content', () => {
    expect(() =>
      updateProposalTemplateSchema.parse({
        content: 'Updated content for this template.',
      })
    ).not.toThrow()
  })

  it('applies same section validation as create for provided fields', () => {
    expect(() =>
      updateProposalTemplateSchema.parse({ section: 'warranty' })
    ).not.toThrow()
  })

  it('rejects unknown section on partial update', () => {
    expect(() =>
      updateProposalTemplateSchema.parse({ section: 'introduction' })
    ).toThrow()
  })

  it('rejects empty title when title is provided', () => {
    expect(() =>
      updateProposalTemplateSchema.parse({ title: '' })
    ).toThrow()
  })

  it('rejects negative sortOrder when sortOrder is provided', () => {
    expect(() =>
      updateProposalTemplateSchema.parse({ sortOrder: -1 })
    ).toThrow()
  })
})
