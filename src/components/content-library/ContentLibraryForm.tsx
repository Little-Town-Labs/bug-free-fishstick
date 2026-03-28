'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ProposalContentLibraryEntry } from '@/lib/db/schema/proposal-content-library'
import { FIXED_SECTIONS } from '@/lib/constants/fixed-sections'

interface ContentLibraryFormProps {
  entry?: ProposalContentLibraryEntry
  onSave: (entry: ProposalContentLibraryEntry) => void
  onCancel: () => void
}

const FIXED_DISPLAY_NAMES: ReadonlySet<string> = new Set(FIXED_SECTIONS.map((s) => s.displayName))

const CATEGORY_SUGGESTIONS = [
  'Pricing',
  'Services',
  'Standards',
  'Boilerplate',
  'SLA Terms',
  'Company Overview',
  'Technical Specs',
].filter((s) => !FIXED_DISPLAY_NAMES.has(s))

export function ContentLibraryForm({ entry, onSave, onCancel }: ContentLibraryFormProps) {
  const [category, setCategory] = useState(entry?.category ?? '')
  const [name, setName] = useState(entry?.name ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = Boolean(entry)

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!category.trim()) newErrors.category = 'Category is required'
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!content.trim()) newErrors.content = 'Content is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const url = isEdit ? `/api/content-library/${entry!.id}` : '/api/content-library'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: category.trim(), name: name.trim(), content: content.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }
      const body = await res.json()
      onSave(body.entry)
      toast.success(isEdit ? 'Entry updated' : 'Entry created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={isEdit ? 'Edit content library entry' : 'Create content library entry'}>
      <div className="space-y-4">
        <div>
          <label htmlFor="cl-category" className="block text-sm font-medium mb-1">
            Category <span aria-hidden="true">*</span>
          </label>
          <input
            id="cl-category"
            type="text"
            list="cl-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Pricing, SLA Terms"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-required="true"
            aria-describedby={errors.category ? 'cl-category-error' : undefined}
          />
          <datalist id="cl-category-suggestions">
            {CATEGORY_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {errors.category && (
            <p id="cl-category-error" className="mt-1 text-sm text-destructive" role="alert">
              {errors.category}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cl-name" className="block text-sm font-medium mb-1">
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="cl-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard SLA Terms"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-required="true"
            aria-describedby={errors.name ? 'cl-name-error' : undefined}
          />
          {errors.name && (
            <p id="cl-name-error" className="mt-1 text-sm text-destructive" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cl-content" className="block text-sm font-medium mb-1">
            Content <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="cl-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the reusable content..."
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            aria-required="true"
            aria-describedby={errors.content ? 'cl-content-error' : undefined}
          />
          {errors.content && (
            <p id="cl-content-error" className="mt-1 text-sm text-destructive" role="alert">
              {errors.content}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm border border-input bg-background hover:bg-accent disabled:opacity-50"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            aria-label={saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create entry'}
          >
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create entry'}
          </button>
        </div>
      </div>
    </form>
  )
}
