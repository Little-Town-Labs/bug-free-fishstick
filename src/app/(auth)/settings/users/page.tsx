'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { UserInviteForm } from '@/components/settings/UserInviteForm'
import { UserList, type UserMember } from '@/components/settings/UserList'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'General', href: '/settings' },
  { label: 'Users', href: '/settings/users' },
  { label: 'LLM Configuration', href: '/settings/llm' },
]

export default function SettingsUsersPage() {
  const pathname = usePathname()
  const [members, setMembers] = useState<UserMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  async function loadMembers() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/users')
      if (!response.ok) {
        if (response.status === 403) {
          setIsAdmin(false)
          return
        }
        return
      }
      const data = await response.json()
      setMembers(data.members ?? [])
      setIsAdmin(data.isAdmin ?? false)
    } catch {
      // silently fail — no redirect, page still renders
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: 'org:admin' | 'org:member') {
    await fetch(`/api/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    await loadMembers()
  }

  useEffect(() => {
    loadMembers()
  }, [])

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors hover:text-foreground',
              pathname === tab.href
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-6">
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Invite User</CardTitle>
              <CardDescription>
                Send an email invitation to add someone to your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserInviteForm onSuccess={loadMembers} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {isAdmin ? 'Manage roles for members of your organization.' : 'Members of your organization.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserList
              members={members}
              isLoading={isLoading}
              onRoleChange={isAdmin ? handleRoleChange : undefined}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
