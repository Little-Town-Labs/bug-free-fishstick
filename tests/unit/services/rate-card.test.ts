import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  tenantSettings: { organizationId: 'organization_id', rateCard: 'rate_card', proposalDefaults: 'proposal_defaults' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq-condition'),
}))

import { getRateCard, upsertRateCard } from '@/lib/services/rate-card'
import { db } from '@/lib/db'

const mockDb = vi.mocked(db)

const validRateCard = {
  mode: 'blended' as const,
  blendedRate: 150,
  blendedRateUnit: 'hour' as const,
  roles: [],
  defaultMarginPct: 0.2,
  currency: 'USD',
  discounts: [],
}

const validProposalDefaults = {
  pricingModel: 'time_and_materials' as const,
  paymentTermsDays: 30,
  warrantyPeriodDays: 90,
}

function wireSelectChain(returnValue: unknown[]) {
  const terminal = {
    limit: vi.fn().mockResolvedValue(returnValue),
  }
  mockDb.select = vi.fn().mockReturnThis()
  ;(mockDb as unknown as { from: ReturnType<typeof vi.fn> }).from = vi.fn().mockReturnThis()
  ;(mockDb as unknown as { where: ReturnType<typeof vi.fn> }).where = vi.fn().mockReturnValue(terminal)
}

function wireInsertChain() {
  mockDb.insert = vi.fn().mockReturnThis()
  ;(mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values = vi.fn().mockReturnThis()
  ;(mockDb as unknown as { onConflictDoUpdate: ReturnType<typeof vi.fn> }).onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
}

describe('rate-card service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRateCard()', () => {
    it('returns { rateCard: null, proposalDefaults: null } when no row found', async () => {
      wireSelectChain([])
      const result = await getRateCard('org_test')
      expect(result).toEqual({ rateCard: null, proposalDefaults: null })
    })

    it('returns rateCard and proposalDefaults from row when row exists', async () => {
      wireSelectChain([{ rateCard: validRateCard, proposalDefaults: validProposalDefaults }])
      const result = await getRateCard('org_test')
      expect(result.rateCard).toEqual(validRateCard)
      expect(result.proposalDefaults).toEqual(validProposalDefaults)
    })

    it('queries with WHERE organization_id = orgId (tenant isolation)', async () => {
      wireSelectChain([])
      await getRateCard('org_abc')
      const { eq } = await import('drizzle-orm')
      expect(vi.mocked(eq)).toHaveBeenCalledWith(
        expect.anything(),
        'org_abc'
      )
    })

    it('selects only rateCard and proposalDefaults columns (not *)', async () => {
      wireSelectChain([])
      await getRateCard('org_test')
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.objectContaining({
          rateCard: expect.anything(),
          proposalDefaults: expect.anything(),
        })
      )
    })
  })

  describe('upsertRateCard()', () => {
    it('calls db.insert().onConflictDoUpdate() (upsert pattern)', async () => {
      wireInsertChain()
      await upsertRateCard('org_test', validRateCard, validProposalDefaults)
      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(
        (mockDb as unknown as { onConflictDoUpdate: ReturnType<typeof vi.fn> }).onConflictDoUpdate
      ).toHaveBeenCalledTimes(1)
    })

    it('passes orgId as organizationId in values (tenant isolation)', async () => {
      wireInsertChain()
      await upsertRateCard('org_xyz', validRateCard, validProposalDefaults)
      expect(
        (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      ).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org_xyz' })
      )
    })

    it('persists the provided rateCard object', async () => {
      wireInsertChain()
      await upsertRateCard('org_test', validRateCard, validProposalDefaults)
      expect(
        (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      ).toHaveBeenCalledWith(
        expect.objectContaining({ rateCard: validRateCard })
      )
    })

    it('includes updatedAt timestamp in the upsert values', async () => {
      wireInsertChain()
      const before = new Date()
      await upsertRateCard('org_test', validRateCard, validProposalDefaults)
      const after = new Date()

      const valuesMock = (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      const callArgs = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>

      expect(callArgs.updatedAt).toBeInstanceOf(Date)
      expect((callArgs.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect((callArgs.updatedAt as Date).getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })
})
