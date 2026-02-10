'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface KnowledgeSearchResult {
  id: string
  title: string
  content: string
  type: string
  similarity: number
}

interface UseKnowledgeSearchResult {
  results: KnowledgeSearchResult[]
  isSearching: boolean
  error: string | null
  search: (query: string) => void
}

export function useKnowledgeSearch(customerId: string): UseKnowledgeSearchResult {
  const [results, setResults] = useState<KnowledgeSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset results when customerId changes
  useEffect(() => {
    setResults([])
    setError(null)
  }, [customerId])

  const search = useCallback(
    (query: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      if (query === '') {
        setResults([])
        setIsSearching(false)
        return
      }

      debounceTimerRef.current = setTimeout(async () => {
        setIsSearching(true)
        setError(null)

        try {
          const res = await fetch(`/api/customers/${customerId}/knowledge/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
          })

          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || `Search failed (${res.status})`)
          }

          const data = await res.json()
          setResults(data.results)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred')
          setResults([])
        } finally {
          setIsSearching(false)
        }
      }, 300)
    },
    [customerId]
  )

  return { results, isSearching, error, search }
}
