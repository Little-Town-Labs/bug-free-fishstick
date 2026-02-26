'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CoverageReport, CoverageRequirement } from '@/lib/db/schema/proposal-drafts'

interface CoverageReportPanelProps {
  coverageReport: CoverageReport | null | undefined
  rfpId: string
  draftId: string
  onUpdated: (report: CoverageReport) => void
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-red-100 text-red-800 border-red-200'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Fair'
  return 'Low'
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isSupplierTerm(req: CoverageRequirement): boolean {
  return req.requirementId.startsWith('template:')
}

function RequirementRow({ requirement }: { requirement: CoverageRequirement }) {
  const [expanded, setExpanded] = useState(false)
  const supplierTerm = isSupplierTerm(requirement)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={expanded}
      >
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {requirement.addressed ? (
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </span>
        <span className="flex-1 text-sm">
          <span className={requirement.addressed ? 'text-foreground' : 'text-foreground font-medium'}>
            {requirement.question}
          </span>
          {supplierTerm && (
            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 align-middle">
              Supplier Terms
            </Badge>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-10 text-sm text-muted-foreground">
          {requirement.addressed && requirement.evidence ? (
            <div>
              <span className="font-medium text-foreground">Evidence: </span>
              {requirement.evidence}
            </div>
          ) : (
            <div>
              <span className="font-medium text-foreground">Gap: </span>
              {requirement.gap ?? 'No details available'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CoverageReportPanel({ coverageReport, rfpId, draftId, onUpdated }: CoverageReportPanelProps) {
  const [loading, setLoading] = useState(false)

  async function handleRecheck() {
    setLoading(true)
    try {
      const res = await fetch(`/api/rfps/${rfpId}/proposals/${draftId}/coverage`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Re-check failed')
      }
      const report = (await res.json()) as CoverageReport
      onUpdated(report)
      toast.success('Coverage report updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Coverage re-check failed')
    } finally {
      setLoading(false)
    }
  }

  if (!coverageReport) {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Requirement Coverage</h3>
          <Button variant="outline" size="sm" onClick={handleRecheck} disabled={loading}>
            {loading ? 'Checking…' : 'Check Coverage'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Not yet evaluated. Click "Check Coverage" to analyze.</p>
      </div>
    )
  }

  const { coverageScore, evaluatedAt, requirements } = coverageReport
  const addressedCount = requirements.filter((r) => r.addressed).length

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Requirement Coverage</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(evaluatedAt)}
            </span>
            <Button variant="outline" size="sm" onClick={handleRecheck} disabled={loading}>
              {loading ? 'Checking…' : 'Re-check'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${getScoreColor(coverageScore)}`}
          >
            {coverageScore}%
          </span>
          <span className="text-sm text-muted-foreground">
            {getScoreLabel(coverageScore)} — {addressedCount} of {requirements.length} requirements addressed
          </span>
        </div>
      </div>

      {requirements.length > 0 && (
        <div className="border-t border-border">
          {requirements.map((req) => (
            <RequirementRow key={req.requirementId} requirement={req} />
          ))}
        </div>
      )}

      {requirements.length === 0 && (
        <div className="border-t border-border p-4">
          <p className="text-sm text-muted-foreground">No requirements found to evaluate.</p>
        </div>
      )}
    </div>
  )
}
