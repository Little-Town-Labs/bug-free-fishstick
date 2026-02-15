'use client'

import type { RfpResponse } from '@/lib/db/schema/rfp-responses'

interface ActivityLogProps {
  responses: RfpResponse[]
}

export function ActivityLog({ responses }: ActivityLogProps) {
  // Build activity entries from responses that have been modified (updatedAt !== createdAt)
  const entries = responses
    .filter((r) => r.updatedAt.getTime() !== r.createdAt.getTime())
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 50) // Cap at 50 most recent

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No edits recorded yet.</p>
    )
  }

  return (
    <ol aria-label="Activity log" className="space-y-2">
      {entries.map((entry) => (
        <li key={`${entry.id}-${entry.updatedAt.toISOString()}`} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <span className="font-medium truncate">{entry.question}</span>
            <span className="ml-1 text-muted-foreground">
              · {entry.updatedAt.toLocaleString()} · v{entry.version}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
