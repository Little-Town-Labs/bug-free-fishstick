import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { useKnowledgeSearch } from '@/hooks/use-knowledge-search'

const TEST_CUSTOMER_ID = 'cust-123'
const SEARCH_ENDPOINT = `/api/customers/${TEST_CUSTOMER_ID}/knowledge/search`

const mockResults = [
  {
    id: 'kb-1',
    title: 'Security Compliance Policy',
    content: 'Our company maintains SOC 2 Type II certification...',
    type: 'policy',
    similarity: 0.92,
  },
  {
    id: 'kb-2',
    title: 'Data Handling Procedures',
    content: 'All customer data is encrypted at rest and in transit...',
    type: 'procedure',
    similarity: 0.85,
  },
]

describe('useKnowledgeSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('returns initial state with empty results, not searching, no error', () => {
      server.use(
        http.post(SEARCH_ENDPOINT, () => {
          return HttpResponse.json({ results: mockResults })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      expect(result.current.results).toEqual([])
      expect(result.current.isSearching).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('search function', () => {
    it('calls POST /api/customers/{customerId}/knowledge/search with query body', async () => {
      let capturedBody: unknown = null

      server.use(
        http.post(SEARCH_ENDPOINT, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ results: mockResults })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      act(() => {
        result.current.search('security compliance')
      })

      // Advance past the 300ms debounce
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false)
      })

      expect(capturedBody).toEqual({ query: 'security compliance' })
    })

    it('sets isSearching to true during search and false after completion', async () => {
      let resolveSearch!: () => void
      const searchPromise = new Promise<void>((resolve) => {
        resolveSearch = resolve
      })

      server.use(
        http.post(SEARCH_ENDPOINT, async () => {
          await searchPromise
          return HttpResponse.json({ results: mockResults })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      act(() => {
        result.current.search('data handling')
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.isSearching).toBe(true)
      })

      resolveSearch()

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false)
      })
    })

    it('returns results array on successful search', async () => {
      server.use(
        http.post(SEARCH_ENDPOINT, () => {
          return HttpResponse.json({ results: mockResults })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      act(() => {
        result.current.search('security')
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false)
      })

      expect(result.current.results).toEqual(mockResults)
      expect(result.current.error).toBeNull()
    })

    it('sets error on failed search (non-ok response)', async () => {
      server.use(
        http.post(SEARCH_ENDPOINT, () => {
          return HttpResponse.json({ error: 'Search failed' }, { status: 500 })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      act(() => {
        result.current.search('security')
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.results).toEqual([])
    })

    it('sets error on network failure', async () => {
      server.use(
        http.post(SEARCH_ENDPOINT, () => {
          return HttpResponse.error()
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      act(() => {
        result.current.search('security')
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.isSearching).toBe(false)
    })
  })

  describe('debouncing', () => {
    it('debounces rapid calls and only sends the last query', async () => {
      let callCount = 0
      let lastBody: unknown = null

      server.use(
        http.post(SEARCH_ENDPOINT, async ({ request }) => {
          callCount++
          lastBody = await request.json()
          return HttpResponse.json({ results: mockResults })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      act(() => {
        result.current.search('s')
        result.current.search('se')
        result.current.search('sec')
        result.current.search('secu')
        result.current.search('security')
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false)
      })

      expect(callCount).toBe(1)
      expect(lastBody).toEqual({ query: 'security' })
    })

    it('does not fire if call is cancelled before 300ms', async () => {
      let callCount = 0

      server.use(
        http.post(SEARCH_ENDPOINT, () => {
          callCount++
          return HttpResponse.json({ results: mockResults })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      act(() => {
        result.current.search('s')
      })

      // Advance only 200ms — debounce not yet fired
      act(() => {
        vi.advanceTimersByTime(200)
      })

      act(() => {
        result.current.search('se')
      })

      // Advance another 200ms — only the second call's timer has 200ms remaining
      act(() => {
        vi.advanceTimersByTime(200)
      })

      // Neither should have fired yet
      expect(callCount).toBe(0)

      // Advance remaining 100ms for the second call to fire
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(callCount).toBe(1)
      })
    })
  })

  describe('empty query', () => {
    it('clears results immediately when query is empty string without making a fetch call', async () => {
      let callCount = 0

      server.use(
        http.post(SEARCH_ENDPOINT, () => {
          callCount++
          return HttpResponse.json({ results: mockResults })
        })
      )

      const { result } = renderHook(() => useKnowledgeSearch(TEST_CUSTOMER_ID))

      // First do a successful search to populate results
      act(() => {
        result.current.search('security')
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.results).toEqual(mockResults)
      })

      // Now search with empty string
      act(() => {
        result.current.search('')
      })

      // Results should be cleared immediately, no debounce needed
      expect(result.current.results).toEqual([])
      expect(result.current.isSearching).toBe(false)

      // Advance timers to confirm no additional fetch was made
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      expect(callCount).toBe(1)
    })
  })

  describe('customerId changes', () => {
    it('resets results when customerId changes', async () => {
      const secondCustomerId = 'cust-456'

      server.use(
        http.post(SEARCH_ENDPOINT, () => {
          return HttpResponse.json({ results: mockResults })
        }),
        http.post(`/api/customers/${secondCustomerId}/knowledge/search`, () => {
          return HttpResponse.json({ results: [] })
        })
      )

      const { result, rerender } = renderHook(
        ({ id }: { id: string }) => useKnowledgeSearch(id),
        { initialProps: { id: TEST_CUSTOMER_ID } }
      )

      // Populate results for first customer
      act(() => {
        result.current.search('security')
      })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(result.current.results).toEqual(mockResults)
      })

      // Change customerId
      rerender({ id: secondCustomerId })

      // Results should be reset
      expect(result.current.results).toEqual([])
      expect(result.current.error).toBeNull()
    })
  })
})
