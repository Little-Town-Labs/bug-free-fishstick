import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema/rfps', () => ({
  rfps: {
    organizationId: {},
    outcome: {},
    status: {},
    updatedAt: {},
    createdAt: {},
    automationPercentage: {},
  },
}))

vi.mock('@/lib/db/schema/analytics-snapshots', () => ({
  analyticsSnapshots: {
    organizationId: {},
    period: {},
    snapshotDate: {},
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_c: unknown, _v: unknown) => 'eq'),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((_c: unknown, _v: unknown) => 'gte'),
  lte: vi.fn((_c: unknown, _v: unknown) => 'lte'),
  sql: Object.assign(vi.fn(() => 'sql'), { as: vi.fn() }),
}))

import { computeOrgSnapshot, queryAnalyticsSnapshots } from '@/lib/services/analytics'
import { db } from '@/lib/db'

const mockDb = vi.mocked(db)

function wireMockDbSequence(results: unknown[][]) {
  let callIndex = 0
  const makeChain = (result: unknown[]) => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(result),
      then: (resolve: (v: unknown) => void) => resolve(result),
    }
    return chain
  }
  mockDb.select = vi.fn().mockImplementation(() => {
    const result = results[callIndex] ?? []
    callIndex++
    return makeChain(result)
  })
}

describe('analytics service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('computeOrgSnapshot()', () => {
    it('returns metric rows with correct keys', async () => {
      // volume, win rate outcomes, avg completion, avg automation
      wireMockDbSequence([
        [{ count: 10 }],           // volume
        [{ outcome: 'won', count: 3 }, { outcome: 'lost', count: 2 }], // outcome
        [{ avgDays: 14.5 }],       // avg completion
        [{ avgAuto: 0.75 }],       // avg automation
      ])

      const rows = await computeOrgSnapshot('org_test', 'day', '2025-01-15')

      expect(rows).toHaveLength(4)
      const keys = rows.map((r) => r.metricKey)
      expect(keys).toContain('volume')
      expect(keys).toContain('win_rate')
      expect(keys).toContain('avg_completion_days')
      expect(keys).toContain('avg_automation_pct')
    })

    it('computes win rate correctly (3 won / 5 decided = 0.6)', async () => {
      wireMockDbSequence([
        [{ count: 5 }],
        [{ outcome: 'won', count: 3 }, { outcome: 'lost', count: 2 }],
        [{ avgDays: 7 }],
        [{ avgAuto: 0.5 }],
      ])

      const rows = await computeOrgSnapshot('org_test', 'day', '2025-01-15')
      const winRateRow = rows.find((r) => r.metricKey === 'win_rate')

      expect(winRateRow?.metricValue).toBeCloseTo(0.6)
    })

    it('returns 0 win rate when no outcomes set', async () => {
      wireMockDbSequence([
        [{ count: 5 }],
        [],   // no outcomes
        [{ avgDays: 0 }],
        [{ avgAuto: 0 }],
      ])

      const rows = await computeOrgSnapshot('org_test', 'day', '2025-01-15')
      const winRateRow = rows.find((r) => r.metricKey === 'win_rate')
      expect(winRateRow?.metricValue).toBe(0)
    })

    it('handles zero RFPs gracefully', async () => {
      wireMockDbSequence([
        [{ count: 0 }],
        [],
        [{ avgDays: 0 }],
        [{ avgAuto: 0 }],
      ])

      const rows = await computeOrgSnapshot('org_test', 'day', '2025-01-15')
      expect(rows).toHaveLength(4)
      const volumeRow = rows.find((r) => r.metricKey === 'volume')
      expect(volumeRow?.metricValue).toBe(0)
    })

    it('all rows include the organizationId and period', async () => {
      wireMockDbSequence([[{ count: 2 }], [], [{ avgDays: 3 }], [{ avgAuto: 0.1 }]])

      const rows = await computeOrgSnapshot('org_test', 'month', '2025-01-01')
      for (const row of rows) {
        expect(row.organizationId).toBe('org_test')
        expect(row.period).toBe('month')
        expect(row.snapshotDate).toBe('2025-01-01')
      }
    })
  })

  describe('queryAnalyticsSnapshots()', () => {
    it('queries snapshots for an org', async () => {
      const mockSnapshot = {
        id: 'snap-1',
        organizationId: 'org_test',
        snapshotDate: '2025-01-15',
        period: 'day',
        metricKey: 'volume',
        dimensionKey: null,
        metricValue: 10,
        metadataJson: null,
        computedAt: new Date(),
      }

      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockSnapshot]),
      }
      mockDb.select = vi.fn().mockReturnValue(chain)

      const results = await queryAnalyticsSnapshots('org_test', { period: 'day' })
      expect(results).toHaveLength(1)
      expect(results[0]?.metricKey).toBe('volume')
    })
  })
})
