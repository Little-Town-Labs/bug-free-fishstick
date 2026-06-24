import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/utils/auth', () => ({
  requireAuthLimited: vi.fn(),
  requireAdminLimited: vi.fn(),
  isAdmin: vi.fn().mockReturnValue(true),
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

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn(() => Promise.resolve({ ids: ['event-id'] })),
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  })),
}))

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
  put: vi.fn(() =>
    Promise.resolve({
      url: 'https://blob.vercel-storage.com/file.pdf',
      downloadUrl: 'https://blob.vercel-storage.com/file.pdf',
    })
  ),
}))

// These imports will fail in red phase since routes don't exist yet
import { GET as listRfps, POST as createRfp } from '@/app/api/rfps/route'
import {
  GET as getRfp,
  PUT as updateRfp,
  DELETE as deleteRfp,
} from '@/app/api/rfps/[rfpId]/route'
import { POST as uploadFile } from '@/app/api/rfps/[rfpId]/upload/route'
import { POST as processRfp } from '@/app/api/rfps/[rfpId]/process/route'
import { GET as getStatus } from '@/app/api/rfps/[rfpId]/status/route'
import { GET as getResponses } from '@/app/api/rfps/[rfpId]/responses/route'
import {
  PUT as updateResponse,
} from '@/app/api/rfps/[rfpId]/responses/[fieldId]/route'
import { GET as downloadRfp } from '@/app/api/rfps/[rfpId]/download/route'

import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest/client'
import { put as blobPut } from '@vercel/blob'

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  url: string = 'http://localhost:3000/api/rfps',
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: headers || {},
  }
  if (body) {
    init.body = JSON.stringify(body)
    if (!headers?.['content-type']) {
      init.headers = { ...init.headers, 'content-type': 'application/json' }
    }
  }
  return new NextRequest(url, init as unknown as ConstructorParameters<typeof NextRequest>[1])
}

// Helper to create mock FormData request.
// In the jsdom/Node test environment, Request does not auto-set the
// Content-Type boundary when body is FormData, so request.formData() would
// throw. Override formData() directly to bypass the Content-Type check.
function createMockFormDataRequest(
  method: string,
  url: string,
  formData: FormData
): NextRequest {
  const request = new NextRequest(url, { method })
  Object.defineProperty(request, 'formData', {
    value: () => Promise.resolve(formData),
    writable: true,
    configurable: true,
  })
  return request
}

describe('RFP API Routes - Contract Tests (TDD Red Phase)', () => {
  const mockAuthContext = {
    userId: 'user_123',
    orgId: 'org_456',
    orgRole: 'admin',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/rfps (list)', () => {
    it('should return 200 with array of RFPs for authenticated org', async () => {
      const mockRfps = [
        {
          id: 'rfp_1',
          organizationId: 'org_456',
          customerId: 'cust_1',
          name: 'Test RFP',
          status: 'draft' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockRfps)),
        })),
      } as never)

      createMockRequest('GET')
      const response = await listRfps()

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.rfps).toBeDefined()
      expect(Array.isArray(data.rfps)).toBe(true)
      expect(requireAuthLimited).toHaveBeenCalled()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new AuthError('Unauthorized', 401)
      )

      createMockRequest('GET')
      const response = await listRfps()

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/rfps (create)', () => {
    it('should return 201 with created RFP', async () => {
      const customerId = '11111111-1111-4111-8111-111111111111'
      const mockCreatedRfp = {
        id: 'rfp_new',
        organizationId: 'org_456',
        customerId,
        name: 'New RFP',
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      // Customer org-ownership pre-check must find the customer
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: customerId }])),
          })),
        })),
      } as never)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockCreatedRfp])),
        })),
      } as never)

      const request = createMockRequest('POST', 'http://localhost:3000/api/rfps', {
        name: 'New RFP',
        customerId,
      })
      const response = await createRfp(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.rfp).toBeDefined()
      expect(data.rfp.id).toBe('rfp_new')
    })

    it('should return 400 on invalid request body (missing name)', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)

      const request = createMockRequest('POST', 'http://localhost:3000/api/rfps', {
        customerId: 'cust_1',
        // missing name
      })
      const response = await createRfp(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 400 on invalid request body (missing customerId)', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)

      const request = createMockRequest('POST', 'http://localhost:3000/api/rfps', {
        name: 'New RFP',
        // missing customerId
      })
      const response = await createRfp(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new AuthError('Unauthorized', 401)
      )

      const request = createMockRequest('POST', 'http://localhost:3000/api/rfps', {
        name: 'New RFP',
        customerId: 'cust_1',
      })
      const response = await createRfp(request)

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/rfps/[rfpId] (get)', () => {
    it('should return 200 with RFP details', async () => {
      const mockRfp = {
        id: 'rfp_1',
        organizationId: 'org_456',
        customerId: 'cust_1',
        name: 'Test RFP',
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockRfp])),
          })),
        })),
      } as never)

      const request = createMockRequest('GET', 'http://localhost:3000/api/rfps/rfp_1')
      const response = await getRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.rfp).toBeDefined()
      expect(data.rfp.id).toBe('rfp_1')
    })

    it('should return 404 when RFP not found', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as never)

      const request = createMockRequest('GET', 'http://localhost:3000/api/rfps/nonexistent')
      const response = await getRfp(request, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 401 when not authenticated', async () => {
      vi.mocked(requireAuthLimited).mockRejectedValue(
        new AuthError('Unauthorized', 401)
      )

      const request = createMockRequest('GET', 'http://localhost:3000/api/rfps/rfp_1')
      const response = await getRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(401)
    })
  })

  describe('PUT /api/rfps/[rfpId] (update)', () => {
    it('should return 200 with updated RFP', async () => {
      const mockUpdatedRfp = {
        id: 'rfp_1',
        organizationId: 'org_456',
        customerId: 'cust_1',
        name: 'Updated RFP',
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedRfp])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'PUT',
        'http://localhost:3000/api/rfps/rfp_1',
        { name: 'Updated RFP' }
      )
      const response = await updateRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.rfp).toBeDefined()
      expect(data.rfp.name).toBe('Updated RFP')
    })

    it('should return 404 when RFP not found', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'PUT',
        'http://localhost:3000/api/rfps/nonexistent',
        { name: 'Updated' }
      )
      const response = await updateRfp(request, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /api/rfps/[rfpId] (delete)', () => {
    it('should return 204 on successful delete', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
      } as never)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/rfps/rfp_1')
      const response = await deleteRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(204)
    })

    it('should return 404 when not found', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
      } as never)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/rfps/nonexistent')
      const response = await deleteRfp(request, { params: Promise.resolve({ rfpId: 'nonexistent' }) })

      expect(response.status).toBe(404)
    })
  })

  describe('POST /api/rfps/[rfpId]/upload', () => {
    it('should return 200 with file URL after upload', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      // RFP org-ownership pre-check must find the RFP before the blob upload
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: 'rfp_1' }])),
          })),
        })),
      } as never)
      vi.mocked(blobPut).mockResolvedValue({
        url: 'https://blob.vercel-storage.com/rfp_1/file.pdf',
        downloadUrl: 'https://blob.vercel-storage.com/rfp_1/file.pdf',
        pathname: 'rfp_1/file.pdf',
        contentType: 'application/pdf',
        contentDisposition: 'attachment; filename="file.pdf"',
        etag: 'mock-etag',
      })

      const formData = new FormData()
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      formData.append('file', file)

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/rfps/rfp_1/upload',
        formData
      )
      const response = await uploadFile(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.url).toBeDefined()
      expect(data.url).toContain('/api/rfps/rfp_1/document')
    })

    it('should return 400 on missing file', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)

      const formData = new FormData()
      // no file attached

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/rfps/rfp_1/upload',
        formData
      )
      const response = await uploadFile(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return JSON when blob upload fails', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: 'rfp_1' }])),
          })),
        })),
      } as never)
      vi.mocked(blobPut).mockRejectedValueOnce(new Error('Blob storage unavailable'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const formData = new FormData()
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      formData.append('file', file)

      const request = createMockFormDataRequest(
        'POST',
        'http://localhost:3000/api/rfps/rfp_1/upload',
        formData
      )
      const response = await uploadFile(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(500)
      expect(response.headers.get('content-type')).toContain('application/json')
      const data = await response.json()
      expect(data.error).toBe('Blob storage unavailable')

      consoleError.mockRestore()
    })
  })

  describe('POST /api/rfps/[rfpId]/process', () => {
    it('should return 202 (accepted) and send Inngest event', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: 'rfp_1',
                  organizationId: 'org_456',
                  status: 'draft',
                },
              ])
            ),
          })),
        })),
      } as never)
      vi.mocked(inngest.send).mockResolvedValue({ ids: ['event-123'] })

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/rfps/rfp_1/process'
      )
      const response = await processRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(202)
      const data = await response.json()
      expect(data.message).toBeDefined()
      expect(inngest.send).toHaveBeenCalledWith({
        name: 'rfp/process',
        data: {
          rfpId: 'rfp_1',
          organizationId: 'org_456',
        },
      })
    })

    it('should return 409 if already processing', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: 'rfp_1',
                  organizationId: 'org_456',
                  status: 'processing',
                },
              ])
            ),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/rfps/rfp_1/process'
      )
      const response = await processRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/rfps/[rfpId]/status', () => {
    it('should return 200 with processing status and automation percentage', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      // First call: fetch RFP record
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: 'rfp_1',
                  status: 'processing',
                  automationPercentage: 75,
                },
              ])
            ),
          })),
        })),
      } as never)
      // Second call: fetch responses for completion percentage
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() =>
            Promise.resolve([
              { status: 'approved' },
              { status: 'auto_filled' },
              { status: 'manually_filled' },
            ])
          ),
        })),
      } as never)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/rfps/rfp_1/status'
      )
      const response = await getStatus(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('processing')
      expect(data.automationPercentage).toBe(75)
      expect(data.completionPercentage).toBe(67)
      expect(data.totalResponses).toBe(3)
      expect(data.completedResponses).toBe(2)
    })
  })

  describe('GET /api/rfps/[rfpId]/responses', () => {
    it('should return 200 with array of field responses', async () => {
      const mockResponses = [
        {
          id: 'resp_1',
          rfpId: 'rfp_1',
          fieldId: 'field_1',
          fieldType: 'text' as const,
          question: 'What is your company name?',
          responseText: 'Acme Corp',
          confidenceScore: 0.95,
          status: 'auto_filled' as const,
          position: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockResponses)),
        })),
      } as never)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/rfps/rfp_1/responses'
      )
      const response = await getResponses(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.responses).toBeDefined()
      expect(Array.isArray(data.responses)).toBe(true)
    })
  })

  describe('PUT /api/rfps/[rfpId]/responses/[fieldId]', () => {
    it('should return 200 with updated response', async () => {
      const mockUpdatedResponse = {
        id: 'resp_1',
        rfpId: 'rfp_1',
        fieldId: 'field_1',
        responseText: 'Updated response',
        status: 'manually_filled' as const,
      }

      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUpdatedResponse])),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'PUT',
        'http://localhost:3000/api/rfps/rfp_1/responses/field_1',
        { responseText: 'Updated response', status: 'manually_filled' }
      )
      const response = await updateResponse(request, {
        params: Promise.resolve({ rfpId: 'rfp_1', fieldId: 'field_1' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.response).toBeDefined()
      expect(data.response.responseText).toBe('Updated response')
    })

    it('should return 400 on invalid update body', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)

      const request = createMockRequest(
        'PUT',
        'http://localhost:3000/api/rfps/rfp_1/responses/field_1',
        { invalidField: 'value' }
      )
      const response = await updateResponse(request, {
        params: Promise.resolve({ rfpId: 'rfp_1', fieldId: 'field_1' }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/rfps/[rfpId]/download', () => {
    it('should return 200 with file buffer (PDF or DOCX)', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: 'rfp_1',
                  status: 'finalized',
                  originalFileType: 'pdf',
                  completedFileUrl: 'https://blob.vercel-storage.com/completed.pdf',
                },
              ])
            ),
          })),
        })),
      } as never)

      // The @vercel/blob `get` mock returns undefined, so downloadFile
      // falls back to plain fetch — mock that fetch here.
      global.fetch = vi.fn(() =>
        Promise.resolve(new Response(Buffer.from('PDF content'), { status: 200 }))
      )

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/rfps/rfp_1/download'
      )
      const response = await downloadRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
    })

    it('should return 404 if no completed file', async () => {
      vi.mocked(requireAuthLimited).mockResolvedValue(mockAuthContext)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: 'rfp_1',
                  status: 'draft',
                  completedFileUrl: null,
                },
              ])
            ),
          })),
        })),
      } as never)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/rfps/rfp_1/download'
      )
      const response = await downloadRfp(request, { params: Promise.resolve({ rfpId: 'rfp_1' }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })
})
