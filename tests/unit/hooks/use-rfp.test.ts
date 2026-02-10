import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { useRfp } from '@/hooks/use-rfp'

const TEST_RFP_ID = 'test-rfp-123'

const mockRfp = {
  id: TEST_RFP_ID,
  name: 'Test RFP',
  status: 'draft' as const,
  organizationId: 'org-1',
  customerId: 'cust-1',
  assignedUserId: 'user-1',
  originalFileUrl: 'https://example.com/file.pdf',
  originalFileType: 'pdf' as const,
  automationPercentage: 45,
  parsedStructure: {
    pages: 2,
    fields: [
      {
        id: 'field-1',
        type: 'text' as const,
        question: 'Company name?',
        position: { page: 1, x: 0, y: 0, width: 100, height: 20 },
      },
    ],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockResponses = [
  {
    id: 'resp-1',
    rfpId: TEST_RFP_ID,
    fieldId: 'field-1',
    fieldType: 'text',
    question: 'Company name?',
    responseText: 'Acme Corp',
    confidenceScore: 0.95,
    status: 'auto_filled' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

describe('useRfp', () => {
  describe('initial loading state', () => {
    it('starts in loading state', () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          return HttpResponse.json({ rfp: mockRfp })
        }),
        http.get(`/api/rfps/${TEST_RFP_ID}/responses`, () => {
          return HttpResponse.json({ responses: mockResponses })
        })
      )

      const { result } = renderHook(() => useRfp(TEST_RFP_ID))

      expect(result.current.isLoading).toBe(true)
      expect(result.current.rfp).toBeNull()
      expect(result.current.responses).toEqual([])
      expect(result.current.error).toBeNull()
    })
  })

  describe('successful data fetching', () => {
    it('fetches RFP data and transitions to loaded state', async () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          return HttpResponse.json({ rfp: mockRfp })
        }),
        http.get(`/api/rfps/${TEST_RFP_ID}/responses`, () => {
          return HttpResponse.json({ responses: mockResponses })
        })
      )

      const { result } = renderHook(() => useRfp(TEST_RFP_ID))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.rfp).toEqual(mockRfp)
      expect(result.current.responses).toEqual(mockResponses)
      expect(result.current.error).toBeNull()
    })

    it('fetches RFP with no responses', async () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          return HttpResponse.json({ rfp: mockRfp })
        }),
        http.get(`/api/rfps/${TEST_RFP_ID}/responses`, () => {
          return HttpResponse.json({ responses: [] })
        })
      )

      const { result } = renderHook(() => useRfp(TEST_RFP_ID))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.rfp).toEqual(mockRfp)
      expect(result.current.responses).toEqual([])
    })
  })

  describe('error handling', () => {
    it('handles RFP not found (404)', async () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          return HttpResponse.json({ error: 'RFP not found' }, { status: 404 })
        }),
        http.get(`/api/rfps/${TEST_RFP_ID}/responses`, () => {
          return HttpResponse.json({ responses: [] })
        })
      )

      const { result } = renderHook(() => useRfp(TEST_RFP_ID))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.rfp).toBeNull()
    })

    it('handles authentication error (401)', async () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }),
        http.get(`/api/rfps/${TEST_RFP_ID}/responses`, () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        })
      )

      const { result } = renderHook(() => useRfp(TEST_RFP_ID))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('handles network error', async () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          return HttpResponse.error()
        }),
        http.get(`/api/rfps/${TEST_RFP_ID}/responses`, () => {
          return HttpResponse.error()
        })
      )

      const { result } = renderHook(() => useRfp(TEST_RFP_ID))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('refetch', () => {
    it('provides a refetch function that reloads data', async () => {
      let callCount = 0
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          callCount++
          return HttpResponse.json({
            rfp: { ...mockRfp, name: `RFP v${callCount}` },
          })
        }),
        http.get(`/api/rfps/${TEST_RFP_ID}/responses`, () => {
          return HttpResponse.json({ responses: mockResponses })
        })
      )

      const { result } = renderHook(() => useRfp(TEST_RFP_ID))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.rfp?.name).toBe('RFP v1')

      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.rfp?.name).toBe('RFP v2')
      })
    })
  })

  describe('rfpId changes', () => {
    it('refetches when rfpId changes', async () => {
      const secondRfpId = 'test-rfp-456'
      const secondRfp = { ...mockRfp, id: secondRfpId, name: 'Second RFP' }

      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}`, () => {
          return HttpResponse.json({ rfp: mockRfp })
        }),
        http.get(`/api/rfps/${secondRfpId}`, () => {
          return HttpResponse.json({ rfp: secondRfp })
        }),
        http.get(`/api/rfps/:rfpId/responses`, () => {
          return HttpResponse.json({ responses: [] })
        })
      )

      const { result, rerender } = renderHook(
        ({ id }: { id: string }) => useRfp(id),
        { initialProps: { id: TEST_RFP_ID } }
      )

      await waitFor(() => {
        expect(result.current.rfp?.name).toBe('Test RFP')
      })

      rerender({ id: secondRfpId })

      await waitFor(() => {
        expect(result.current.rfp?.name).toBe('Second RFP')
      })
    })
  })
})
