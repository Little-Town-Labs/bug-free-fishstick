'use client'

import { Badge } from '@/components/ui/badge'

interface ClassificationBadgeProps {
  rfpType: string | null
  complexity: string | null
  industryTags?: string[] | null
}

const TYPE_COLORS: Record<string, string> = {
  technical: 'bg-blue-100 text-blue-800',
  commercial: 'bg-green-100 text-green-800',
  compliance: 'bg-purple-100 text-purple-800',
  mixed: 'bg-gray-100 text-gray-800',
}

const COMPLEXITY_COLORS: Record<string, string> = {
  simple: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  complex: 'bg-red-100 text-red-800',
}

export function ClassificationBadge({ rfpType, complexity, industryTags }: ClassificationBadgeProps) {
  if (!rfpType && !complexity) return null

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="classification-badge" aria-label="RFP classification">
      {rfpType && (
        <Badge className={TYPE_COLORS[rfpType] ?? ''} variant="secondary">
          {rfpType}
        </Badge>
      )}
      {complexity && (
        <Badge className={COMPLEXITY_COLORS[complexity] ?? ''} variant="secondary">
          {complexity}
        </Badge>
      )}
      {industryTags?.map(tag => (
        <Badge key={tag} variant="outline" className="text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
