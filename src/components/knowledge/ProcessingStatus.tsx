'use client'

import { Badge } from '@/components/ui/badge'

interface ProcessingStatusProps {
  status: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-800' },
  chunking: { label: 'Chunking', className: 'bg-blue-100 text-blue-800' },
  embedding: { label: 'Embedding', className: 'bg-yellow-100 text-yellow-800' },
  complete: { label: 'Complete', className: 'bg-green-100 text-green-800' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800' },
}

export function ProcessingStatus({ status }: ProcessingStatusProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: '' }

  if (status === 'complete') return null

  return (
    <Badge
      variant="secondary"
      className={config.className}
      aria-label={`Processing status: ${config.label}`}
    >
      {config.label}
    </Badge>
  )
}
