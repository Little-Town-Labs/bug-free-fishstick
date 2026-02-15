import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  integrationConfigs: { organizationId: {}, integrationType: {}, status: {} },
  syncEvents: { id: {}, organizationId: {}, status: {}, integrationType: {}, createdAt: {} },
}))

vi.mock('@/lib/services/encryption', () => ({
  encrypt: vi.fn((v: string) => `encrypted:${v}`),
  decrypt: vi.fn((v: string) => v.replace('encrypted:', '')),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq-condition'),
  and: vi.fn((...args: unknown[]) => args),
}))

import {
  getIntegrationConfig,
  upsertIntegrationConfig,
  deleteIntegrationConfig,
  listIntegrationConfigs,
  createSyncEvent,
  updateSyncEvent,
} from '@/lib/services/integration-config'
import { db } from '@/lib/db'
import { encrypt } from '@/lib/services/encryption'

const mockConfig = {
  id: 'cfg-1',
  organizationId: 'org_test',
  integrationType: 'slack' as const,
  isEnabled: true,
  credentialsEncrypted: 'encrypted:{"webhookUrl":"https://hooks.slack.com/abc"}',
  configJson: { notifyOnStatus: ['rfp_assigned'] },
  status: 'active' as const,
  lastVerifiedAt: new Date('2025-01-01'),
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

const mockDbSelect = vi.mocked(db)

function wireDbChain(returnValue: unknown[]) {
  // Create a thenable chain object that also supports .limit() and .orderBy()
  const terminal = {
    limit: vi.fn().mockResolvedValue(returnValue),
    orderBy: vi.fn().mockResolvedValue(returnValue),
    then: (resolve: (v: unknown) => void) => resolve(returnValue),
  }
  mockDbSelect.select = vi.fn().mockReturnThis()
  ;(mockDbSelect as unknown as { from: ReturnType<typeof vi.fn> }).from = vi.fn().mockReturnThis()
  ;(mockDbSelect as unknown as { where: ReturnType<typeof vi.fn> }).where = vi.fn().mockReturnValue(terminal)
}

describe('integration-config service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wireDbChain([mockConfig])
  })

  describe('getIntegrationConfig()', () => {
    it('returns summary without credentials when config exists', async () => {
      const result = await getIntegrationConfig('org_test', 'slack')
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('credentialsEncrypted')
      expect(result?.integrationType).toBe('slack')
    })

    it('returns null when no config found', async () => {
      wireDbChain([])
      const result = await getIntegrationConfig('org_test', 'slack')
      expect(result).toBeNull()
    })
  })

  describe('listIntegrationConfigs()', () => {
    it('returns summaries without credentials', async () => {
      wireDbChain([mockConfig])
      const results = await listIntegrationConfigs('org_test')
      expect(results).toHaveLength(1)
      expect(results[0]).not.toHaveProperty('credentialsEncrypted')
    })
  })

  describe('upsertIntegrationConfig()', () => {
    it('encrypts credentials before storing', async () => {
      ;(mockDbSelect as unknown as { insert: ReturnType<typeof vi.fn> }).insert = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { values: ReturnType<typeof vi.fn> }).values = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { onConflictDoUpdate: ReturnType<typeof vi.fn> }).onConflictDoUpdate = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { returning: ReturnType<typeof vi.fn> }).returning = vi.fn().mockResolvedValue([mockConfig])

      await upsertIntegrationConfig(
        'org_test',
        'slack',
        { webhookUrl: 'https://hooks.slack.com/abc' },
        { notifyOnStatus: ['rfp_assigned'] }
      )

      expect(encrypt).toHaveBeenCalledWith('{"webhookUrl":"https://hooks.slack.com/abc"}')
    })

    it('uses onConflictDoUpdate for upsert', async () => {
      const onConflictMock = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { insert: ReturnType<typeof vi.fn> }).insert = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { values: ReturnType<typeof vi.fn> }).values = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { onConflictDoUpdate: ReturnType<typeof vi.fn> }).onConflictDoUpdate = onConflictMock
      ;(mockDbSelect as unknown as { returning: ReturnType<typeof vi.fn> }).returning = vi.fn().mockResolvedValue([mockConfig])

      await upsertIntegrationConfig('org_test', 'slack', {}, {})
      expect(onConflictMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteIntegrationConfig()', () => {
    it('calls delete with correct conditions', async () => {
      ;(mockDbSelect as unknown as { delete: ReturnType<typeof vi.fn> }).delete = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { where: ReturnType<typeof vi.fn> }).where = vi.fn().mockResolvedValue(undefined)

      await deleteIntegrationConfig('org_test', 'slack')
      expect(mockDbSelect.delete).toHaveBeenCalledTimes(1)
    })
  })

  describe('createSyncEvent()', () => {
    it('inserts and returns sync event', async () => {
      const mockEvent = {
        id: 'evt-1',
        organizationId: 'org_test',
        integrationConfigId: 'cfg-1',
        integrationType: 'slack',
        eventType: 'rfp_assigned',
        referenceId: 'rfp-1',
        status: 'pending' as const,
        inngestEventId: null,
        requestPayload: null,
        responsePayload: null,
        errorMessage: null,
        attemptCount: 0,
        lastAttemptAt: null,
        createdAt: new Date(),
      }

      ;(mockDbSelect as unknown as { insert: ReturnType<typeof vi.fn> }).insert = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { values: ReturnType<typeof vi.fn> }).values = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { returning: ReturnType<typeof vi.fn> }).returning = vi.fn().mockResolvedValue([mockEvent])

      const result = await createSyncEvent({
        organizationId: 'org_test',
        integrationConfigId: 'cfg-1',
        integrationType: 'slack',
        eventType: 'rfp_assigned',
        referenceId: 'rfp-1',
        status: 'pending',
        attemptCount: 0,
      })

      expect(result.id).toBe('evt-1')
    })
  })

  describe('updateSyncEvent()', () => {
    it('calls update on the syncEvents table', async () => {
      ;(mockDbSelect as unknown as { update: ReturnType<typeof vi.fn> }).update = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { set: ReturnType<typeof vi.fn> }).set = vi.fn().mockReturnThis()
      ;(mockDbSelect as unknown as { where: ReturnType<typeof vi.fn> }).where = vi.fn().mockResolvedValue(undefined)

      await updateSyncEvent('evt-1', { status: 'success' })
      expect(mockDbSelect.update).toHaveBeenCalledTimes(1)
    })
  })
})
