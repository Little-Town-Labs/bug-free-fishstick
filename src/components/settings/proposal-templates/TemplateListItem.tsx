'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ProposalTemplate } from '@/lib/db/schema/proposal-templates'

interface TemplateListItemProps {
  template: ProposalTemplate
  isFirst: boolean
  isLast: boolean
  isAdmin: boolean
  onEdit: (template: ProposalTemplate) => void
  onDelete: (template: ProposalTemplate) => void
  onMoveUp: (templateId: string) => void
  onMoveDown: (templateId: string) => void
}

export function TemplateListItem({
  template,
  isFirst,
  isLast,
  isAdmin,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TemplateListItemProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{template.title}</span>
          <Badge variant={template.isRequired ? 'default' : 'secondary'}>
            {template.isRequired ? 'Required' : 'Situational'}
          </Badge>
          {template.evaluateCoverage && (
            <Badge variant="outline">Coverage</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {template.content}
        </p>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMoveUp(template.id)}
            disabled={isFirst}
            aria-label="Move up"
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMoveDown(template.id)}
            disabled={isLast}
            aria-label="Move down"
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(template)}
            aria-label="Edit"
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(template)}
            aria-label="Delete"
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  )
}
