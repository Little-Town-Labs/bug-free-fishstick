'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RfpStatus } from '@/lib/db/schema/rfps'

interface ApprovalActionsProps {
  rfpId: string
  status: RfpStatus
  orgRole: string
  onSubmit?: () => void
  onApprove?: () => void
  onReturn?: () => void
  onFinalize?: () => void
  isLoading?: boolean
  size?: 'sm' | 'default'
}

function isAdmin(orgRole: string): boolean {
  return orgRole === 'org:admin'
}

export function ApprovalActions({
  status,
  orgRole,
  onSubmit,
  onApprove,
  onReturn,
  onFinalize,
  isLoading = false,
  size = 'default',
}: ApprovalActionsProps) {
  const admin = isAdmin(orgRole)

  const showSubmit = status === 'draft' && !!onSubmit
  const showApprove = status === 'submitted' && admin && !!onApprove
  const showReturn = status === 'submitted' && admin && !!onReturn
  const showFinalize = status === 'approved' && admin && !!onFinalize

  if (!showSubmit && !showApprove && !showReturn && !showFinalize) {
    return null
  }

  return (
    <div data-testid="approval-actions" className={cn('flex items-center gap-2')}>
      {isLoading && (
        <span
          data-testid="approval-actions-loading"
          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-label="Loading"
        />
      )}
      {showSubmit && (
        <Button
          data-testid="submit-button"
          variant="default"
          size={size}
          disabled={isLoading}
          onClick={onSubmit}
        >
          Submit for Review
        </Button>
      )}
      {showApprove && (
        <Button
          data-testid="approve-button"
          variant="default"
          size={size}
          disabled={isLoading}
          onClick={onApprove}
        >
          Approve
        </Button>
      )}
      {showReturn && (
        <Button
          data-testid="return-button"
          variant="outline"
          size={size}
          disabled={isLoading}
          onClick={onReturn}
        >
          Return
        </Button>
      )}
      {showFinalize && (
        <Button
          data-testid="finalize-button"
          variant="default"
          size={size}
          disabled={isLoading}
          onClick={onFinalize}
        >
          Finalize
        </Button>
      )}
    </div>
  )
}
