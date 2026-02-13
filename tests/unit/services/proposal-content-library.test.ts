import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import {
  createEntry,
  listEntries,
  getEntry,
  updateEntry,
  deleteEntry,
} from '@/lib/services/proposal-content-library'

const mockEntry = {
  id: 'entry-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  category: 'Pricing',
  name: 'Standard Pricing',
  content: 'Our standard pricing is...',
  createdAt: new Date(),
  updatedAt: new Date(),
}

function mockSelectWithLimit(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any)
}

function mockSelectNoLimit(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as any)
}

function mockInsert(returning: unknown[]) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returning),
    }),
  } as any)
}

function mockUpdate(returning: unknown[]) {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returning),
      }),
    }),
  } as any)
}

function mockDelete() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as any)
}

describe('proposal-content-library service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createEntry', () => {
    it('persists correct fields scoped to orgId', async () => {
      mockInsert([mockEntry])
      const result = await createEntry('org-1', 'user-1', {
        category: 'Pricing',
        name: 'Standard Pricing',
        content: 'Our standard pricing is...',
      })
      expect(result).toEqual(mockEntry)
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('listEntries', () => {
    it('returns only entries for the current org', async () => {
      mockSelectNoLimit([mockEntry])
      const result = await listEntries('org-1')
      expect(result).toEqual([mockEntry])
    })

    it('filters by category when provided', async () => {
      mockSelectNoLimit([mockEntry])
      const result = await listEntries('org-1', 'Pricing')
      expect(result).toEqual([mockEntry])
    })

    it('returns empty array when no entries match', async () => {
      mockSelectNoLimit([])
      const result = await listEntries('org-2')
      expect(result).toEqual([])
    })
  })

  describe('getEntry', () => {
    it('returns entry when found in org', async () => {
      mockSelectWithLimit([mockEntry])
      const result = await getEntry('entry-1', 'org-1')
      expect(result).toEqual(mockEntry)
    })

    it('throws 404 when entry not found', async () => {
      mockSelectWithLimit([])
      await expect(getEntry('missing-id', 'org-1')).rejects.toMatchObject({
        message: 'Content library entry not found',
        statusCode: 404,
      })
    })

    it('throws 404 when entry belongs to different org', async () => {
      mockSelectWithLimit([])
      await expect(getEntry('entry-1', 'org-2')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('updateEntry', () => {
    it('validates ownership then updates', async () => {
      // getEntry call
      mockSelectWithLimit([mockEntry])
      // update call
      mockUpdate([{ ...mockEntry, name: 'Updated Name' }])

      const result = await updateEntry('entry-1', 'org-1', { name: 'Updated Name' })
      expect(result.name).toBe('Updated Name')
    })

    it('throws 404 when entry not owned by org', async () => {
      mockSelectWithLimit([])
      await expect(updateEntry('entry-1', 'org-2', { name: 'x' })).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('deleteEntry', () => {
    it('validates ownership then deletes', async () => {
      mockSelectWithLimit([mockEntry])
      mockDelete()
      await expect(deleteEntry('entry-1', 'org-1')).resolves.toBeUndefined()
      expect(db.delete).toHaveBeenCalled()
    })

    it('throws 404 when entry not owned by org', async () => {
      mockSelectWithLimit([])
      await expect(deleteEntry('entry-1', 'org-2')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })
})
