'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface AssignmentSuggestionProps {
  rfpId: string
  currentAssignee: string
  suggestedAssigneeId: string | null
  isAdmin: boolean
}

export function AssignmentSuggestion({
  rfpId,
  currentAssignee,
  suggestedAssigneeId,
  isAdmin,
}: AssignmentSuggestionProps) {
  const [assigning, setAssigning] = useState(false)
  const [assigned, setAssigned] = useState(false)

  if (!suggestedAssigneeId || suggestedAssigneeId === currentAssignee) return null
  if (assigned) return null

  const handleAccept = async () => {
    setAssigning(true)
    try {
      const res = await fetch(`/api/rfps/${rfpId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedUserId: suggestedAssigneeId }),
      })
      if (res.ok) setAssigned(true)
    } catch {
      // ignore
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div
      className="flex items-center gap-2 text-sm bg-blue-50 rounded px-3 py-2"
      data-testid="assignment-suggestion"
      aria-label="Assignment suggestion"
    >
      <span className="text-blue-700">
        Suggested assignee: <strong>{suggestedAssigneeId}</strong>
      </span>
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAccept} disabled={assigning}>
          {assigning ? 'Assigning...' : 'Accept'}
        </Button>
      )}
    </div>
  )
}
