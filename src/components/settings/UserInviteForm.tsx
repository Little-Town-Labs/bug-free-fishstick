'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RoleSelector } from './RoleSelector'

interface UserInviteFormProps {
  onSuccess?: () => void
}

export function UserInviteForm({ onSuccess }: UserInviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'org:admin' | 'org:member'>('org:member')
  const [isLoading, setIsLoading] = useState(false)
  const [emailError, setEmailError] = useState('')

  function validateEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to send invitation')
        return
      }

      toast.success(`Invitation sent to ${email}`)
      setEmail('')
      setRole('org:member')
      onSuccess?.()
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      data-testid="user-invite-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          data-testid="invite-email-input"
          type="email"
          placeholder="colleague@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        {emailError && (
          <p data-testid="invite-email-error" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <RoleSelector
          value={role}
          onChange={setRole}
          disabled={isLoading}
        />
      </div>

      <Button
        data-testid="invite-submit-button"
        type="submit"
        disabled={isLoading || !email}
      >
        {isLoading ? 'Sending…' : 'Send Invitation'}
      </Button>
    </form>
  )
}
