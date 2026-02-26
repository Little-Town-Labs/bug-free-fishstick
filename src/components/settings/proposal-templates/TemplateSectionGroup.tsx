'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TemplateListItem } from './TemplateListItem'
import type { ProposalTemplate, ProposalTemplateSection } from '@/lib/db/schema/proposal-templates'

interface TemplateSectionGroupProps {
  section: ProposalTemplateSection
  label: string
  templates: ProposalTemplate[]
  isAdmin: boolean
  onAdd: () => void
  onEdit: (template: ProposalTemplate) => void
  onDelete: (template: ProposalTemplate) => void
  onMoveUp: (templateId: string) => void
  onMoveDown: (templateId: string) => void
}

export function TemplateSectionGroup({
  label,
  templates,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TemplateSectionGroupProps) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{label}</CardTitle>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAdd}
              aria-label={`Add template to ${label}`}
            >
              Add Template
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No templates in this section.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {templates.map((template, idx) => (
              <TemplateListItem
                key={template.id}
                template={template}
                isFirst={idx === 0}
                isLast={idx === templates.length - 1}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
