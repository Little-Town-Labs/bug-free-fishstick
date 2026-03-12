'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { UserMember } from '@/components/settings/UserList'

interface RfpAssignmentProps {
  rfpId: string
  currentAssigneeId: string
  isAdmin: boolean
  members: UserMember[]
  onAssignmentChange?: (newUserId: string) => void
}

export function RfpAssignment({
  rfpId,
  currentAssigneeId,
  isAdmin,
  members,
  onAssignmentChange,
}: RfpAssignmentProps) {
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId)
  const [isLoading, setIsLoading] = useState(false)

  const currentMember = members.find((m) => m.userId === assigneeId)
  const displayName = currentMember
    ? (currentMember.firstName || currentMember.lastName
        ? `${currentMember.firstName ?? ''} ${currentMember.lastName ?? ''}`.trim()
        : currentMember.email)
    : assigneeId

  async function handleAssigneeChange(newUserId: string) {
    if (newUserId === assigneeId) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/rfps/${rfpId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assignedUserId: newUserId }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to update assignment')
        return
      }

      setAssigneeId(newUserId)
      onAssignmentChange?.(newUserId)
      toast.success('RFP assignment updated')
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div data-testid="rfp-assignment" className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Assigned To
      </span>
      {isAdmin && members.length > 0 ? (
        <select
          value={assigneeId}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          disabled={isLoading}
          className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.firstName || member.lastName
                ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
                : member.email}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm">{displayName}</span>
      )}
    </div>
  )
}
