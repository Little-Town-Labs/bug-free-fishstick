'use client'

import { useState, useCallback, useRef } from 'react'
import { DocumentPreview } from '@/components/rfp/DocumentPreview'
import type { ParsedStructure } from '@/components/rfp/DocumentPreview'
import { ResponseCard } from '@/components/rfp/ResponseCard'
import { CompletionProgress } from '@/components/rfp/CompletionProgress'

interface RfpResponse {
  id: string
  fieldId: string
  fieldType: string
  question: string
  responseText: string | null
  confidenceScore: number | null
  status: 'auto_filled' | 'needs_input' | 'manually_filled' | 'approved'
}

interface RfpEditorProps {
  rfpId: string
  documentUrl: string | null
  documentType: 'pdf' | 'docx' | null
  parsedStructure: ParsedStructure | null
  fileName?: string
  responses: RfpResponse[]
  onAcceptResponse?: (fieldId: string) => void
  onEditResponse?: (fieldId: string, newText: string) => void
  onRejectResponse?: (fieldId: string) => void
  onItemClick?: (fieldId: string, page?: number) => void
  isProcessing?: boolean
  autoSave?: boolean
  documentViewer?: React.ReactNode
}

const DEBOUNCE_MS = 800

export function RfpEditor({
  rfpId,
  documentUrl,
  documentType,
  parsedStructure,
  fileName,
  responses: initialResponses,
  onAcceptResponse,
  onEditResponse,
  onRejectResponse,
  isProcessing = false,
  autoSave = false,
  documentViewer,
}: RfpEditorProps) {
  const [responses, setResponses] = useState<RfpResponse[]>(initialResponses)
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastSavedAt = useRef<Map<string, string>>(new Map())

  const completedCount = responses.filter(
    (r) => r.status === 'approved' || r.status === 'manually_filled'
  ).length

  const performSave = useCallback(
    async (fieldId: string, responseText: string, status?: RfpResponse['status']) => {
      setSavingFields((prev) => new Set(prev).add(fieldId))
      setSaveError(null)

      try {
        const body: Record<string, unknown> = { responseText }
        if (status) body.status = status
        if (autoSave) {
          body.autoSave = true
          const ts = lastSavedAt.current.get(fieldId)
          if (ts) body.lastSaved = ts
        }

        const res = await fetch(
          `/api/rfps/${rfpId}/responses/${fieldId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )

        if (res.status === 409) {
          setSaveError('A newer version of this response exists. Please refresh.')
          return
        }

        if (!res.ok) {
          setSaveError('Failed to save response.')
          return
        }

        const data = await res.json()
        if (data.savedAt) {
          lastSavedAt.current.set(fieldId, data.savedAt)
        }
      } catch {
        setSaveError('Network error while saving.')
      } finally {
        setSavingFields((prev) => {
          const next = new Set(prev)
          next.delete(fieldId)
          return next
        })
      }
    },
    [rfpId, autoSave]
  )

  const handleAcceptResponse = useCallback(
    (fieldId: string) => {
      // Optimistic update
      setResponses((prev) =>
        prev.map((r) => (r.fieldId === fieldId ? { ...r, status: 'approved' } : r))
      )
      onAcceptResponse?.(fieldId)
      const response = responses.find((r) => r.fieldId === fieldId)
      if (response?.responseText !== null && response?.responseText !== undefined) {
        performSave(fieldId, response.responseText, 'approved')
      }
    },
    [responses, onAcceptResponse, performSave]
  )

  const handleEditResponse = useCallback(
    (fieldId: string, newText: string) => {
      // Optimistic update
      setResponses((prev) =>
        prev.map((r) =>
          r.fieldId === fieldId ? { ...r, responseText: newText, status: 'manually_filled' } : r
        )
      )
      onEditResponse?.(fieldId, newText)

      if (autoSave) {
        // Debounce auto-save
        const existing = debounceTimers.current.get(fieldId)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
          performSave(fieldId, newText, 'manually_filled')
          debounceTimers.current.delete(fieldId)
        }, DEBOUNCE_MS)
        debounceTimers.current.set(fieldId, timer)
      } else {
        performSave(fieldId, newText, 'manually_filled')
      }
    },
    [autoSave, onEditResponse, performSave]
  )

  const handleRejectResponse = useCallback(
    (fieldId: string) => {
      // Optimistic update
      setResponses((prev) =>
        prev.map((r) => (r.fieldId === fieldId ? { ...r, status: 'needs_input' } : r))
      )
      onRejectResponse?.(fieldId)
      const response = responses.find((r) => r.fieldId === fieldId)
      if (response?.responseText !== null && response?.responseText !== undefined) {
        performSave(fieldId, response.responseText ?? '', 'needs_input')
      }
    },
    [responses, onRejectResponse, performSave]
  )

  return (
    <div className="relative" data-testid="rfp-editor" aria-label="RFP Editor">
      {isProcessing && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-lg"
          role="status"
          aria-live="polite"
          aria-label="Processing RFP"
        >
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Processing RFP...</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {documentViewer ?? (
            <DocumentPreview
              documentUrl={documentUrl}
              documentType={documentType}
              parsedStructure={parsedStructure}
              fileName={fileName}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Responses</h2>
            {savingFields.size > 0 && (
              <span
                data-testid="auto-save-indicator"
                className="text-xs text-muted-foreground animate-pulse"
                role="status"
                aria-live="polite"
              >
                Saving...
              </span>
            )}
            {autoSave && savingFields.size === 0 && lastSavedAt.current.size > 0 && (
              <span data-testid="saved-indicator" className="text-xs text-muted-foreground">
                Saved
              </span>
            )}
          </div>

          {saveError && (
            <div
              role="alert"
              data-testid="save-error"
              className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded"
            >
              {saveError}
            </div>
          )}

          {responses.length > 0 && (
            <CompletionProgress total={responses.length} completed={completedCount} />
          )}

          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No responses yet. Process the RFP to generate AI responses.
            </p>
          ) : (
            responses.map((response) => (
              <ResponseCard
                key={response.id}
                rfpId={rfpId}
                fieldId={response.fieldId}
                question={response.question}
                responseText={response.responseText}
                confidenceScore={response.confidenceScore}
                status={response.status}
                fieldType={response.fieldType}
                onAccept={handleAcceptResponse}
                onEdit={handleEditResponse}
                onReject={handleRejectResponse}
                isLoading={savingFields.has(response.fieldId)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
