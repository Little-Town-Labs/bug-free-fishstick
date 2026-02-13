'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ProposalDraft } from '@/lib/db/schema/proposal-drafts'

interface ProposalEditorProps {
  rfpId: string
  draftId: string
  initialContent: string
  status: 'draft' | 'finalized'
  onSaved?: (draft: ProposalDraft) => void
}

export function ProposalEditor({
  rfpId,
  draftId,
  initialContent,
  status: initialStatus,
  onSaved,
}: ProposalEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(initialStatus)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFinalized = currentStatus === 'finalized'

  // Warn on navigation with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!saved) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saved])

  async function saveContent(markdownContent: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      const updated = (await res.json()) as ProposalDraft
      setSaved(true)
      onSaved?.(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save proposal')
    } finally {
      setSaving(false)
    }
  }

  async function finalizeProposal() {
    setSaving(true)
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: content, status: 'finalized' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to finalize')
      }
      const updated = (await res.json()) as ProposalDraft
      setCurrentStatus('finalized')
      setSaved(true)
      toast.success('Proposal finalized')
      onSaved?.(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to finalize proposal')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(value: string) {
    setContent(value)
    setSaved(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveContent(value)
    }, 1000)
  }

  function handleBlur() {
    if (!saved) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      saveContent(content)
    }
  }

  function handleManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    saveContent(content)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? 'Saving…' : saved ? 'Saved' : 'Unsaved changes'}
        </span>
        <div className="flex items-center gap-2">
          {!isFinalized && (
            <>
              <button
                type="button"
                onClick={handleManualSave}
                disabled={saved || saving}
                className="rounded-md px-3 py-1.5 text-sm border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Save proposal changes"
              >
                Save
              </button>
              <button
                type="button"
                onClick={finalizeProposal}
                disabled={saving}
                className="rounded-md px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Finalize proposal — no further edits after this"
              >
                Finalize
              </button>
            </>
          )}
          {isFinalized && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Finalized
            </span>
          )}
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={isFinalized}
        rows={30}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-75"
        aria-label="Proposal markdown content"
        aria-describedby="proposal-editor-hint"
      />
      <p id="proposal-editor-hint" className="text-xs text-muted-foreground">
        {isFinalized
          ? 'This proposal has been finalized and is read-only.'
          : 'Edit the proposal content above. Changes are saved automatically.'}
      </p>
    </div>
  )
}
