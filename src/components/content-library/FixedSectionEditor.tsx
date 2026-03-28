'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ProposalContentLibraryEntry } from '@/lib/db/schema/proposal-content-library'
import type { FixedSectionDefinition } from '@/lib/constants/fixed-sections'

interface FixedSectionEditorProps {
  entry: ProposalContentLibraryEntry
  definition: FixedSectionDefinition
  onSave: (updated: ProposalContentLibraryEntry) => void
  onCancel: () => void
}

export function FixedSectionEditor({ entry, definition, onSave, onCancel }: FixedSectionEditorProps) {
  const [content, setContent] = useState(entry.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('Content is required')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/content-library/${entry.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }
      const body = await res.json()
      onSave(body.entry)
      toast.success('Section updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save section')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={`Edit ${definition.displayName}`}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{definition.displayName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.category}</p>
        </div>

        <div>
          <label htmlFor={`fse-content-${entry.id}`} className="block text-sm font-medium mb-1">
            Content <span aria-hidden="true">*</span>
          </label>
          <textarea
            id={`fse-content-${entry.id}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={definition.description}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            aria-required="true"
            aria-describedby={error ? `fse-content-error-${entry.id}` : undefined}
          />
          {error && (
            <p id={`fse-content-error-${entry.id}`} className="mt-1 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm border border-input bg-background hover:bg-accent disabled:opacity-50"
            aria-label="Cancel editing"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            aria-label={saving ? 'Saving...' : 'Save changes'}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  )
}
