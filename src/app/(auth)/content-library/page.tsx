'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { ProposalContentLibraryEntry } from '@/lib/db/schema/proposal-content-library'
import { ContentLibraryList } from '@/components/content-library/ContentLibraryList'
import { ContentLibraryForm } from '@/components/content-library/ContentLibraryForm'

export default function ContentLibraryPage() {
  const [entries, setEntries] = useState<ProposalContentLibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchEntries()
  }, [])

  async function fetchEntries() {
    try {
      const res = await fetch('/api/content-library')
      if (!res.ok) throw new Error(`Failed to load entries (status ${res.status})`)
      const body = await res.json()
      setEntries(body.entries)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load content library')
    } finally {
      setLoading(false)
    }
  }

  function handleCreated(entry: ProposalContentLibraryEntry) {
    setEntries((prev) => [...prev, entry])
    setShowForm(false)
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Content Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable content entries that feed into proposal generation.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="Add new content library entry"
          >
            Add Entry
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-6 mb-6">
          <h2 className="text-base font-medium mb-4">New Entry</h2>
          <ContentLibraryForm
            onSave={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground" aria-live="polite">
          Loading...
        </div>
      ) : (
        <ContentLibraryList entries={entries} onEntriesChange={setEntries} />
      )}
    </div>
  )
}
