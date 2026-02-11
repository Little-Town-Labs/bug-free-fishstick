'use client'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleSelector } from './RoleSelector'

export interface UserMember {
  userId: string
  email: string
  firstName?: string
  lastName?: string
  orgRole: string
  joinedAt: string
}

interface UserListProps {
  members: UserMember[]
  isLoading?: boolean
  onRoleChange?: (userId: string, newRole: 'org:admin' | 'org:member') => void
}

function roleBadgeVariant(orgRole: string): 'default' | 'secondary' {
  return orgRole === 'org:admin' ? 'default' : 'secondary'
}

function roleLabel(orgRole: string): string {
  return orgRole === 'org:admin' ? 'Admin' : 'User'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function UserList({ members, isLoading = false, onRoleChange }: UserListProps) {
  if (isLoading) {
    return (
      <div data-testid="user-list" className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div data-testid="user-list" className="py-8 text-center text-sm text-muted-foreground">
        No members yet. Invite someone to get started.
      </div>
    )
  }

  return (
    <div data-testid="user-list" className="flex flex-col divide-y">
      {members.map((member) => (
        <div
          key={member.userId}
          data-testid={`user-row-${member.userId}`}
          className="flex items-center justify-between py-3"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {member.firstName || member.lastName
                ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
                : member.email}
            </span>
            <span className="text-xs text-muted-foreground">{member.email}</span>
            <span className="text-xs text-muted-foreground">Joined {formatDate(member.joinedAt)}</span>
          </div>

          <div className="flex items-center gap-3">
            {onRoleChange ? (
              <RoleSelector
                value={member.orgRole as 'org:admin' | 'org:member'}
                onChange={(newRole) => onRoleChange(member.userId, newRole)}
              />
            ) : (
              <Badge variant={roleBadgeVariant(member.orgRole)}>
                {roleLabel(member.orgRole)}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
