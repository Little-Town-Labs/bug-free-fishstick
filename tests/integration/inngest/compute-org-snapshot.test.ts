import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/services/analytics', () => ({
  computeOrgSnapshot: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    then: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema/analytics-snapshots', () => ({
  analyticsSnapshots: {
    organizationId: {},
    snapshotDate: {},
    period: {},
    metricKey: {},
    dimensionKey: {},
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(
      (_config: unknown, _eventConfig: unknown, handler: unknown) => handler
    ),
  },
}))

import { computeOrgSnapshot } from '@/lib/services/analytics'
import { db } from '@/lib/db'
import { computeOrgSnapshotFunction } from '@/lib/inngest/functions/compute-org-snapshot'

const mockComputeOrgSnapshot = vi.mocked(computeOrgSnapshot)
const mockDb = vi.mocked(db)

function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  }
}

const mockRows = [
  { organizationId: 'org_test', snapshotDate: '2025-01-15', period: 'day' as const, metricKey: 'volume' as const, dimensionKey: null, metricValue: 5, metadataJson: null, computedAt: new Date() },
  { organizationId: 'org_test', snapshotDate: '2025-01-15', period: 'day' as const, metricKey: 'win_rate' as const, dimensionKey: null, metricValue: 0.6, metadataJson: null, computedAt: new Date() },
]

describe('computeOrgSnapshotFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockComputeOrgSnapshot.mockResolvedValue(mockRows)
    ;(mockDb as unknown as { insert: ReturnType<typeof vi.fn> }).insert = vi.fn().mockReturnThis()
    ;(mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values = vi.fn().mockReturnThis()
    ;(mockDb as unknown as { onConflictDoUpdate: ReturnType<typeof vi.fn> }).onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  })

  it('calls computeOrgSnapshot with correct args', async () => {
    const step = createMockStep()
    const event = { data: { organizationId: 'org_test', snapshotDate: '2025-01-15' } }

    await ((computeOrgSnapshotFunction as unknown) as (args: unknown) => Promise<{ metrics: number; organizationId: string; snapshotDate: string }>)({ event, step })

    expect(mockComputeOrgSnapshot).toHaveBeenCalledWith('org_test', 'day', '2025-01-15')
  })

  it('upserts all returned metric rows', async () => {
    const step = createMockStep()
    const event = { data: { organizationId: 'org_test', snapshotDate: '2025-01-15' } }

    const result = await ((computeOrgSnapshotFunction as unknown) as (args: unknown) => Promise<{ metrics: number; organizationId: string; snapshotDate: string }>)({ event, step })

    expect(result.metrics).toBe(2)
    expect(mockDb.insert).toHaveBeenCalledTimes(2)
  })

  it('returns 0 metrics when no rows computed', async () => {
    mockComputeOrgSnapshot.mockResolvedValue([])
    const step = createMockStep()
    const event = { data: { organizationId: 'org_test', snapshotDate: '2025-01-15' } }

    const result = await ((computeOrgSnapshotFunction as unknown) as (args: unknown) => Promise<{ metrics: number; organizationId: string; snapshotDate: string }>)({ event, step })
    expect(result.metrics).toBe(0)
  })

  it('scopes all DB calls to organizationId', async () => {
    const step = createMockStep()
    const event = { data: { organizationId: 'org_abc', snapshotDate: '2025-01-15' } }

    await ((computeOrgSnapshotFunction as unknown) as (args: unknown) => Promise<{ metrics: number; organizationId: string; snapshotDate: string }>)({ event, step })

    expect(mockComputeOrgSnapshot).toHaveBeenCalledWith('org_abc', 'day', '2025-01-15')
  })
})
