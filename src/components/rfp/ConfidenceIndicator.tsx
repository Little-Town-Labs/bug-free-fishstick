import { cn } from '@/lib/utils'

interface ConfidenceIndicatorProps {
  score: number | null
  showLabel?: boolean
}

type ConfidenceLevel = 'high' | 'medium' | 'low'

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score > 0.8) return 'high'
  if (score > 0.5) return 'medium'
  return 'low'
}

const confidenceConfig: Record<
  ConfidenceLevel,
  { textColor: string; bgColor: string; label: string }
> = {
  high: {
    textColor: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'High Confidence',
  },
  medium: {
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Medium Confidence',
  },
  low: {
    textColor: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Low Confidence',
  },
}

export function ConfidenceIndicator({ score, showLabel = false }: ConfidenceIndicatorProps) {
  if (score === null) return null

  const level = getConfidenceLevel(score)
  const { textColor, bgColor, label } = confidenceConfig[level]
  const percentage = `${Math.round(score * 100)}%`

  return (
    <span
      data-testid="confidence-indicator"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        textColor,
        bgColor
      )}
    >
      {percentage}
      {showLabel && (
        <span data-testid="confidence-label">{label}</span>
      )}
    </span>
  )
}
