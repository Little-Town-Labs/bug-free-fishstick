import { cn } from '@/lib/utils'
import type { RfpStatus } from '@/lib/db/schema/rfps'

interface WorkflowStatusBadgeProps {
  status: RfpStatus
  size?: 'sm' | 'default'
}

const statusConfig: Record<
  RfpStatus,
  { textColor: string; bgColor: string; label: string }
> = {
  draft: {
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Draft',
  },
  processing: {
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Processing',
  },
  submitted: {
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Submitted',
  },
  approved: {
    textColor: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Approved',
  },
  finalized: {
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Finalized',
  },
}

export function WorkflowStatusBadge({ status, size = 'default' }: WorkflowStatusBadgeProps) {
  const { textColor, bgColor, label } = statusConfig[status]

  return (
    <span
      data-testid="workflow-status-badge"
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        textColor,
        bgColor,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      <span data-testid="workflow-status-label">{label}</span>
    </span>
  )
}
