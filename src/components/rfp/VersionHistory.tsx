'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface VersionRecord {
  id: string
  versionNumber: number
  changeSummary: string | null
  createdBy: string
  createdAt: string
}

interface VersionHistoryProps {
  rfpId: string
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function VersionHistory({ rfpId }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVersions() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/rfps/${rfpId}/versions`)
        if (!res.ok) {
          throw new Error('Failed to load versions')
        }
        const data = await res.json()
        setVersions(data.versions)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchVersions()
  }, [rfpId])

  if (isLoading) {
    return (
      <div data-testid="version-history-loading" className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div data-testid="version-history-error" className="text-sm text-red-600">
        {error}
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div data-testid="version-history-empty" className="text-sm text-muted-foreground">
        No versions yet.
      </div>
    )
  }

  return (
    <div data-testid="version-history" className="space-y-3">
      {versions.map((version) => (
        <div
          key={version.id}
          data-testid="version-item"
          className="rounded-md border p-3"
        >
          <div className="flex items-center justify-between">
            <span data-testid="version-number" className="text-sm font-semibold">
              Version {version.versionNumber}
            </span>
            <span data-testid="version-date" className="text-xs text-muted-foreground">
              {formatDate(version.createdAt)}
            </span>
          </div>
          {version.changeSummary && (
            <p data-testid="version-summary" className="mt-1 text-sm text-muted-foreground">
              {version.changeSummary}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
