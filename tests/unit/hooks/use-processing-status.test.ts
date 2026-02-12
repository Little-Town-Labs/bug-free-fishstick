import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { useProcessingStatus } from '@/hooks/use-processing-status'

const TEST_RFP_ID = 'test-rfp-123'

describe('useProcessingStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('returns initial state when not enabled', () => {
      const { result } = renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, { enabled: false })
      )

      expect(result.current.status).toBeNull()
      expect(result.current.automationPercentage).toBeNull()
      expect(result.current.isPolling).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('polling behavior', () => {
    it('polls status endpoint when enabled', async () => {
      let callCount = 0
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}/status`, () => {
          callCount++
          return HttpResponse.json({
            status: 'processing',
            automationPercentage: callCount * 25,
          })
        })
      )

      const { result } = renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, { enabled: true, intervalMs: 1000 })
      )

      await waitFor(() => {
        expect(result.current.status).toBe('processing')
      })

      expect(result.current.isPolling).toBe(true)
      expect(callCount).toBeGreaterThanOrEqual(1)
    })

    it('stops polling when status changes from processing', async () => {
      let callCount = 0
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}/status`, () => {
          callCount++
          const status = callCount >= 3 ? 'draft' : 'processing'
          return HttpResponse.json({
            status,
            automationPercentage: callCount >= 3 ? 100 : callCount * 30,
          })
        })
      )

      const { result } = renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, { enabled: true, intervalMs: 100 })
      )

      await waitFor(() => {
        expect(result.current.status).toBe('processing')
      })

      // Advance timers to trigger more polls
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      await waitFor(() => {
        expect(result.current.status).toBe('draft')
      })

      expect(result.current.isPolling).toBe(false)
    })

    it('updates automation percentage while polling', async () => {
      let callCount = 0
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}/status`, () => {
          callCount++
          return HttpResponse.json({
            status: 'processing',
            automationPercentage: callCount * 20,
          })
        })
      )

      const { result } = renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, { enabled: true, intervalMs: 100 })
      )

      await waitFor(() => {
        expect(result.current.automationPercentage).toBeGreaterThan(0)
      })
    })
  })

  describe('error handling', () => {
    it('sets error on network failure', async () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}/status`, () => {
          return HttpResponse.error()
        })
      )

      const { result } = renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, { enabled: true, intervalMs: 1000 })
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })

    it('sets error on non-ok response', async () => {
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}/status`, () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 })
        })
      )

      const { result } = renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, { enabled: true, intervalMs: 1000 })
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })
  })

  describe('callback', () => {
    it('calls onComplete when processing finishes', async () => {
      const onComplete = vi.fn()
      let callCount = 0

      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}/status`, () => {
          callCount++
          const status = callCount >= 2 ? 'draft' : 'processing'
          return HttpResponse.json({
            status,
            automationPercentage: callCount >= 2 ? 100 : 50,
          })
        })
      )

      renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, {
          enabled: true,
          intervalMs: 100,
          onComplete,
        })
      )

      // Advance to trigger second poll
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled()
      })
    })
  })

  describe('cleanup', () => {
    it('stops polling on unmount', async () => {
      let callCount = 0
      server.use(
        http.get(`/api/rfps/${TEST_RFP_ID}/status`, () => {
          callCount++
          return HttpResponse.json({
            status: 'processing',
            automationPercentage: 50,
          })
        })
      )

      const { result, unmount } = renderHook(() =>
        useProcessingStatus(TEST_RFP_ID, { enabled: true, intervalMs: 100 })
      )

      await waitFor(() => {
        expect(result.current.status).toBe('processing')
      })

      const countAtUnmount = callCount
      unmount()

      // Advance timers after unmount
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      // Should not have made additional calls after unmount
      expect(callCount).toBeLessThanOrEqual(countAtUnmount + 1)
    })
  })
})
