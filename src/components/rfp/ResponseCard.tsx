'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ResponseCardProps {
  fieldId: string
  question: string
  responseText: string | null
  confidenceScore: number | null
  status: 'auto_filled' | 'needs_input' | 'manually_filled' | 'approved'
  fieldType: string
  onAccept?: (fieldId: string) => void
  onEdit?: (fieldId: string, newText: string) => void
  onReject?: (fieldId: string) => void
  isLoading?: boolean
}

function getConfidenceLevel(score: number | null): 'high' | 'medium' | 'low' | null {
  if (score === null) return null
  if (score > 0.8) return 'high'
  if (score > 0.5) return 'medium'
  return 'low'
}

const STATUS_LABELS: Record<ResponseCardProps['status'], string> = {
  auto_filled: 'Auto-filled',
  needs_input: 'Needs Input',
  manually_filled: 'Manually Filled',
  approved: 'Approved',
}

export function ResponseCard({
  fieldId,
  question,
  responseText,
  confidenceScore,
  status,
  fieldType,
  onAccept,
  onEdit,
  onReject,
  isLoading = false,
}: ResponseCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(responseText ?? '')

  const confidenceLevel = getConfidenceLevel(confidenceScore)

  const cardBorderClass =
    confidenceLevel === 'high'
      ? 'border-green-200'
      : confidenceLevel === 'medium'
        ? 'border-yellow-200'
        : confidenceLevel === 'low'
          ? 'border-red-200'
          : 'border-gray-200'

  const indicatorColorClass =
    confidenceLevel === 'high'
      ? 'text-green-600'
      : confidenceLevel === 'medium'
        ? 'text-yellow-600'
        : 'text-red-600'

  const hasResponse = responseText !== null && responseText.trim() !== ''

  function handleEditClick() {
    setEditValue(responseText ?? '')
    setIsEditing(true)
  }

  function handleSave() {
    onEdit?.(fieldId, editValue)
    setIsEditing(false)
  }

  function handleCancel() {
    setIsEditing(false)
    setEditValue(responseText ?? '')
  }

  return (
    <div data-testid="response-card" className={cn('rounded-xl border', cardBorderClass)}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="font-semibold">{question}</div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground">{fieldType}</span>
            <Badge>{STATUS_LABELS[status]}</Badge>
            {confidenceScore !== null && (
              <span
                data-testid="confidence-indicator"
                className={cn('text-sm font-medium', indicatorColorClass)}
              >
                {Math.round(confidenceScore * 100)}%
              </span>
            )}
          </div>
        </div>

        <div className="mt-2">
          {isEditing ? (
            <textarea
              className="w-full border rounded p-2 text-sm"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={4}
            />
          ) : (
            <p className="text-sm">
              {hasResponse ? responseText : 'No response generated'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          {isLoading && (
            <span data-testid="loading-spinner" className="text-sm text-muted-foreground">
              Loading...
            </span>
          )}

          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={isLoading}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isLoading}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {onAccept && (
                <Button
                  size="sm"
                  onClick={() => onAccept(fieldId)}
                  disabled={isLoading}
                >
                  Accept
                </Button>
              )}
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditClick}
                  disabled={isLoading}
                >
                  Edit
                </Button>
              )}
              {onReject && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReject(fieldId)}
                  disabled={isLoading}
                >
                  Reject
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
