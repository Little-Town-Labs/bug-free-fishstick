'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { KnowledgeEntryType } from '@/lib/db/schema/knowledge-entries'
import { ProcessingStatus } from './ProcessingStatus'

interface KnowledgeEntry {
  id: string
  type: KnowledgeEntryType
  title: string
  content: string
  metadata: Record<string, unknown> | null
  processingStatus?: string
  totalChunks?: number | null
  tags?: string[] | null
  createdAt: string | Date
  updatedAt: string | Date
}

interface KnowledgeEntryCardProps {
  entry: KnowledgeEntry
  onDelete?: (id: string) => void
}

const TYPE_LABELS: Record<KnowledgeEntryType, string> = {
  past_rfp: 'Past RFP',
  case_study: 'Case Study',
  certification: 'Certification',
  company_doc: 'Company Doc',
  manual_entry: 'Manual Entry',
}

const TYPE_COLORS: Record<KnowledgeEntryType, string> = {
  past_rfp: 'bg-blue-100 text-blue-800 border-blue-200',
  case_study: 'bg-green-100 text-green-800 border-green-200',
  certification: 'bg-purple-100 text-purple-800 border-purple-200',
  company_doc: 'bg-orange-100 text-orange-800 border-orange-200',
  manual_entry: 'bg-gray-100 text-gray-800 border-gray-200',
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function KnowledgeEntryCard({ entry, onDelete }: KnowledgeEntryCardProps) {
  const contentPreview =
    entry.content.length > 200 ? entry.content.slice(0, 200) + '…' : entry.content

  return (
    <Card data-testid="knowledge-entry-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              data-testid="knowledge-type-badge"
              variant="outline"
              className={cn(TYPE_COLORS[entry.type])}
            >
              {TYPE_LABELS[entry.type]}
            </Badge>
            <span data-testid="knowledge-title" className="font-semibold text-sm">
              {entry.title}
            </span>
            {entry.processingStatus && entry.processingStatus !== 'complete' && (
              <ProcessingStatus status={entry.processingStatus} />
            )}
            {entry.totalChunks && entry.totalChunks > 1 && (
              <Badge variant="outline" className="text-xs">
                {entry.totalChunks} chunks
              </Badge>
            )}
          </div>
          {onDelete && (
            <Button
              data-testid="knowledge-delete-button"
              size="sm"
              variant="outline"
              onClick={() => onDelete(entry.id)}
              className="shrink-0 text-destructive hover:bg-destructive/10"
            >
              Delete
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p data-testid="knowledge-content-preview" className="text-sm text-muted-foreground mb-3">
          {contentPreview}
        </p>
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-2">
            {entry.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
        <div data-testid="knowledge-metadata" className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Created: {formatDate(entry.createdAt)}</span>
          <span>Updated: {formatDate(entry.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
