'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { RfpStatus } from '@/lib/db/schema/rfps'

interface UseProcessingStatusOptions {
  enabled?: boolean
  intervalMs?: number
  onComplete?: () => void
}

interface UseProcessingStatusResult {
  status: RfpStatus | null
  automationPercentage: number | null
  isPolling: boolean
  error: string | null
}

export function useProcessingStatus(
  rfpId: string,
  options: UseProcessingStatusOptions = {}
): UseProcessingStatusResult {
  const { enabled = false, intervalMs = 3000, onComplete } = options

  const [status, setStatus] = useState<RfpStatus | null>(null)
  const [automationPercentage, setAutomationPercentage] = useState<number | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfps/${rfpId}/status`)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Status check failed (${res.status})`)
      }

      const data = await res.json()
      setStatus(data.status)
      setAutomationPercentage(data.automationPercentage)
      setError(null)

      if (data.status !== 'processing') {
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        onCompleteRef.current?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }, [rfpId])

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    setIsPolling(true)
    poll()

    intervalRef.current = setInterval(poll, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, intervalMs, poll])

  return { status, automationPercentage, isPolling, error }
}
