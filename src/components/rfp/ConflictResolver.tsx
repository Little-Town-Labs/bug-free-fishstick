'use client'

import { useEffect, useRef } from 'react'

interface ConflictResolverProps {
  fieldLabel: string
  currentVersion: string
  yourVersion: string
  onKeepMine: () => void
  onUseTheirs: () => void
  onCancel: () => void
}

export function ConflictResolver({
  fieldLabel,
  currentVersion,
  yourVersion,
  onKeepMine,
  onUseTheirs,
  onCancel,
}: ConflictResolverProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  // Focus first button on mount + trap focus inside modal
  useEffect(() => {
    firstButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="mx-4 w-full max-w-lg rounded-lg bg-background p-6 shadow-xl">
        <h2 id="conflict-title" className="mb-1 text-lg font-semibold">
          Edit Conflict
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Another user saved changes to <strong>{fieldLabel}</strong> while you were editing.
          Choose which version to keep.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded border p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Current (saved)</p>
            <p className="text-sm whitespace-pre-wrap break-words">{currentVersion || <em>empty</em>}</p>
          </div>
          <div className="rounded border border-primary p-3">
            <p className="mb-1 text-xs font-medium text-primary">Your version</p>
            <p className="text-sm whitespace-pre-wrap break-words">{yourVersion || <em>empty</em>}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUseTheirs}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Use theirs
          </button>
          <button
            ref={firstButtonRef}
            type="button"
            onClick={onKeepMine}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Keep mine
          </button>
        </div>
      </div>
    </div>
  )
}
