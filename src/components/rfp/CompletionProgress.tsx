import { cn } from '@/lib/utils'

interface CompletionProgressProps {
  total: number
  completed: number
  className?: string
}

export function CompletionProgress({
  total,
  completed,
  className,
}: CompletionProgressProps) {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

  const barColor =
    percentage === 100
      ? 'bg-green-500'
      : percentage >= 50
        ? 'bg-blue-500'
        : 'bg-gray-400'

  return (
    <div data-testid="completion-progress" className={cn('space-y-1', className)}>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{completed} of {total} responses completed</span>
        <span data-testid="completion-percentage">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          data-testid="completion-bar"
          className={cn('h-2 rounded-full transition-all', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
