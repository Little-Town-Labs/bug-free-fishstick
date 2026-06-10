import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/utils/auth', () => ({
  requireAuthLimited: vi.fn(),
  requireAdminLimited: vi.fn(),
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
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          then: vi.fn((cb: (v: unknown[]) => unknown) => cb([])),
        })),
        then: vi.fn((cb: (v: unknown[]) => unknown) => cb([])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{}])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{}])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
    })),
  },
}))

// These imports will fail in red phase since routes don't exist yet
import { GET as listCustomers, POST as createCustomer } from '@/app/api/customers/route'
import {
  GET as getCustomer,
  PATCH as updateCustomer,
  DELETE as deleteCustomer,
} from '@/app/api/customers/[customerId]/route'

import { requireAuthLimited, requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'

import { createMockCustomer } from '../../factories/index'

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  url: string = 'http://localhost:3000/api/customers',
  body?: unknown
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {},
  }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'content-type': 'application/json' }
  }
  return new NextRequest(url, init as unknown as ConstructorParameters<typeof NextRequest>[1])
}

describe('Customer API Routes - Contract Tests (TDD Red Phase)', () => {
  const mockAuthContext = { userId: 'user_123', orgId: 'org_456', orgRole: 'admin' }
  const mockMemberContext = { userId: 'user_789', orgId: 'org_456', orgRole: 'org:member' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/customers (list)', () => {
    it('should return 200 with array of customers for authenticated org', async () => {
      const mockCustomers = [
        createMockCustomer({ id: 'cust_1', organizationId: 'org_456', name: 'Acme Corp' }),
        createMockCustomer({ id: 'cust_2', organizationId: 'org_456', name: 'Beta Inc' }),
      ]

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockCustomers)),
        })),
      } as never)

      const response = await listCustomers()

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.customers).toBeDefined()
      expect(Array.isArray(data.customers)).toBe(true)
      expect(requireAuthLimited).toHaveBeenCalled()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new AuthError('Unauthorized', 401)
      )

      createMockRequest('GET')
      const response = await listCustomers()

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/customers (create)', () => {
    it('should return 201 with created customer (admin)', async () => {
      const mockCreatedCustomer = createMockCustomer({
        id: 'cust_new',
        organizationId: 'org_456',
        name: 'New Customer',
      })

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(requireAdminLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockCreatedCustomer])),
        })),
      } as never)

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/customers',
        { name: 'New Customer' }
      )
      const response = await createCustomer(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.customer).toBeDefined()
      expect(data.customer.id).toBe('cust_new')
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockMemberContext)
      vi.mocked(requireAdminLimited).mockRejectedValue(
        new AuthError('Forbidden', 403)
      )

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/customers',
        { name: 'New Customer' }
      )
      const response = await createCustomer(request)

      expect(response.status).toBe(403)
    })

    it('should return 400 on invalid body (missing name)', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(requireAdminLimited).mockResolvedValue(mockAuthContext)

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/customers',
        { description: 'No name provided' }
      )
      const response = await createCustomer(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/customers/[customerId] (get)', () => {
    it('should return 200 with customer details including stats', async () => {
      const mockCustomer = createMockCustomer({
        id: 'cust_1',
        organizationId: 'org_456',
        name: 'Acme Corp',
      })

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      // Mock 3 db.select calls: customer fetch, knowledge count, rfp count
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([mockCustomer])),
            })),
          })),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ count: 5 }])),
          })),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ count: 3 }])),
          })),
        } as never)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/customers/cust_1'
      )
      const response = await getCustomer(request, { params: Promise.resolve({ customerId: 'cust_1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.customer).toBeDefined()
      expect(data.customer.id).toBe('cust_1')
      expect(data.customer.stats).toBeDefined()
      expect(typeof data.customer.stats.totalRfps).toBe('number')
      expect(typeof data.customer.stats.knowledgeEntries).toBe('number')
    })

    it('should return 404 when not found', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/customers/nonexistent'
      )
      const response = await getCustomer(request, { params: Promise.resolve({ customerId: 'nonexistent' }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new AuthError('Unauthorized', 401)
      )

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/customers/cust_1'
      )
      const response = await getCustomer(request, { params: Promise.resolve({ customerId: 'cust_1' }) })

      expect(response.status).toBe(401)
    })
  })

  describe('PATCH /api/customers/[customerId] (update)', () => {
    it('should return 200 with updated customer (admin)', async () => {
      const mockUpdatedCustomer = createMockCustomer({
        id: 'cust_1',
        organizationId: 'org_456',
        name: 'Updated Customer Name',
      })

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(requireAdminLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedCustomer])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'PATCH',
        'http://localhost:3000/api/customers/cust_1',
        { name: 'Updated Customer Name' }
      )
      const response = await updateCustomer(request, { params: Promise.resolve({ customerId: 'cust_1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.customer).toBeDefined()
      expect(data.customer.name).toBe('Updated Customer Name')
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockMemberContext)
      vi.mocked(requireAdminLimited).mockRejectedValue(
        new AuthError('Forbidden', 403)
      )

      const request = createMockRequest(
        'PATCH',
        'http://localhost:3000/api/customers/cust_1',
        { name: 'Updated Customer Name' }
      )
      const response = await updateCustomer(request, { params: Promise.resolve({ customerId: 'cust_1' }) })

      expect(response.status).toBe(403)
    })

    it('should return 404 when not found', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(requireAdminLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'PATCH',
        'http://localhost:3000/api/customers/nonexistent',
        { name: 'Updated' }
      )
      const response = await updateCustomer(request, { params: Promise.resolve({ customerId: 'nonexistent' }) })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /api/customers/[customerId] (delete)', () => {
    it('should return 204 on success (admin)', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(requireAdminLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
      } as never)

      const request = createMockRequest(
        'DELETE',
        'http://localhost:3000/api/customers/cust_1'
      )
      const response = await deleteCustomer(request, { params: Promise.resolve({ customerId: 'cust_1' }) })

      expect(response.status).toBe(204)
    })

    it('should return 403 when not admin', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockMemberContext)
      vi.mocked(requireAdminLimited).mockRejectedValue(
        new AuthError('Forbidden', 403)
      )

      const request = createMockRequest(
        'DELETE',
        'http://localhost:3000/api/customers/cust_1'
      )
      const response = await deleteCustomer(request, { params: Promise.resolve({ customerId: 'cust_1' }) })

      expect(response.status).toBe(403)
    })

    it('should return 404 when not found', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(requireAdminLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
      } as never)

      const request = createMockRequest(
        'DELETE',
        'http://localhost:3000/api/customers/nonexistent'
      )
      const response = await deleteCustomer(request, { params: Promise.resolve({ customerId: 'nonexistent' }) })

      expect(response.status).toBe(404)
    })
  })
})
