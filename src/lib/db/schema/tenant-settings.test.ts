import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  tenantSettings,
  type TenantSetting,
  type RateCard,
  type RateCardRole,
  type RateCardDiscount,
  type ProposalDefaults,
} from './tenant-settings'

describe('tenantSettings schema — bid engine columns', () => {
  it('should have the correct table name', () => {
    expect(getTableName(tenantSettings)).toBe('tenant_settings')
  })

  it('should include rateCard column', () => {
    const columns = Object.keys(tenantSettings)
    expect(columns).toContain('rateCard')
  })

  it('should include proposalDefaults column', () => {
    const columns = Object.keys(tenantSettings)
    expect(columns).toContain('proposalDefaults')
  })

  it('should include companyProfile column', () => {
    const columns = Object.keys(tenantSettings)
    expect(columns).toContain('companyProfile')
  })

  it('should retain all original columns (regression check)', () => {
    const columns = Object.keys(tenantSettings)
    expect(columns).toContain('organizationId')
    expect(columns).toContain('llmProvider')
    expect(columns).toContain('llmApiKeyEncrypted')
    expect(columns).toContain('confidenceThreshold')
    expect(columns).toContain('autoLearnEnabled')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })
})

describe('RateCard TypeScript interface', () => {
  it('allows a valid by_role rate card to satisfy the type', () => {
    const rc: RateCard = {
      mode: 'by_role',
      blendedRate: null,
      roles: [{ name: 'Senior Engineer', unit: 'hour', rate: 195 }],
      defaultMarginPct: 0.2,
      currency: 'USD',
      discounts: [],
    }
    expect(rc.mode).toBe('by_role')
    expect(rc.roles).toHaveLength(1)
  })

  it('allows a valid blended rate card to satisfy the type', () => {
    const rc: RateCard = {
      mode: 'blended',
      blendedRate: 150,
      roles: [],
      defaultMarginPct: 0.15,
      currency: 'USD',
      discounts: [],
    }
    expect(rc.blendedRate).toBe(150)
  })

  it('allows a rate card with discount rules', () => {
    const discount: RateCardDiscount = {
      name: 'Volume discount',
      type: 'percentage',
      value: 0.1,
      appliesTo: 'subtotal',
      customerIds: null,
    }
    const rc: RateCard = {
      mode: 'by_role',
      blendedRate: null,
      roles: [{ name: 'PM', unit: 'day', rate: 1200 }],
      defaultMarginPct: 0.2,
      currency: 'USD',
      discounts: [discount],
    }
    expect(rc.discounts).toHaveLength(1)
  })

  it('RateCardRole interface accepts all three unit values', () => {
    const hourly: RateCardRole = { name: 'Dev', unit: 'hour', rate: 100 }
    const daily: RateCardRole = { name: 'PM', unit: 'day', rate: 800 }
    const fixed: RateCardRole = { name: 'Setup', unit: 'fixed', rate: 2000 }
    expect(hourly.unit).toBe('hour')
    expect(daily.unit).toBe('day')
    expect(fixed.unit).toBe('fixed')
  })
})

describe('ProposalDefaults TypeScript interface', () => {
  it('allows a valid ProposalDefaults object to satisfy the type', () => {
    const pd: ProposalDefaults = {
      pricingModel: 'time_and_materials',
      paymentTermsDays: 30,
      warrantyPeriodDays: 90,
    }
    expect(pd.pricingModel).toBe('time_and_materials')
    expect(pd.paymentTermsDays).toBe(30)
  })

  it('allows all three pricingModel values', () => {
    const models: ProposalDefaults['pricingModel'][] = [
      'time_and_materials',
      'fixed_price',
      'cost_plus',
    ]
    expect(models).toHaveLength(3)
  })
})

describe('TenantSetting type', () => {
  it('allows null for rateCard, proposalDefaults, and companyProfile', () => {
    const s: TenantSetting = {
      organizationId: 'org_test',
      llmProvider: 'claude',
      llmApiKeyEncrypted: null,
      openaiApiKeyEncrypted: null,
      anthropicApiKeyEncrypted: null,
      confidenceThreshold: 0.7,
      autoLearnEnabled: true,
      rateCard: null,
      proposalDefaults: null,
      companyProfile: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(s.rateCard).toBeNull()
    expect(s.proposalDefaults).toBeNull()
    expect(s.companyProfile).toBeNull()
  })
})
