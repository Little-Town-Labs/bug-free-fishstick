'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ResponseActionsProps {
  fieldId: string
  status: 'auto_filled' | 'needs_input' | 'manually_filled' | 'approved'
  onAccept?: (fieldId: string) => void
  onEdit?: (fieldId: string) => void
  onReject?: (fieldId: string) => void
  isLoading?: boolean
  size?: 'sm' | 'default'
}

export function ResponseActions({
  fieldId,
  status,
  onAccept,
  onEdit,
  onReject,
  isLoading = false,
  size = 'default',
}: ResponseActionsProps) {
  const showAccept = !!onAccept && status !== 'approved'
  const showEdit = !!onEdit
  const showReject = !!onReject && status !== 'needs_input'

  if (!showAccept && !showEdit && !showReject) {
    return null
  }

  return (
    <div data-testid="response-actions" className={cn('flex items-center gap-2')}>
      {isLoading && (
        <span
          data-testid="actions-loading"
          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-label="Loading"
        />
      )}
      {showAccept && (
        <Button
          data-testid="accept-button"
          variant="default"
          size={size}
          disabled={isLoading}
          onClick={() => onAccept(fieldId)}
        >
          Accept
        </Button>
      )}
      {showEdit && (
        <Button
          data-testid="edit-button"
          variant="outline"
          size={size}
          disabled={isLoading}
          onClick={() => onEdit(fieldId)}
        >
          Edit
        </Button>
      )}
      {showReject && (
        <Button
          data-testid="reject-button"
          variant="destructive"
          size={size}
          disabled={isLoading}
          onClick={() => onReject(fieldId)}
        >
          Reject
        </Button>
      )}
    </div>
  )
}
