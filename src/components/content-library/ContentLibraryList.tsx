'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ProposalContentLibraryEntry } from '@/lib/db/schema/proposal-content-library'
import { ContentLibraryForm } from './ContentLibraryForm'

interface ContentLibraryListProps {
  entries: ProposalContentLibraryEntry[]
  onEntriesChange: (entries: ProposalContentLibraryEntry[]) => void
}

function groupByCategory(entries: ProposalContentLibraryEntry[]): Record<string, ProposalContentLibraryEntry[]> {
  return entries.reduce<Record<string, ProposalContentLibraryEntry[]>>((acc, entry) => {
    ;(acc[entry.category] ??= []).push(entry)
    return acc
  }, {})
}

export function ContentLibraryList({ entries, onEntriesChange }: ContentLibraryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const grouped = groupByCategory(entries)
  const categories = Object.keys(grouped).sort()

  function handleSaved(updated: ProposalContentLibraryEntry) {
    const next = entries.map((e) => (e.id === updated.id ? updated : e))
    onEntriesChange(next)
    setEditingId(null)
  }

  async function handleDelete(entry: ProposalContentLibraryEntry) {
    if (!window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return

    setDeletingId(entry.id)
    try {
      const res = await fetch(`/api/content-library/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error(`Failed to delete entry (status ${res.status})`)
      }
      onEntriesChange(entries.filter((e) => e.id !== entry.id))
      toast.success('Entry deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entry')
    } finally {
      setDeletingId(null)
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No content library entries yet. Add one to get started.
      </p>
    )
  }

  return (
    <div className="space-y-6" aria-label="Content library entries">
      {categories.map((category) => (
        <section key={category} aria-labelledby={`category-${category}`}>
          <h2
            id={`category-${category}`}
            className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3"
          >
            {category}
          </h2>
          <ul className="space-y-3" role="list">
            {grouped[category]!.map((entry) => (
              <li key={entry.id} className="rounded-lg border bg-card p-4">
                {editingId === entry.id ? (
                  <ContentLibraryForm
                    entry={entry}
                    onSave={handleSaved}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{entry.name}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {entry.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditingId(entry.id)}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`Edit ${entry.name}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={deletingId === entry.id}
                          className="text-sm text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
                          aria-label={`Delete ${entry.name}`}
                        >
                          {deletingId === entry.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
