'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'

interface SearchResult {
  id: string
  title: string
  content: string
  type: KnowledgeEntryType
  similarity: number
}

interface KnowledgeSearchProps {
  results: SearchResult[]
  isSearching: boolean
  onSearch: (query: string) => void
}

const TYPE_LABELS: Record<KnowledgeEntryType, string> = {
  past_rfp: 'Past RFP',
  case_study: 'Case Study',
  certification: 'Certification',
  company_doc: 'Company Doc',
  product_doc: 'Product Doc',
  technical_spec: 'Technical Spec',
  faq: 'FAQ',
}

const TYPE_COLORS: Record<KnowledgeEntryType, string> = {
  past_rfp: 'bg-blue-100 text-blue-800 border-blue-200',
  case_study: 'bg-green-100 text-green-800 border-green-200',
  certification: 'bg-purple-100 text-purple-800 border-purple-200',
  company_doc: 'bg-orange-100 text-orange-800 border-orange-200',
  product_doc: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  technical_spec: 'bg-gray-100 text-gray-800 border-gray-200',
  faq: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

export function KnowledgeSearch({ results, isSearching, onSearch }: KnowledgeSearchProps) {
  const [query, setQuery] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQuery(value)
    onSearch(value)
  }

  return (
    <div data-testid="knowledge-search" className="flex flex-col gap-4">
      <div className="relative">
        <Input
          data-testid="search-input"
          value={query}
          onChange={handleChange}
          placeholder="Search knowledge base..."
          className="w-full"
        />
        {isSearching && (
          <span
            data-testid="search-loading"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          >
            Searching...
          </span>
        )}
      </div>

      {results.length === 0 && query.trim() !== '' && !isSearching ? (
        <div data-testid="search-empty-state" className="text-center py-8 text-sm text-muted-foreground">
          No results found for &ldquo;{query}&rdquo;
        </div>
      ) : (
        <ul data-testid="search-results" className="flex flex-col gap-3">
          {results.map((result) => {
            const contentPreview =
              result.content.length > 200 ? result.content.slice(0, 200) + '…' : result.content
            const similarityPct = Math.round(result.similarity * 100)

            return (
              <li
                key={result.id}
                data-testid="search-result-item"
                className="rounded-lg border p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span data-testid="result-title" className="font-medium text-sm">
                    {result.title}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(TYPE_COLORS[result.type])}
                    >
                      {TYPE_LABELS[result.type]}
                    </Badge>
                    <span
                      data-testid="result-similarity"
                      className="text-xs text-muted-foreground"
                    >
                      {similarityPct}% match
                    </span>
                  </div>
                </div>
                <p data-testid="result-content-preview" className="text-xs text-muted-foreground">
                  {contentPreview}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
