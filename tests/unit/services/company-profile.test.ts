import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  tenantSettings: { organizationId: 'organization_id', companyProfile: 'company_profile' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq-condition'),
}))

import { getCompanyProfile, upsertCompanyProfile } from '@/lib/services/company-profile'
import { db } from '@/lib/db'

const mockDb = vi.mocked(db)

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

describe('company-profile service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCompanyProfile()', () => {
    it('returns { companyProfile: null } when no row found', async () => {
      wireSelectChain([])
      const result = await getCompanyProfile('org_test')
      expect(result).toEqual({ companyProfile: null })
    })

    it('returns companyProfile text when row exists', async () => {
      wireSelectChain([{ companyProfile: '# About Us\n\nWe build software.' }])
      const result = await getCompanyProfile('org_test')
      expect(result.companyProfile).toBe('# About Us\n\nWe build software.')
    })

    it('returns { companyProfile: null } when row exists but column is null', async () => {
      wireSelectChain([{ companyProfile: null }])
      const result = await getCompanyProfile('org_test')
      expect(result).toEqual({ companyProfile: null })
    })

    it('queries with WHERE organization_id = orgId (tenant isolation)', async () => {
      wireSelectChain([])
      await getCompanyProfile('org_abc')
      const { eq } = await import('drizzle-orm')
      expect(vi.mocked(eq)).toHaveBeenCalledWith(expect.anything(), 'org_abc')
    })

    it('selects only companyProfile column (not *)', async () => {
      wireSelectChain([])
      await getCompanyProfile('org_test')
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.objectContaining({ companyProfile: expect.anything() })
      )
    })
  })

  describe('upsertCompanyProfile()', () => {
    it('calls db.insert().onConflictDoUpdate() (upsert pattern)', async () => {
      wireInsertChain()
      await upsertCompanyProfile('org_test', '# My Company')
      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(
        (mockDb as unknown as { onConflictDoUpdate: ReturnType<typeof vi.fn> }).onConflictDoUpdate
      ).toHaveBeenCalledTimes(1)
    })

    it('passes orgId as organizationId in values (tenant isolation)', async () => {
      wireInsertChain()
      await upsertCompanyProfile('org_xyz', '# Corp')
      expect(
        (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      ).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_xyz' }))
    })

    it('persists the provided companyProfile text', async () => {
      wireInsertChain()
      await upsertCompanyProfile('org_test', '# About\n\nWe do things.')
      expect(
        (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      ).toHaveBeenCalledWith(expect.objectContaining({ companyProfile: '# About\n\nWe do things.' }))
    })

    it('accepts null companyProfile (clear profile)', async () => {
      wireInsertChain()
      await upsertCompanyProfile('org_test', null)
      expect(
        (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      ).toHaveBeenCalledWith(expect.objectContaining({ companyProfile: null }))
    })

    it('accepts empty string companyProfile', async () => {
      wireInsertChain()
      await upsertCompanyProfile('org_test', '')
      expect(
        (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      ).toHaveBeenCalledWith(expect.objectContaining({ companyProfile: '' }))
    })

    it('includes explicit createdAt timestamp in values', async () => {
      wireInsertChain()
      const before = new Date()
      await upsertCompanyProfile('org_test', '# Corp')
      const after = new Date()

      const valuesMock = (mockDb as unknown as { values: ReturnType<typeof vi.fn> }).values
      const callArgs = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>
      expect(callArgs.createdAt).toBeInstanceOf(Date)
      expect((callArgs.createdAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect((callArgs.createdAt as Date).getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('includes updatedAt timestamp in values and conflict set', async () => {
      wireInsertChain()
      await upsertCompanyProfile('org_test', '# Corp')

      const conflictMock = (mockDb as unknown as { onConflictDoUpdate: ReturnType<typeof vi.fn> }).onConflictDoUpdate
      const conflictArgs = conflictMock.mock.calls[0]?.[0] as { set: Record<string, unknown> }
      expect(conflictArgs.set.updatedAt).toBeInstanceOf(Date)
    })
  })
})
