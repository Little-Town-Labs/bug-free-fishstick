import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ProgressTrackerProps {
  totalFields: number
  completedFields: number
  automationPercentage: number
  status: 'uploaded' | 'processing' | 'draft' | 'review' | 'approved' | 'completed'
}

const STATUS_LABELS: Record<ProgressTrackerProps['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  completed: 'Completed',
}

export function ProgressTracker({
  totalFields,
  completedFields,
  automationPercentage,
  status,
}: ProgressTrackerProps) {
  const progressPercent =
    totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0

  return (
    <div data-testid="progress-tracker" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {completedFields} / {totalFields} fields completed
        </span>
        <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full bg-primary transition-all')}
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <p className="text-xs text-muted-foreground">{automationPercentage}% auto-filled</p>
    </div>
  )
}
