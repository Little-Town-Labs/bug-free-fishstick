'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Rfp } from '@/lib/db/schema/rfps'
import type { RfpResponse } from '@/lib/db/schema/rfp-responses'

interface UseRfpResult {
  rfp: Rfp | null
  responses: RfpResponse[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useRfp(rfpId: string): UseRfpResult {
  const [rfp, setRfp] = useState<Rfp | null>(null)
  const [responses, setResponses] = useState<RfpResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [rfpRes, responsesRes] = await Promise.all([
        fetch(`/api/rfps/${rfpId}`),
        fetch(`/api/rfps/${rfpId}/responses`),
      ])

      if (!rfpRes.ok) {
        const body = await rfpRes.json().catch(() => ({}))
        throw new Error(body.error || `Failed to fetch RFP (${rfpRes.status})`)
      }

      const rfpData = await rfpRes.json()
      setRfp(rfpData.rfp)

      if (responsesRes.ok) {
        const responsesData = await responsesRes.json()
        setResponses(responsesData.responses)
      } else {
        setResponses([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setRfp(null)
      setResponses([])
    } finally {
      setIsLoading(false)
    }
  }, [rfpId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { rfp, responses, isLoading, error, refetch: fetchData }
}
