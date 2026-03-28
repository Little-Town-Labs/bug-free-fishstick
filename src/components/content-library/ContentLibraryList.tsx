'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import type { ProposalContentLibraryEntry } from '@/lib/db/schema/proposal-content-library'
import { FIXED_SECTIONS, getFixedSectionDef } from '@/lib/constants/fixed-sections'
import type { FixedSectionType } from '@/lib/constants/fixed-sections'
import { ContentLibraryForm } from './ContentLibraryForm'
import { FixedSectionCard } from './FixedSectionCard'

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

  const { fixedEntries, customEntries } = useMemo(() => {
    const fixed: ProposalContentLibraryEntry[] = []
    const custom: ProposalContentLibraryEntry[] = []
    for (const entry of entries) {
      if (entry.sectionType) {
        fixed.push(entry)
      } else {
        custom.push(entry)
      }
    }
    return { fixedEntries: fixed, customEntries: custom }
  }, [entries])

  const sortedFixedEntries = useMemo(() => {
    const orderMap = new Map(FIXED_SECTIONS.map((s) => [s.sectionType, s.sortOrder]))
    return [...fixedEntries].sort((a, b) => {
      const orderA = orderMap.get(a.sectionType as FixedSectionType) ?? 999
      const orderB = orderMap.get(b.sectionType as FixedSectionType) ?? 999
      return orderA - orderB
    })
  }, [fixedEntries])

  const grouped = groupByCategory(customEntries)
  const categories = Object.keys(grouped).sort()

  function handleFixedSaved(updated: ProposalContentLibraryEntry) {
    const next = entries.map((e) => (e.id === updated.id ? updated : e))
    onEntriesChange(next)
  }

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
    <div className="space-y-8" aria-label="Content library entries">
      {sortedFixedEntries.length > 0 && (
        <section aria-labelledby="fixed-sections-heading">
          <h2
            id="fixed-sections-heading"
            className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3"
          >
            Standard Sections
          </h2>
          <ul className="space-y-3" role="list">
            {sortedFixedEntries.map((entry) => {
              const def = getFixedSectionDef(entry.sectionType as FixedSectionType)
              if (!def) return null
              return (
                <FixedSectionCard
                  key={entry.id}
                  entry={entry}
                  definition={def}
                  onSave={handleFixedSaved}
                />
              )
            })}
          </ul>
        </section>
      )}

      {customEntries.length > 0 && (
        <div className="space-y-6">
          {sortedFixedEntries.length > 0 && (
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Custom Entries
            </h2>
          )}
          {categories.map((category) => (
            <section key={category} aria-labelledby={`category-${category}`}>
              <h3
                id={`category-${category}`}
                className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3"
              >
                {category}
              </h3>
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
      )}
    </div>
  )
}
