'use client'

import type { Learning } from '@/lib/db/schema'

const SOURCE_LABELS: Record<string, string> = {
  rfp_approval: 'Auto-learned',
  user_correction: 'Correction',
  manual_entry: 'Manual',
}

interface LearningEntryProps {
  learning: Learning
}

export function LearningEntry({ learning }: LearningEntryProps) {
  return (
    <div data-testid="learning-entry" className="border rounded-md p-3 space-y-1">
      <p className="text-sm">{learning.content}</p>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="bg-secondary px-2 py-0.5 rounded">
          {SOURCE_LABELS[learning.sourceType] ?? learning.sourceType}
        </span>
        <span>{new Date(learning.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
