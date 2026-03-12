import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  proposalTemplates: {
    id: 'id',
    organizationId: 'organization_id',
    section: 'section',
    title: 'title',
    content: 'content',
    isRequired: 'is_required',
    triggerRfpTypes: 'trigger_rfp_types',
    triggerIndustryTags: 'trigger_industry_tags',
    evaluateCoverage: 'evaluate_coverage',
    sortOrder: 'sort_order',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  proposalTemplateSections: [
    'assumptions',
    'exclusions',
    'payment_terms',
    'change_management',
    'ip_ownership',
    'liability',
    'force_majeure',
    'warranty',
  ],
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq-condition'),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  asc: vi.fn((col: unknown) => `asc(${String(col)})`),
  desc: vi.fn((col: unknown) => `desc(${String(col)})`),
  inArray: vi.fn((_col: unknown, _vals: unknown) => 'inArray-condition'),
  sql: Object.assign(vi.fn(), { placeholder: vi.fn() }),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  listProposalTemplates,
  listProposalTemplatesBySection,
  createProposalTemplate,
  updateProposalTemplate,
  deleteProposalTemplate,
  reorderProposalTemplates,
  fetchTemplatesForPipeline,
} from '@/lib/services/proposalTemplates'
import { db } from '@/lib/db'
import { proposalTemplateSections } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

type MockDb = {
  select: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  values: ReturnType<typeof vi.fn>
  returning: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
}

const mockDb = db as unknown as MockDb

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeTemplate(overrides: Partial<{
  id: string
  organizationId: string
  section: string
  title: string
  content: string
  isRequired: boolean
  triggerRfpTypes: string[] | null
  triggerIndustryTags: string[] | null
  evaluateCoverage: boolean
  sortOrder: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}> = {}) {
  return {
    id: 'tmpl-1',
    organizationId: 'org-1',
    section: 'assumptions',
    title: 'Standard Assumptions',
    content: 'We assume the following...',
    isRequired: false,
    triggerRfpTypes: null,
    triggerIndustryTags: null,
    evaluateCoverage: false,
    sortOrder: 0,
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock chain wiring helpers
// ---------------------------------------------------------------------------

/** Wire select().from().where().orderBy() → resolves with rows */
function wireSelectChain(rows: unknown[]) {
  const terminal = vi.fn().mockResolvedValue(rows)
  const orderByMock = vi.fn().mockReturnValue({ then: terminal, orderBy: terminal })
  orderByMock.mockResolvedValue(rows)
  const whereMock = vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(rows) })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  mockDb.select = vi.fn().mockReturnValue({ from: fromMock })
  return { whereMock, fromMock }
}

/** Wire select chain that resolves directly after .where() (no orderBy) */
function _wireSelectChainNoOrder(rows: unknown[]) {
  const whereMock = vi.fn().mockResolvedValue(rows)
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  mockDb.select = vi.fn().mockReturnValue({ from: fromMock })
  return { whereMock, fromMock }
}

/** Wire insert().values().returning() → resolves with rows */
function _wireInsertReturning(rows: unknown[]) {
  const returningMock = vi.fn().mockResolvedValue(rows)
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock })
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock })
  mockDb.insert = insertMock
  return { insertMock, valuesMock, returningMock }
}

/** Wire update().set().where().returning() → resolves with rows */
function _wireUpdateReturning(rows: unknown[]) {
  const returningMock = vi.fn().mockResolvedValue(rows)
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
  const setMock = vi.fn().mockReturnValue({ where: whereMock })
  const updateMock = vi.fn().mockReturnValue({ set: setMock })
  mockDb.update = updateMock
  return { updateMock, setMock, whereMock, returningMock }
}

/** Wire delete().where() → resolves with rows (array length = affected count) */
function wireDeleteChain(affectedRows: unknown[]) {
  const returningMock = vi.fn().mockResolvedValue(affectedRows)
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
  const deleteMock = vi.fn().mockReturnValue({ where: whereMock })
  mockDb.delete = deleteMock
  return { deleteMock, whereMock, returningMock }
}

/** Wire db.transaction() to immediately invoke the callback with a mock tx */
function wireTransaction(txBehavior: (tx: MockDb) => void) {
  mockDb.transaction = vi.fn().mockImplementation(async (cb: (tx: MockDb) => Promise<unknown>) => {
    const tx: MockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      transaction: vi.fn(),
    }
    txBehavior(tx)
    return cb(tx)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proposalTemplates service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  describe('listProposalTemplates()', () => {
    it('returns a flat sorted array of templates for the org', async () => {
      const templates = [
        makeTemplate({ id: 'tmpl-1', section: 'assumptions', sortOrder: 0 }),
        makeTemplate({ id: 'tmpl-2', section: 'exclusions', sortOrder: 1 }),
      ]
      wireSelectChain(templates)

      const result = await listProposalTemplates('org-1')

      expect(result).toEqual(templates)
    })

    it('returns an empty array when the org has no templates', async () => {
      wireSelectChain([])

      const result = await listProposalTemplates('org-1')

      expect(result).toEqual([])
    })

    it('passes orgId to eq() for tenant isolation', async () => {
      wireSelectChain([])
      const { eq } = await import('drizzle-orm')

      await listProposalTemplates('org-isolated')

      expect(vi.mocked(eq)).toHaveBeenCalledWith(expect.anything(), 'org-isolated')
    })

    it('orders by section ASC then sortOrder ASC', async () => {
      wireSelectChain([])
      const { asc } = await import('drizzle-orm')

      await listProposalTemplates('org-1')

      // asc() should be called at least twice — once for section, once for sortOrder
      expect(vi.mocked(asc)).toHaveBeenCalledTimes(2)
    })
  })

  // -------------------------------------------------------------------------
  describe('createProposalTemplate()', () => {
    it('inserts with the correct field values', async () => {
      const created = makeTemplate({ id: 'tmpl-new', title: 'New Template', section: 'liability' })

      wireTransaction((tx) => {
        // First call: SELECT MAX(sort_order) — returns current max
        tx.select = vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ maxSort: 2 }]),
              }),
            }),
          })

        // Second call: INSERT ... RETURNING
        const returningMock = vi.fn().mockResolvedValue([created])
        const valuesMock = vi.fn().mockReturnValue({ returning: returningMock })
        tx.insert = vi.fn().mockReturnValue({ values: valuesMock })
        tx.values = valuesMock
        tx.returning = returningMock
      })

      const input = {
        section: 'liability' as const,
        title: 'New Template',
        content: 'Template content here.',
        isRequired: false,
        triggerRfpTypes: null,
        triggerIndustryTags: null,
        evaluateCoverage: false,
      }

      const result = await createProposalTemplate('org-1', 'user-creator', input)

      expect(result).toEqual(created)
    })

    it('injects createdBy from the parameter (not from request)', async () => {
      const created = makeTemplate({ createdBy: 'user-service-injected' })

      let capturedValues: Record<string, unknown> | undefined

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ maxSort: 0 }]),
            }),
          }),
        })

        const returningMock = vi.fn().mockResolvedValue([created])
        const valuesMock = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
          capturedValues = vals
          return { returning: returningMock }
        })
        tx.insert = vi.fn().mockReturnValue({ values: valuesMock })
      })

      await createProposalTemplate('org-1', 'user-service-injected', {
        section: 'assumptions',
        title: 'T',
        content: 'C',
      })

      expect(capturedValues).toBeDefined()
      expect(capturedValues!.createdBy).toBe('user-service-injected')
    })

    it('auto-assigns sortOrder as max+1 within the section', async () => {
      const created = makeTemplate({ sortOrder: 4 })

      let capturedValues: Record<string, unknown> | undefined

      wireTransaction((tx) => {
        // MAX query returns 3
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ maxSort: 3 }]),
            }),
          }),
        })

        const returningMock = vi.fn().mockResolvedValue([created])
        const valuesMock = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
          capturedValues = vals
          return { returning: returningMock }
        })
        tx.insert = vi.fn().mockReturnValue({ values: valuesMock })
      })

      await createProposalTemplate('org-1', 'user-1', {
        section: 'assumptions',
        title: 'T',
        content: 'C',
      })

      expect(capturedValues!.sortOrder).toBe(4)
    })

    it('assigns sortOrder=0 when no existing templates in section (null max)', async () => {
      const created = makeTemplate({ sortOrder: 0 })

      let capturedValues: Record<string, unknown> | undefined

      wireTransaction((tx) => {
        // MAX query returns null (no rows yet)
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ maxSort: null }]),
            }),
          }),
        })

        const returningMock = vi.fn().mockResolvedValue([created])
        const valuesMock = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
          capturedValues = vals
          return { returning: returningMock }
        })
        tx.insert = vi.fn().mockReturnValue({ values: valuesMock })
      })

      await createProposalTemplate('org-1', 'user-1', {
        section: 'assumptions',
        title: 'T',
        content: 'C',
      })

      expect(capturedValues!.sortOrder).toBe(0)
    })

    it('returns the created template from RETURNING *', async () => {
      const created = makeTemplate({ id: 'created-id', title: 'Returned Template' })

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ maxSort: 0 }]),
            }),
          }),
        })
        const returningMock = vi.fn().mockResolvedValue([created])
        tx.insert = vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({ returning: returningMock }),
        })
      })

      const result = await createProposalTemplate('org-1', 'user-1', {
        section: 'assumptions',
        title: 'Returned Template',
        content: 'C',
      })

      expect(result.id).toBe('created-id')
      expect(result.title).toBe('Returned Template')
    })

    it('wraps insert in a transaction', async () => {
      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ maxSort: 0 }]),
            }),
          }),
        })
        tx.insert = vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([makeTemplate()]),
          }),
        })
      })

      await createProposalTemplate('org-1', 'user-1', {
        section: 'assumptions',
        title: 'T',
        content: 'C',
      })

      expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  describe('updateProposalTemplate()', () => {
    it('returns updated template when row exists and patch is valid', async () => {
      const existing = makeTemplate({ id: 'tmpl-1', title: 'Old Title', isRequired: false, evaluateCoverage: false })
      const updated = makeTemplate({ id: 'tmpl-1', title: 'New Title', isRequired: false, evaluateCoverage: false })

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existing]),
          }),
        })
        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([updated]) }),
          }),
        })
      })

      const result = await updateProposalTemplate('org-1', 'tmpl-1', { title: 'New Title' })

      expect(result).toEqual(updated)
    })

    it('returns null when no row matches the org+id combination', async () => {
      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
      })

      const result = await updateProposalTemplate('org-1', 'tmpl-nonexistent', { title: 'X' })

      expect(result).toBeNull()
    })

    it('always includes updatedAt: new Date() in the SET clause', async () => {
      const existing = makeTemplate({ isRequired: false, evaluateCoverage: false })
      let capturedSet: Record<string, unknown> | undefined

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existing]),
          }),
        })
        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
            capturedSet = vals
            return {
              where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([existing]) }),
            }
          }),
        })
      })

      const before = new Date()
      await updateProposalTemplate('org-1', 'tmpl-1', { title: 'Updated' })
      const after = new Date()

      expect(capturedSet).toBeDefined()
      expect(capturedSet!.updatedAt).toBeInstanceOf(Date)
      expect((capturedSet!.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect((capturedSet!.updatedAt as Date).getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('merges patch with existing row values (only supplied fields change)', async () => {
      const existing = makeTemplate({
        title: 'Original Title',
        content: 'Original Content',
        isRequired: false,
        evaluateCoverage: false,
        sortOrder: 5,
      })
      let capturedSet: Record<string, unknown> | undefined

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existing]),
          }),
        })
        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
            capturedSet = vals
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...existing, title: 'Patched Title' }]),
              }),
            }
          }),
        })
      })

      await updateProposalTemplate('org-1', 'tmpl-1', { title: 'Patched Title' })

      // content and sortOrder should retain original values
      expect(capturedSet!.content).toBe('Original Content')
      expect(capturedSet!.sortOrder).toBe(5)
      expect(capturedSet!.title).toBe('Patched Title')
    })

    it('throws when merged state would have isRequired=true and evaluateCoverage=true', async () => {
      const existing = makeTemplate({ isRequired: false, evaluateCoverage: true })

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existing]),
          }),
        })
      })

      await expect(
        updateProposalTemplate('org-1', 'tmpl-1', { isRequired: true })
      ).rejects.toThrow(/isRequired and evaluateCoverage cannot both be true/i)
    })

    it('throws when existing isRequired=true and patch sets evaluateCoverage=true', async () => {
      const existing = makeTemplate({ isRequired: true, evaluateCoverage: false })

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([existing]),
          }),
        })
      })

      await expect(
        updateProposalTemplate('org-1', 'tmpl-1', { evaluateCoverage: true })
      ).rejects.toThrow(/isRequired and evaluateCoverage cannot both be true/i)
    })
  })

  // -------------------------------------------------------------------------
  describe('deleteProposalTemplate()', () => {
    it('returns true when a row was deleted (1+ rows affected)', async () => {
      const deleted = makeTemplate()
      wireDeleteChain([deleted])

      const result = await deleteProposalTemplate('org-1', 'tmpl-1')

      expect(result).toBe(true)
    })

    it('returns false when no row matched org+id (0 rows affected)', async () => {
      wireDeleteChain([])

      const result = await deleteProposalTemplate('org-1', 'tmpl-nonexistent')

      expect(result).toBe(false)
    })

    it('scopes DELETE to both id and organizationId (tenant isolation)', async () => {
      wireDeleteChain([])
      const { eq, and } = await import('drizzle-orm')

      await deleteProposalTemplate('org-iso', 'tmpl-1')

      // eq() should be called with both id and orgId
      const eqCalls = vi.mocked(eq).mock.calls
      const calledWithOrg = eqCalls.some(([, val]) => val === 'org-iso')
      const calledWithId = eqCalls.some(([, val]) => val === 'tmpl-1')
      expect(calledWithOrg).toBe(true)
      expect(calledWithId).toBe(true)
      // and() should combine the two conditions
      expect(vi.mocked(and)).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  describe('reorderProposalTemplates()', () => {
    it('calls db.transaction()', async () => {
      wireTransaction((tx) => {
        // Validation SELECT — all IDs belong to org
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 'tmpl-1' },
              { id: 'tmpl-2' },
            ]),
          }),
        })
        // UPDATE per item
        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
      })

      await reorderProposalTemplates('org-1', [
        { id: 'tmpl-1', sortOrder: 0 },
        { id: 'tmpl-2', sortOrder: 1 },
      ])

      expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    })

    it('applies all sortOrders in a single bulk UPDATE inside the transaction', async () => {
      let updateCallCount = 0
      let capturedSetArg: Record<string, unknown> | null = null

      wireTransaction((tx) => {
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'tmpl-a' }, { id: 'tmpl-b' }, { id: 'tmpl-c' }]),
          }),
        })

        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
            capturedSetArg = vals
            return {
              where: vi.fn().mockImplementation(() => {
                updateCallCount++
                return Promise.resolve([])
              }),
            }
          }),
        })
      })

      const items = [
        { id: 'tmpl-a', sortOrder: 10 },
        { id: 'tmpl-b', sortOrder: 20 },
        { id: 'tmpl-c', sortOrder: 30 },
      ]

      await reorderProposalTemplates('org-1', items)

      // Single bulk UPDATE — not N individual ones
      expect(updateCallCount).toBe(1)
      // set() receives an updatedAt Date and a SQL CASE expression for sortOrder
      expect(capturedSetArg).toMatchObject({ updatedAt: expect.any(Date) })
      // sortOrder is a SQL expression, not a plain number
      expect(typeof capturedSetArg!.sortOrder).not.toBe('number')
    })

    it('throws INVALID_IDS if any id does not belong to the org', async () => {
      wireTransaction((tx) => {
        // Only 1 of 2 IDs found — validation fails
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'tmpl-valid' }]),
          }),
        })
      })

      await expect(
        reorderProposalTemplates('org-1', [
          { id: 'tmpl-valid', sortOrder: 0 },
          { id: 'tmpl-foreign', sortOrder: 1 },
        ])
      ).rejects.toThrow('INVALID_IDS')
    })

    it('does not apply any updates when some IDs are invalid (atomic)', async () => {
      let updateCallCount = 0

      wireTransaction((tx) => {
        // Only 1 of 2 IDs found
        tx.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'tmpl-valid' }]),
          }),
        })

        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              updateCallCount++
              return Promise.resolve([])
            }),
          }),
        })
      })

      await expect(
        reorderProposalTemplates('org-1', [
          { id: 'tmpl-valid', sortOrder: 0 },
          { id: 'tmpl-foreign', sortOrder: 1 },
        ])
      ).rejects.toThrow('INVALID_IDS')

      expect(updateCallCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  describe('fetchTemplatesForPipeline()', () => {
    it('returns required templates regardless of trigger conditions', async () => {
      const requiredTemplate = makeTemplate({ isRequired: true, triggerRfpTypes: null, triggerIndustryTags: null })
      wireSelectChain([requiredTemplate])

      const result = await fetchTemplatesForPipeline('org-1', {
        rfpType: 'RFP',
        industryTags: ['healthcare'],
      })

      expect(result).toContainEqual(requiredTemplate)
    })

    it('returns situational templates matching rfpType', async () => {
      const situationalByType = makeTemplate({
        isRequired: false,
        triggerRfpTypes: ['RFP'],
        triggerIndustryTags: null,
      })
      wireSelectChain([situationalByType])

      const result = await fetchTemplatesForPipeline('org-1', {
        rfpType: 'RFP',
        industryTags: [],
      })

      expect(result).toContainEqual(situationalByType)
    })

    it('returns situational templates matching any industryTag', async () => {
      const situationalByTag = makeTemplate({
        isRequired: false,
        triggerRfpTypes: null,
        triggerIndustryTags: ['healthcare'],
      })
      wireSelectChain([situationalByTag])

      const result = await fetchTemplatesForPipeline('org-1', {
        rfpType: 'OTHER',
        industryTags: ['healthcare'],
      })

      expect(result).toContainEqual(situationalByTag)
    })

    it('uses OR logic — does not require both rfpType and industryTag to match', async () => {
      const rfpTypeMatch = makeTemplate({ id: 'tmpl-rfp', isRequired: false, triggerRfpTypes: ['RFP'], triggerIndustryTags: null })
      const tagMatch = makeTemplate({ id: 'tmpl-tag', isRequired: false, triggerRfpTypes: null, triggerIndustryTags: ['govtech'] })
      wireSelectChain([rfpTypeMatch, tagMatch])

      const result = await fetchTemplatesForPipeline('org-1', {
        rfpType: 'RFP',
        industryTags: ['govtech'],
      })

      expect(result).toContainEqual(rfpTypeMatch)
      expect(result).toContainEqual(tagMatch)
    })

    it('uses raw sql for JSONB operator queries', async () => {
      wireSelectChain([])
      const { sql } = await import('drizzle-orm')

      await fetchTemplatesForPipeline('org-1', {
        rfpType: 'RFP',
        industryTags: ['healthcare'],
      })

      // sql should be used (JSONB array containment operators)
      expect(vi.mocked(sql)).toHaveBeenCalled()
    })

    it('scopes query to the given organizationId', async () => {
      wireSelectChain([])
      const { eq } = await import('drizzle-orm')

      await fetchTemplatesForPipeline('org-pipeline', {
        rfpType: 'RFP',
        industryTags: [],
      })

      expect(vi.mocked(eq)).toHaveBeenCalledWith(expect.anything(), 'org-pipeline')
    })
  })

  // -------------------------------------------------------------------------
  describe('listProposalTemplatesBySection()', () => {
    it('returns an object with all 8 sections as keys', async () => {
      wireSelectChain([])

      const result = await listProposalTemplatesBySection('org-1')

      const expectedSections = proposalTemplateSections as unknown as string[]
      for (const section of expectedSections) {
        expect(result).toHaveProperty(section)
      }
      expect(Object.keys(result)).toHaveLength(8)
    })

    it('sections with no templates have empty arrays', async () => {
      wireSelectChain([
        makeTemplate({ section: 'assumptions' }),
      ])

      const result = await listProposalTemplatesBySection('org-1')

      expect(result.exclusions).toEqual([])
      expect(result.payment_terms).toEqual([])
      expect(result.change_management).toEqual([])
      expect(result.ip_ownership).toEqual([])
      expect(result.liability).toEqual([])
      expect(result.force_majeure).toEqual([])
      expect(result.warranty).toEqual([])
    })

    it('groups templates into the correct sections', async () => {
      const t1 = makeTemplate({ id: 'tmpl-1', section: 'assumptions' })
      const t2 = makeTemplate({ id: 'tmpl-2', section: 'assumptions' })
      const t3 = makeTemplate({ id: 'tmpl-3', section: 'liability' })
      wireSelectChain([t1, t2, t3])

      const result = await listProposalTemplatesBySection('org-1')

      expect(result.assumptions).toHaveLength(2)
      expect(result.assumptions).toContainEqual(t1)
      expect(result.assumptions).toContainEqual(t2)
      expect(result.liability).toHaveLength(1)
      expect(result.liability).toContainEqual(t3)
    })

    it('contains the same templates as listProposalTemplates (no data loss)', async () => {
      const templates = [
        makeTemplate({ id: 'tmpl-a', section: 'assumptions' }),
        makeTemplate({ id: 'tmpl-b', section: 'warranty' }),
        makeTemplate({ id: 'tmpl-c', section: 'exclusions' }),
      ]
      wireSelectChain(templates)

      const bySection = await listProposalTemplatesBySection('org-1')

      const flat = Object.values(bySection).flat()
      expect(flat).toHaveLength(3)
      for (const tmpl of templates) {
        expect(flat).toContainEqual(tmpl)
      }
    })

    it('passes orgId through to listProposalTemplates (tenant isolation)', async () => {
      wireSelectChain([])
      const { eq } = await import('drizzle-orm')

      await listProposalTemplatesBySection('org-grouped')

      expect(vi.mocked(eq)).toHaveBeenCalledWith(expect.anything(), 'org-grouped')
    })
  })
})
