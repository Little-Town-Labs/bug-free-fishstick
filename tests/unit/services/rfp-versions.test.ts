import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  rfpVersions: { rfpId: 'rfpId', id: 'id' },
  rfpResponses: { rfpId: 'rfpId' },
  rfps: { id: 'id', version: 'version' },
}))

import { createVersionSnapshot } from '@/lib/services/rfp-versions'
import { db } from '@/lib/db'

describe('rfp-versions service', () => {
  const mockResponses = [
    { fieldId: 'f1', responseText: 'Answer 1', status: 'auto_filled' },
    { fieldId: 'f2', responseText: 'Answer 2', status: 'manually_filled' },
  ]

  const mockRfp = {
    id: 'rfp_1',
    version: 2,
    automationPercentage: 0.75,
  }

  const mockVersionRecord = {
    id: 'ver_1',
    rfpId: 'rfp_1',
    versionNumber: 2,
    createdBy: 'user_1',
    changeSummary: 'Finalized',
    snapshot: {
      responses: mockResponses,
      automationPercentage: 0.75,
    },
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createVersionSnapshot()', () => {
    it('queries rfp_responses for the given rfpId', async () => {
      // First call returns responses, second returns rfp
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve(mockResponses)),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([mockRfp])),
            }),
          }),
        } as never)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(Promise.resolve([mockVersionRecord])),
        }),
      } as never)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve()),
        }),
      } as never)

      await createVersionSnapshot('rfp_1', 'org_1', 'user_1', 'Finalized')

      expect(db.select).toHaveBeenCalled()
    })

    it('inserts a version record with serialized responses', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve(mockResponses)),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([mockRfp])),
            }),
          }),
        } as never)

      const valuesMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue(Promise.resolve([mockVersionRecord])),
      })
      vi.mocked(db.insert).mockReturnValue({
        values: valuesMock,
      } as never)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve()),
        }),
      } as never)

      await createVersionSnapshot('rfp_1', 'org_1', 'user_1', 'Finalized')

      expect(db.insert).toHaveBeenCalled()
      const insertArgs = valuesMock.mock.calls[0]![0]
      expect(insertArgs.snapshot).toBeDefined()
      expect(insertArgs.snapshot.responses).toEqual(
        mockResponses.map((r) => ({
          fieldId: r.fieldId,
          responseText: r.responseText,
          status: r.status,
        }))
      )
    })

    it('stores changeSummary in the version record', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve(mockResponses)),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([mockRfp])),
            }),
          }),
        } as never)

      const valuesMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue(Promise.resolve([mockVersionRecord])),
      })
      vi.mocked(db.insert).mockReturnValue({
        values: valuesMock,
      } as never)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve()),
        }),
      } as never)

      await createVersionSnapshot('rfp_1', 'org_1', 'user_1', 'Finalized v2')

      const insertArgs = valuesMock.mock.calls[0]![0]
      expect(insertArgs.changeSummary).toBe('Finalized v2')
    })

    it('increments the rfp version counter', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve(mockResponses)),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([mockRfp])),
            }),
          }),
        } as never)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(Promise.resolve([mockVersionRecord])),
        }),
      } as never)

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve()),
      })
      vi.mocked(db.update).mockReturnValue({
        set: setMock,
      } as never)

      await createVersionSnapshot('rfp_1', 'org_1', 'user_1', 'Finalized')

      expect(db.update).toHaveBeenCalled()
    })

    it('returns the created version record', async () => {
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve(mockResponses)),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([mockRfp])),
            }),
          }),
        } as never)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(Promise.resolve([mockVersionRecord])),
        }),
      } as never)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve()),
        }),
      } as never)

      const result = await createVersionSnapshot('rfp_1', 'org_1', 'user_1', 'Finalized')

      expect(result).toEqual(mockVersionRecord)
    })
  })
})
