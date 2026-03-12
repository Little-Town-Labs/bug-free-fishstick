import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message)
      this.name = 'AuthError'
    }
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{}])),
        })),
      })),
    })),
  },
}))

import { PUT as updateResponse } from '@/app/api/rfps/[rfpId]/responses/[fieldId]/route'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'

function createMockRequest(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init as unknown as ConstructorParameters<typeof NextRequest>[1])
}

const mockAuthContext = {
  userId: 'user-1',
  orgId: 'org-1',
  orgRole: 'member',
}

const BASE_URL = 'http://localhost:3000/api/rfps/rfp-1/responses/field-1'
const ROUTE_PARAMS = { params: Promise.resolve({ rfpId: 'rfp-1', fieldId: 'field-1' }) }

describe('PUT /api/rfps/[rfpId]/responses/[fieldId] - auto-save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic save (existing behavior)', () => {
    it('should return 200 with updated response on a standard save', async () => {
      const mockUpdatedResponse = {
        id: 'resp-1',
        rfpId: 'rfp-1',
        fieldId: 'field-1',
        responseText: 'My answer',
        status: 'manually_filled',
        updatedAt: new Date('2024-01-01T12:00:00.000Z'),
      }

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedResponse])),
          })),
        })),
      } as never)

      const request = createMockRequest('PUT', BASE_URL, {
        responseText: 'My answer',
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.response).toBeDefined()
      expect(data.response.responseText).toBe('My answer')
    })

    it('should return 400 when responseText is missing', async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)

      const request = createMockRequest('PUT', BASE_URL, {
        status: 'manually_filled',
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('Unauthorized', 401))

      const request = createMockRequest('PUT', BASE_URL, {
        responseText: 'My answer',
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      expect(response.status).toBe(401)
    })
  })

  describe('auto-save with autoSave=true', () => {
    it('should return 200 with savedAt timestamp when auto-save succeeds', async () => {
      const existingUpdatedAt = new Date('2024-01-01T10:00:00.000Z')
      const lastSaved = '2024-01-01T10:00:00.000Z'

      const mockExistingResponse = {
        id: 'resp-1',
        rfpId: 'rfp-1',
        fieldId: 'field-1',
        responseText: 'Old answer',
        updatedAt: existingUpdatedAt,
      }

      const mockUpdatedResponse = {
        ...mockExistingResponse,
        responseText: 'New auto-saved answer',
        updatedAt: new Date('2024-01-01T12:00:00.000Z'),
      }

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([mockExistingResponse])),
        })),
      } as never)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedResponse])),
          })),
        })),
      } as never)

      const request = createMockRequest('PUT', BASE_URL, {
        responseText: 'New auto-saved answer',
        autoSave: true,
        lastSaved,
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.response).toBeDefined()
      expect(data.savedAt).toBeDefined()
      expect(typeof data.savedAt).toBe('string')
      // savedAt should be a valid ISO timestamp
      expect(() => new Date(data.savedAt)).not.toThrow()
    })

    it('should return 200 with savedAt when autoSave=true but no lastSaved provided', async () => {
      const mockUpdatedResponse = {
        id: 'resp-1',
        rfpId: 'rfp-1',
        fieldId: 'field-1',
        responseText: 'Auto-saved without lastSaved',
        updatedAt: new Date('2024-01-01T12:00:00.000Z'),
      }

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedResponse])),
          })),
        })),
      } as never)

      const request = createMockRequest('PUT', BASE_URL, {
        responseText: 'Auto-saved without lastSaved',
        autoSave: true,
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.savedAt).toBeDefined()
    })

    it('should return 409 Conflict when lastSaved is older than DB updatedAt', async () => {
      // DB record was updated at noon; client last saved at 9am → conflict
      const existingUpdatedAt = new Date('2024-01-01T12:00:00.000Z')
      const lastSaved = '2024-01-01T09:00:00.000Z'

      const mockExistingResponse = {
        id: 'resp-1',
        rfpId: 'rfp-1',
        fieldId: 'field-1',
        responseText: 'Newer server answer',
        updatedAt: existingUpdatedAt,
      }

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([mockExistingResponse])),
        })),
      } as never)

      const request = createMockRequest('PUT', BASE_URL, {
        responseText: 'Client answer',
        autoSave: true,
        lastSaved,
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBe('Conflict')
      expect(data.savedAt).toBeDefined()
      expect(data.savedAt).toBe(existingUpdatedAt.toISOString())
    })

    it('should return 200 when lastSaved matches DB updatedAt (no conflict)', async () => {
      // Client and server are in sync
      const syncedTime = new Date('2024-01-01T10:00:00.000Z')
      const lastSaved = syncedTime.toISOString()

      const mockExistingResponse = {
        id: 'resp-1',
        rfpId: 'rfp-1',
        fieldId: 'field-1',
        responseText: 'Current answer',
        updatedAt: syncedTime,
      }

      const mockUpdatedResponse = {
        ...mockExistingResponse,
        responseText: 'Updated answer',
        updatedAt: new Date('2024-01-01T11:00:00.000Z'),
      }

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([mockExistingResponse])),
        })),
      } as never)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedResponse])),
          })),
        })),
      } as never)

      const request = createMockRequest('PUT', BASE_URL, {
        responseText: 'Updated answer',
        autoSave: true,
        lastSaved,
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.savedAt).toBeDefined()
    })

    it('should not perform conflict check when autoSave is false', async () => {
      const mockUpdatedResponse = {
        id: 'resp-1',
        rfpId: 'rfp-1',
        fieldId: 'field-1',
        responseText: 'Manual save',
        updatedAt: new Date(),
      }

      vi.mocked(requireAuth).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedResponse])),
          })),
        })),
      } as never)

      const request = createMockRequest('PUT', BASE_URL, {
        responseText: 'Manual save',
        autoSave: false,
        lastSaved: '2024-01-01T09:00:00.000Z',
      })
      const response = await updateResponse(request, ROUTE_PARAMS)

      // Should not call db.select for conflict check
      expect(db.select).not.toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })
})
