import { describe, it, expect } from 'vitest'
import {
  computePricingEstimate,
  type ScopeLineItem,
} from '../../../src/lib/services/pricing-computation'
import type { RateCard } from '../../../src/lib/db/schema/tenant-settings'

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function makeBlendedRateCard(overrides: Partial<RateCard> = {}): RateCard {
  return {
    mode: 'blended',
    blendedRate: 100,
    blendedRateUnit: 'hour',
    roles: [],
    defaultMarginPct: 0.2,
    currency: 'USD',
    discounts: [],
    ...overrides,
  }
}

function makeByRoleRateCard(overrides: Partial<RateCard> = {}): RateCard {
  return {
    mode: 'by_role',
    blendedRate: null,
    blendedRateUnit: null,
    roles: [
      { name: 'Senior Developer', unit: 'hour', rate: 150 },
      { name: 'Junior Developer', unit: 'hour', rate: 75 },
      { name: 'Project Manager', unit: 'hour', rate: 120 },
    ],
    defaultMarginPct: 0.2,
    currency: 'USD',
    discounts: [],
    ...overrides,
  }
}

function makeScopeLines(overrides: Partial<ScopeLineItem>[] = []): ScopeLineItem[] {
  if (overrides.length === 0) {
    return [{ description: 'Development', role: null, quantity: 10, unit: 'hour' }]
  }
  return overrides.map((o) => ({
    description: 'Development',
    role: null,
    quantity: 10,
    unit: 'hour' as const,
    ...o,
  }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computePricingEstimate', () => {
  // -------------------------------------------------------------------------
  // Phase 1: Degradation / Placeholder Guard (US-005)
  // -------------------------------------------------------------------------
  describe('degradation (US-005)', () => {
    it('returns isPlaceholder:true when rateCard is null', () => {
      const result = computePricingEstimate(null, makeScopeLines(), 'time_and_materials')
      expect(result.isPlaceholder).toBe(true)
    })

    it('does not throw when rateCard is null', () => {
      expect(() =>
        computePricingEstimate(null, makeScopeLines(), 'time_and_materials'),
      ).not.toThrow()
    })

    it('returns isPlaceholder:true when rateCard is undefined', () => {
      const result = computePricingEstimate(undefined, makeScopeLines(), 'time_and_materials')
      expect(result.isPlaceholder).toBe(true)
    })

    it('does not throw when rateCard is undefined', () => {
      expect(() =>
        computePricingEstimate(undefined, makeScopeLines(), 'time_and_materials'),
      ).not.toThrow()
    })

    it('returns isPlaceholder:true when blended rateCard has blendedRate:null', () => {
      const rc = makeBlendedRateCard({ blendedRate: null })
      const result = computePricingEstimate(rc, makeScopeLines(), 'time_and_materials')
      expect(result.isPlaceholder).toBe(true)
    })

    it('returns isPlaceholder:true when by_role rateCard has empty roles array', () => {
      const rc = makeByRoleRateCard({ roles: [] })
      const result = computePricingEstimate(rc, makeScopeLines(), 'time_and_materials')
      expect(result.isPlaceholder).toBe(true)
    })

    it('returns isPlaceholder:true when scopeLines is null', () => {
      const result = computePricingEstimate(
        makeBlendedRateCard(),
        null,
        'time_and_materials',
      )
      expect(result.isPlaceholder).toBe(true)
    })

    it('does not throw when scopeLines is null', () => {
      expect(() =>
        computePricingEstimate(makeBlendedRateCard(), null, 'time_and_materials'),
      ).not.toThrow()
    })

    it('returns isPlaceholder:true when scopeLines is undefined', () => {
      const result = computePricingEstimate(
        makeBlendedRateCard(),
        undefined,
        'time_and_materials',
      )
      expect(result.isPlaceholder).toBe(true)
    })

    it('returns isPlaceholder:true when scopeLines is empty array', () => {
      const result = computePricingEstimate(makeBlendedRateCard(), [], 'time_and_materials')
      expect(result.isPlaceholder).toBe(true)
    })

    it('all placeholder results have formattedMarkdown = "[PLACEHOLDER: pricing details required]"', () => {
      const cases = [
        computePricingEstimate(null, makeScopeLines(), 'time_and_materials'),
        computePricingEstimate(makeBlendedRateCard(), null, 'time_and_materials'),
        computePricingEstimate(makeBlendedRateCard(), [], 'time_and_materials'),
      ]
      for (const result of cases) {
        expect(result.formattedMarkdown).toBe('[PLACEHOLDER: pricing details required]')
      }
    })

    it('all placeholder results have all numeric fields equal to 0', () => {
      const result = computePricingEstimate(null, makeScopeLines(), 'time_and_materials')
      expect(result.subtotal).toBe(0)
      expect(result.marginPct).toBe(0)
      expect(result.marginAmount).toBe(0)
      expect(result.total).toBe(0)
    })

    it('all placeholder results have lineItems as empty array', () => {
      const result = computePricingEstimate(null, makeScopeLines(), 'time_and_materials')
      expect(result.lineItems).toEqual([])
    })

    it('all placeholder results have discountsApplied as empty array', () => {
      const result = computePricingEstimate(null, makeScopeLines(), 'time_and_materials')
      expect(result.discountsApplied).toEqual([])
    })

    it('all placeholder results have totalFlooredAtZero === false', () => {
      const result = computePricingEstimate(null, makeScopeLines(), 'time_and_materials')
      expect(result.totalFlooredAtZero).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Phase 2: Rate Resolution
  // -------------------------------------------------------------------------
  describe('blended mode (US-001)', () => {
    it('applies single blended rate to a line item regardless of role', () => {
      const rc = makeBlendedRateCard({ blendedRate: 100 })
      const lines = makeScopeLines([{ role: 'Senior Developer', quantity: 5 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.unitRate).toBe(100)
    })

    it('applies blended rate uniformly across multiple line items with different role names', () => {
      const rc = makeBlendedRateCard({ blendedRate: 100 })
      const lines = makeScopeLines([
        { role: 'Senior Developer', quantity: 5 },
        { role: 'Junior Developer', quantity: 10 },
        { role: 'Project Manager', quantity: 2 },
      ])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      for (const li of result.lineItems) {
        expect(li.unitRate).toBe(100)
      }
    })

    it('sets ComputedLineItem.role to null in blended mode', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines([{ role: 'Senior Developer', quantity: 5 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.role).toBeNull()
    })

    it('sets ComputedLineItem.isFallbackRole to false in blended mode', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines([{ role: 'Senior Developer', quantity: 5 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.isFallbackRole).toBe(false)
    })
  })

  describe('by-role mode (US-002)', () => {
    it('uses correct role rate when role name exactly matches', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Senior Developer', quantity: 2 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.unitRate).toBe(150)
    })

    it('matches each line item to its respective role with correct rates', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([
        { role: 'Senior Developer', quantity: 2 },
        { role: 'Junior Developer', quantity: 4 },
        { role: 'Project Manager', quantity: 1 },
      ])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.unitRate).toBe(150)
      expect(result.lineItems[1]!.unitRate).toBe(75)
      expect(result.lineItems[2]!.unitRate).toBe(120)
    })

    it('role matching is case-insensitive', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'senior developer', quantity: 2 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.unitRate).toBe(150)
      expect(result.lineItems[0]!.isFallbackRole).toBe(false)
    })

    it('uses first role as fallback when role not found', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Unicorn Engineer', quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.unitRate).toBe(150) // first role rate
      expect(result.lineItems[0]!.isFallbackRole).toBe(true)
    })

    it('sets isFallbackRole:true when using fallback', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Unknown Role', quantity: 1 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.isFallbackRole).toBe(true)
    })

    it('shows fallback role name (not input role name) in ComputedLineItem.role', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Unknown Role', quantity: 1 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.role).toBe('Senior Developer') // first role name
      expect(result.lineItems[0]!.role).not.toBe('Unknown Role')
    })

    it('sets ComputedLineItem.role to matched role name when found', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Project Manager', quantity: 1 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.role).toBe('Project Manager')
    })

    it('sets isFallbackRole:false when role is matched', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Junior Developer', quantity: 2 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.isFallbackRole).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Phase 3 + 4: Arithmetic Edge Cases (US-006)
  // -------------------------------------------------------------------------
  describe('arithmetic edge cases (US-006)', () => {
    it('$33.33/hr × 3 hours = $99.99 exactly (no floating-point drift)', () => {
      const rc = makeBlendedRateCard({ blendedRate: 33.33 })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.lineTotal).toBe(99.99)
    })

    it('subtotal is correct sum of all line totals', () => {
      const rc = makeBlendedRateCard({ blendedRate: 100, defaultMarginPct: 0 })
      const lines = makeScopeLines([{ quantity: 5 }, { quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.subtotal).toBe(800)
    })

    it('zero quantity line item has lineTotal === 0', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines([{ quantity: 0 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.lineTotal).toBe(0)
    })

    it('zero quantity line item is present in lineItems array', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines([{ quantity: 0 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems).toHaveLength(1)
      expect(result.lineItems[0]!.quantity).toBe(0)
    })

    it('all lineTotal values are rounded to exactly 2 decimal places', () => {
      const rc = makeBlendedRateCard({ blendedRate: 33.33 })
      const lines = makeScopeLines([{ quantity: 7 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      const val = result.lineItems[0]!.lineTotal
      expect(Number(val.toFixed(2))).toBe(val)
    })

    // Margin tests
    it('20% margin on $99.99 = $20.00 (rounds correctly)', () => {
      const rc = makeBlendedRateCard({ blendedRate: 33.33, defaultMarginPct: 0.2 })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      // subtotal = 99.99, marginAmount = round(9999 * 0.2) / 100 = round(1999.8) / 100 = 2000 / 100 = 20.00
      expect(result.marginAmount).toBe(20)
    })

    it('zero margin: marginAmount === 0 and marginPct === 0', () => {
      const rc = makeBlendedRateCard({ defaultMarginPct: 0 })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.marginAmount).toBe(0)
      expect(result.marginPct).toBe(0)
    })

    it('non-zero margin: marginPct reflects rate card value', () => {
      const rc = makeBlendedRateCard({ defaultMarginPct: 0.15 })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.marginPct).toBe(0.15)
    })

    it('marginAmount is rounded to exactly 2 decimal places', () => {
      const rc = makeBlendedRateCard({ blendedRate: 33.33, defaultMarginPct: 0.15 })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      const val = result.marginAmount
      expect(Number(val.toFixed(2))).toBe(val)
    })

    // Total floor tests
    it('normal case: total = subtotal + marginAmount - sum(discounts)', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 33.33,
        defaultMarginPct: 0.2,
        discounts: [],
      })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      // subtotal=99.99, marginAmount=20.00, total=119.99
      expect(result.total).toBe(119.99)
    })

    it('fixed discount exceeding total: total === 0 (not negative)', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Big Discount', type: 'fixed', value: 2000, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.total).toBe(0)
    })

    it('totalFlooredAtZero === true when total is floored', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Big Discount', type: 'fixed', value: 2000, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.totalFlooredAtZero).toBe(true)
    })

    it('totalFlooredAtZero === false when total is not floored', () => {
      const rc = makeBlendedRateCard({ defaultMarginPct: 0, discounts: [] })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.totalFlooredAtZero).toBe(false)
    })

    it('known value chain: $99.99 subtotal + $20.00 margin = $119.99 total', () => {
      const rc = makeBlendedRateCard({ blendedRate: 33.33, defaultMarginPct: 0.2 })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.subtotal).toBe(99.99)
      expect(result.marginAmount).toBe(20)
      expect(result.total).toBe(119.99)
    })
  })

  // -------------------------------------------------------------------------
  // Phase 5: Discounts (US-004)
  // -------------------------------------------------------------------------
  describe('discounts (US-004)', () => {
    it('universal percentage discount (customerIds:null) applied to every computation', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Universal 10%', type: 'percentage', value: 0.1, appliesTo: 'subtotal', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.discountsApplied).toHaveLength(1)
      expect(result.discountsApplied[0]!.name).toBe('Universal 10%')
      expect(result.discountsApplied[0]!.amount).toBe(100) // 10% of 1000
    })

    it('universal percentage discount applied without customerId argument', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Universal 10%', type: 'percentage', value: 0.1, appliesTo: 'subtotal', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.discountsApplied).toHaveLength(1)
    })

    it('customer-specific percentage discount applied when customerId matches', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'VIP 15%', type: 'percentage', value: 0.15, appliesTo: 'subtotal', customerIds: ['cust-1'] },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials', 'cust-1')
      expect(result.discountsApplied).toHaveLength(1)
      expect(result.discountsApplied[0]!.amount).toBe(150) // 15% of 1000
    })

    it('customer-specific percentage discount NOT applied when customerId does not match', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'VIP 15%', type: 'percentage', value: 0.15, appliesTo: 'subtotal', customerIds: ['cust-1'] },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials', 'cust-99')
      expect(result.discountsApplied).toHaveLength(0)
    })

    it('customer-specific percentage discount NOT applied when customerId is undefined', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'VIP 15%', type: 'percentage', value: 0.15, appliesTo: 'subtotal', customerIds: ['cust-1'] },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.discountsApplied).toHaveLength(0)
    })

    it('universal fixed-amount discount deducted correctly', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Flat $50', type: 'fixed', value: 50, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.discountsApplied[0]!.amount).toBe(50)
      expect(result.total).toBe(950)
    })

    it('customer-specific fixed discount correctly filtered by matching customerId', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Partner $100', type: 'fixed', value: 100, appliesTo: 'total', customerIds: ['partner-1'] },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const r1 = computePricingEstimate(rc, lines, 'time_and_materials', 'partner-1')
      const r2 = computePricingEstimate(rc, lines, 'time_and_materials', 'other')
      expect(r1.discountsApplied).toHaveLength(1)
      expect(r2.discountsApplied).toHaveLength(0)
    })

    it('percentage discount with appliesTo:subtotal uses subtotal as base', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0.2,
        discounts: [
          { name: '10% off subtotal', type: 'percentage', value: 0.1, appliesTo: 'subtotal', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      // subtotal = 1000, base = 1000, amount = 100
      expect(result.discountsApplied[0]!.amount).toBe(100)
    })

    it('percentage discount with appliesTo:total uses (subtotal + marginAmount) as base', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0.2,
        discounts: [
          { name: '10% off total', type: 'percentage', value: 0.1, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      // subtotal = 1000, margin = 200, base = 1200, amount = 120
      expect(result.discountsApplied[0]!.amount).toBe(120)
    })

    it('multiple discounts: each uses original reference base (non-cascading)', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Discount A 10%', type: 'percentage', value: 0.1, appliesTo: 'subtotal', customerIds: null },
          { name: 'Discount B 10%', type: 'percentage', value: 0.1, appliesTo: 'subtotal', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      // Both use 1000 as base (non-cascading): each = 100
      expect(result.discountsApplied[0]!.amount).toBe(100)
      expect(result.discountsApplied[1]!.amount).toBe(100)
    })

    it('applied discount appears in discountsApplied with correct name and amount', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Early Bird', type: 'fixed', value: 75, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.discountsApplied[0]).toEqual({ name: 'Early Bird', amount: 75 })
    })

    it('discount not applicable to current customer is absent from discountsApplied', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'VIP Only', type: 'fixed', value: 50, appliesTo: 'total', customerIds: ['vip-1'] },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials', 'regular')
      expect(result.discountsApplied).toHaveLength(0)
    })

    it('discountsApplied preserves order from rate card discounts array', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'First', type: 'fixed', value: 10, appliesTo: 'total', customerIds: null },
          { name: 'Second', type: 'fixed', value: 20, appliesTo: 'total', customerIds: null },
          { name: 'Third', type: 'fixed', value: 30, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.discountsApplied.map((d) => d.name)).toEqual(['First', 'Second', 'Third'])
    })

    it('all AppliedDiscount.amount values are rounded to 2 decimal places', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 33.33,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Odd %', type: 'percentage', value: 0.13, appliesTo: 'subtotal', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      const val = result.discountsApplied[0]!.amount
      expect(Number(val.toFixed(2))).toBe(val)
    })
  })

  // -------------------------------------------------------------------------
  // Phase 7: Markdown Formatting
  // -------------------------------------------------------------------------
  describe('markdown formatting', () => {
    it('contains **Pricing (Time & Materials)** for time_and_materials model', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('**Pricing (Time & Materials)**')
    })

    it('contains **Pricing (Fixed Price)** for fixed_price model', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'fixed_price')
      expect(result.formattedMarkdown).toContain('**Pricing (Fixed Price)**')
    })

    it('contains **Pricing (Cost-Plus)** for cost_plus model', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'cost_plus')
      expect(result.formattedMarkdown).toContain('**Pricing (Cost-Plus)**')
    })

    it('contains the currency code on all monetary values', () => {
      const rc = makeBlendedRateCard({ currency: 'USD' })
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('USD')
    })

    it('uses USD as default when currency is absent from rate card', () => {
      // TypeScript won't allow truly absent, but we can cast
      const rc = { ...makeBlendedRateCard(), currency: undefined } as unknown as RateCard
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('USD')
    })

    it('blended mode: markdown table has columns Description | Qty | Unit | Rate | Total', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Description')
      expect(result.formattedMarkdown).toContain('Qty')
      expect(result.formattedMarkdown).toContain('Unit')
      expect(result.formattedMarkdown).toContain('Rate')
      expect(result.formattedMarkdown).toContain('Total')
      expect(result.formattedMarkdown).not.toContain('Role')
    })

    it('blended mode: each line item row contains description, qty, unit, rate, lineTotal', () => {
      const rc = makeBlendedRateCard({ blendedRate: 100, defaultMarginPct: 0 })
      const lines = makeScopeLines([{ description: 'Dev Work', quantity: 5, unit: 'hour' }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Dev Work')
      expect(result.formattedMarkdown).toContain('5')
      expect(result.formattedMarkdown).toContain('hour')
      expect(result.formattedMarkdown).toContain('100')
      expect(result.formattedMarkdown).toContain('500')
    })

    it('by-role mode: markdown table has columns Description | Role | Qty | Unit | Rate | Total', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Senior Developer', quantity: 2 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Role')
    })

    it('by-role mode: each line item row contains description, role name, qty, unit, rate, lineTotal', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ description: 'Backend', role: 'Senior Developer', quantity: 2, unit: 'hour' }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Backend')
      expect(result.formattedMarkdown).toContain('Senior Developer')
      expect(result.formattedMarkdown).toContain('2')
    })

    it('by-role fallback: fallback role name appears in Role column', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: 'Unknown', quantity: 1 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Senior Developer') // fallback role
    })

    it('formattedMarkdown contains a subtotal row', () => {
      const rc = makeBlendedRateCard({ blendedRate: 100, defaultMarginPct: 0 })
      const lines = makeScopeLines([{ quantity: 5 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Subtotal')
      expect(result.formattedMarkdown).toContain('500')
    })

    it('formattedMarkdown contains margin row labelled "Cost-Plus Margin" for cost_plus', () => {
      const rc = makeBlendedRateCard({ defaultMarginPct: 0.2 })
      const lines = makeScopeLines([{ quantity: 5 }])
      const result = computePricingEstimate(rc, lines, 'cost_plus')
      expect(result.formattedMarkdown).toContain('Cost-Plus Margin')
    })

    it('formattedMarkdown contains generic margin label for non-cost_plus models', () => {
      const rc = makeBlendedRateCard({ defaultMarginPct: 0.2 })
      const lines = makeScopeLines([{ quantity: 5 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Margin')
      expect(result.formattedMarkdown).not.toContain('Cost-Plus Margin')
    })

    it('formattedMarkdown contains one row per applied discount with name and amount', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0,
        discounts: [
          { name: 'Special Deal', type: 'fixed', value: 50, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Special Deal')
      expect(result.formattedMarkdown).toContain('50')
    })

    it('final total row label is "Fixed Price Total" for fixed_price model', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'fixed_price')
      expect(result.formattedMarkdown).toContain('Fixed Price Total')
    })

    it('final total row label is "Total" for time_and_materials model', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('**Total**')
      expect(result.formattedMarkdown).not.toContain('Fixed Price Total')
    })

    it('zero quantity line item appears in table with 0 qty and $0.00 total', () => {
      const rc = makeBlendedRateCard({ blendedRate: 100, defaultMarginPct: 0 })
      const lines = makeScopeLines([{ description: 'Zero Item', quantity: 0 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Zero Item')
      expect(result.formattedMarkdown).toContain('0.00')
    })

    it('zero margin: margin row shows $0.00 and is still present', () => {
      const rc = makeBlendedRateCard({ defaultMarginPct: 0 })
      const lines = makeScopeLines([{ quantity: 5 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Margin')
      expect(result.formattedMarkdown).toContain('0.00')
    })

    it('no applicable discounts: no discount rows in formattedMarkdown', () => {
      const rc = makeBlendedRateCard({
        discounts: [
          { name: 'VIP Only', type: 'fixed', value: 50, appliesTo: 'total', customerIds: ['vip'] },
        ],
      })
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials', 'regular')
      expect(result.formattedMarkdown).not.toContain('VIP Only')
    })
  })

  // -------------------------------------------------------------------------
  // Phase 8: Integration Scenarios
  // -------------------------------------------------------------------------
  describe('integration scenarios', () => {
    it('blended mode full integration: 3 line items, 20% margin, one universal discount', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0.2,
        discounts: [
          { name: 'Volume 5%', type: 'percentage', value: 0.05, appliesTo: 'subtotal', customerIds: null },
        ],
      })
      const lines = makeScopeLines([
        { description: 'Dev', quantity: 10 },
        { description: 'QA', quantity: 5 },
        { description: 'PM', quantity: 2 },
      ])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      // subtotal = 1700, margin = 340, discount = 85, total = 1955
      expect(result.subtotal).toBe(1700)
      expect(result.marginAmount).toBe(340)
      expect(result.discountsApplied).toHaveLength(1)
      expect(result.discountsApplied[0]!.amount).toBe(85)
      expect(result.total).toBe(1955)
      expect(result.isPlaceholder).toBe(false)
      expect(result.formattedMarkdown).toContain('**Pricing (Time & Materials)**')
    })

    it('by-role mode full integration: 3 roles, one unmatched (fallback), 15% margin', () => {
      const rc = makeByRoleRateCard({ defaultMarginPct: 0.15 })
      const lines = makeScopeLines([
        { description: 'Backend', role: 'Senior Developer', quantity: 2 },
        { description: 'Frontend', role: 'Junior Developer', quantity: 4 },
        { description: 'Unknown Role Task', role: 'Data Scientist', quantity: 1 },
      ])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      // Senior Dev: 2*150=300, Junior: 4*75=300, fallback (Senior Dev): 1*150=150
      expect(result.subtotal).toBe(750)
      expect(result.lineItems[2]!.isFallbackRole).toBe(true)
      expect(result.lineItems[2]!.role).toBe('Senior Developer')
      expect(result.isPlaceholder).toBe(false)
    })

    it('same inputs with three pricing models: arithmetic identical, labels differ', () => {
      const rc = makeBlendedRateCard({ blendedRate: 100, defaultMarginPct: 0.2 })
      const lines = makeScopeLines([{ quantity: 10 }])
      const rTM = computePricingEstimate(rc, lines, 'time_and_materials')
      const rFP = computePricingEstimate(rc, lines, 'fixed_price')
      const rCP = computePricingEstimate(rc, lines, 'cost_plus')
      expect(rTM.total).toBe(rFP.total)
      expect(rFP.total).toBe(rCP.total)
      expect(rTM.formattedMarkdown).toContain('**Pricing (Time & Materials)**')
      expect(rFP.formattedMarkdown).toContain('**Pricing (Fixed Price)**')
      expect(rCP.formattedMarkdown).toContain('**Pricing (Cost-Plus)**')
      expect(rCP.formattedMarkdown).toContain('Cost-Plus Margin')
      expect(rFP.formattedMarkdown).toContain('Fixed Price Total')
    })

    it('3 discounts: universal %, customer-specific %, universal fixed — matching customer gets 3', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 100,
        defaultMarginPct: 0.2,
        discounts: [
          { name: 'Universal 5%', type: 'percentage', value: 0.05, appliesTo: 'subtotal', customerIds: null },
          { name: 'VIP 10%', type: 'percentage', value: 0.1, appliesTo: 'total', customerIds: ['vip-1'] },
          { name: 'Flat $50', type: 'fixed', value: 50, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 10 }])
      const rMatch = computePricingEstimate(rc, lines, 'time_and_materials', 'vip-1')
      const rNoMatch = computePricingEstimate(rc, lines, 'time_and_materials', 'other')
      expect(rMatch.discountsApplied).toHaveLength(3)
      expect(rNoMatch.discountsApplied).toHaveLength(2)
    })

    it('complete arithmetic chain: $33.33 × 3 = $99.99 + 20% = $119.99', () => {
      const rc = makeBlendedRateCard({ blendedRate: 33.33, defaultMarginPct: 0.2 })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.subtotal).toBe(99.99)
      expect(result.marginAmount).toBe(20)
      expect(result.total).toBe(119.99)
    })

    it('fixed discount of $200 on $119.99 total → total === 0 and totalFlooredAtZero:true', () => {
      const rc = makeBlendedRateCard({
        blendedRate: 33.33,
        defaultMarginPct: 0.2,
        discounts: [
          { name: 'Massive Discount', type: 'fixed', value: 200, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ quantity: 3 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.total).toBe(0)
      expect(result.totalFlooredAtZero).toBe(true)
    })

    it('currency field propagates to PricingEstimate.currency', () => {
      const rc = makeBlendedRateCard({ currency: 'USD' })
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.currency).toBe('USD')
    })

    it('mode field propagates to PricingEstimate.mode', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.mode).toBe('blended')
    })

    it('model field propagates to PricingEstimate.model', () => {
      const rc = makeBlendedRateCard()
      const lines = makeScopeLines()
      const result = computePricingEstimate(rc, lines, 'fixed_price')
      expect(result.model).toBe('fixed_price')
    })

    it('by-role mode with discount: discount row appears in formattedMarkdown', () => {
      const rc = makeByRoleRateCard({
        defaultMarginPct: 0,
        discounts: [
          { name: 'Partner Deal', type: 'fixed', value: 25, appliesTo: 'total', customerIds: null },
        ],
      })
      const lines = makeScopeLines([{ role: 'Senior Developer', quantity: 1 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.formattedMarkdown).toContain('Partner Deal')
      expect(result.discountsApplied).toHaveLength(1)
    })

    it('by-role mode: line item with null role falls back to first role', () => {
      const rc = makeByRoleRateCard()
      const lines = makeScopeLines([{ role: null, quantity: 2 }])
      const result = computePricingEstimate(rc, lines, 'time_and_materials')
      expect(result.lineItems[0]!.isFallbackRole).toBe(true)
      expect(result.lineItems[0]!.unitRate).toBe(150)
    })
  })
})
