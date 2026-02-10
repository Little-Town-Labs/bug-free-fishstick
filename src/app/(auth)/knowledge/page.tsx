'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KnowledgeEntryCard } from '@/components/knowledge/KnowledgeEntryCard'
import { KnowledgeSearch } from '@/components/knowledge/KnowledgeSearch'
import { CustomerSelector } from '@/components/shared/CustomerSelector'
import type { KnowledgeEntry } from '@/lib/db/schema/knowledge-entries'

interface Customer {
  id: string
  name: string
  description: string | null
}

type SearchResult = KnowledgeEntry & { similarity: number }

export default function KnowledgePage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    try {
      setCustomersLoading(true)
      const res = await fetch('/api/customers')
      if (!res.ok) throw new Error('Failed to fetch customers')
      const data = await res.json()
      setCustomers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setCustomersLoading(false)
    }
  }, [])

  const fetchEntries = useCallback(async (customerId: string) => {
    try {
      setEntriesLoading(true)
      setError(null)
      const res = await fetch(`/api/customers/${customerId}/knowledge`)
      if (!res.ok) throw new Error('Failed to fetch knowledge entries')
      const data = await res.json()
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setEntriesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId)
    setSearchResults([])
    if (customerId) {
      fetchEntries(customerId)
    } else {
      setEntries([])
    }
  }

  const handleSearch = (query: string) => {
    if (!selectedCustomerId || !query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    fetch(`/api/customers/${selectedCustomerId}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Search failed'))))
      .then((data) => setSearchResults(data.results ?? data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Search failed'))
      .finally(() => setIsSearching(false))
  }

  const displayedEntries = searchResults.length > 0 ? searchResults : entries

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Select Customer</CardTitle>
        </CardHeader>
        <CardContent>
          {customersLoading ? (
            <Skeleton className="h-10 w-full max-w-sm" />
          ) : (
            <CustomerSelector
              customers={customers}
              selectedId={selectedCustomerId ?? undefined}
              onSelect={handleCustomerChange}
            />
          )}
        </CardContent>
      </Card>

      {selectedCustomerId && (
        <KnowledgeSearch
          results={searchResults}
          isSearching={isSearching}
          onSearch={handleSearch}
        />
      )}

      {selectedCustomerId && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {searchResults.length > 0
              ? `Search Results (${searchResults.length})`
              : `Knowledge Entries (${entriesLoading ? '...' : entries.length})`}
          </h2>

          {entriesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : displayedEntries.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {searchResults.length > 0
                    ? 'No results found for your search.'
                    : 'No knowledge entries for this customer yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {displayedEntries.map((entry) => (
                <KnowledgeEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedCustomerId && !customersLoading && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">
              Select a customer above to browse or search their knowledge base.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
