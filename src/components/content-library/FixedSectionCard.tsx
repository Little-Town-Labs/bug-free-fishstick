'use client'

import { useState } from 'react'
import type { ProposalContentLibraryEntry } from '@/lib/db/schema/proposal-content-library'
import type { FixedSectionDefinition } from '@/lib/constants/fixed-sections'
import { FixedSectionEditor } from './FixedSectionEditor'

interface FixedSectionCardProps {
  entry: ProposalContentLibraryEntry
  definition: FixedSectionDefinition
  onSave: (updated: ProposalContentLibraryEntry) => void
}

export function FixedSectionCard({ entry, definition, onSave }: FixedSectionCardProps) {
  const [editing, setEditing] = useState(false)

  const hasContent = Boolean(entry.content.trim())

  function handleSaved(updated: ProposalContentLibraryEntry) {
    onSave(updated)
    setEditing(false)
  }

  return (
    <li className="rounded-lg border bg-card p-4" aria-label={definition.displayName}>
      {editing ? (
        <FixedSectionEditor
          entry={entry}
          definition={definition}
          onSave={handleSaved}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">{definition.displayName}</p>
            {hasContent ? (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                {entry.content}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1 italic">
                {definition.description}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label={hasContent ? `Edit ${definition.displayName}` : `Add content for ${definition.displayName}`}
            >
              {hasContent ? 'Edit' : 'Add Content'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
