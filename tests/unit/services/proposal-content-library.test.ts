import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: [] }) },
}))

import { db } from '@/lib/db'
import {
  createEntry,
  listEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  ensureFixedSections,
} from '@/lib/services/proposal-content-library'
import { FIXED_SECTIONS } from '@/lib/constants/fixed-sections'

const mockEntry = {
  id: 'entry-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  category: 'Pricing',
  name: 'Standard Pricing',
  content: 'Our standard pricing is...',
  sectionType: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockFixedEntry = {
  id: 'fixed-1',
  organizationId: 'org-1',
  createdBy: 'system',
  category: 'Company Information',
  name: 'Company Information',
  content: 'Acme Solutions is...',
  sectionType: 'company_info',
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
  } as never)
}

function mockSelectNoLimit(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as never)
}

function mockInsert(returning: unknown[]) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returning),
    }),
  } as never)
}

function mockUpdate(returning: unknown[]) {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returning),
      }),
    }),
  } as never)
}

function mockDelete() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as never)
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

    it('throws 403 when trying to delete a fixed section', async () => {
      mockSelectWithLimit([mockFixedEntry])
      await expect(deleteEntry('fixed-1', 'org-1')).rejects.toMatchObject({
        statusCode: 403,
      })
      expect(db.delete).not.toHaveBeenCalled()
    })
  })

  describe('updateEntry guards for fixed sections', () => {
    it('rejects category changes on fixed sections', async () => {
      mockSelectWithLimit([mockFixedEntry])
      await expect(
        updateEntry('fixed-1', 'org-1', { category: 'New Category' })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects name changes on fixed sections', async () => {
      mockSelectWithLimit([mockFixedEntry])
      await expect(
        updateEntry('fixed-1', 'org-1', { name: 'New Name' })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('allows content changes on fixed sections', async () => {
      // getEntry call
      mockSelectWithLimit([mockFixedEntry])
      // update call
      mockUpdate([{ ...mockFixedEntry, content: 'Updated content' }])
      const result = await updateEntry('fixed-1', 'org-1', { content: 'Updated content' })
      expect(result.content).toBe('Updated content')
    })

    it('allows all field changes on custom entries', async () => {
      mockSelectWithLimit([mockEntry])
      mockUpdate([{ ...mockEntry, category: 'New Cat', name: 'New Name' }])
      const result = await updateEntry('entry-1', 'org-1', { category: 'New Cat', name: 'New Name' })
      expect(result.category).toBe('New Cat')
    })
  })

  describe('ensureFixedSections', () => {
    it('creates all 6 fixed sections when none exist', async () => {
      // Mock: select returns no existing fixed sections
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never)

      // Mock: insert with onConflictDoNothing
      const mockReturning = vi.fn().mockResolvedValue([])
      const mockOnConflictDoNothing = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never)

      await ensureFixedSections('org-1', 'system')

      expect(db.insert).toHaveBeenCalledTimes(FIXED_SECTIONS.length)
    })

    it('only creates missing sections when some exist', async () => {
      // Mock: 2 sections already exist
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { sectionType: 'company_info' },
            { sectionType: 'services' },
          ]),
        }),
      } as never)

      const mockReturning = vi.fn().mockResolvedValue([])
      const mockOnConflictDoNothing = vi.fn().mockReturnValue({ returning: mockReturning })
      const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never)

      await ensureFixedSections('org-1', 'system')

      // Should only insert the 4 missing sections
      expect(db.insert).toHaveBeenCalledTimes(4)
    })

    it('is idempotent when all sections exist', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            FIXED_SECTIONS.map((s) => ({ sectionType: s.sectionType }))
          ),
        }),
      } as never)

      await ensureFixedSections('org-1', 'system')

      expect(db.insert).not.toHaveBeenCalled()
    })
  })
})
