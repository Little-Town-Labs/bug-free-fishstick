'use client'

import { cn } from '@/lib/utils'

interface RoleSelectorProps {
  value: 'org:admin' | 'org:member'
  onChange: (role: 'org:admin' | 'org:member') => void
  disabled?: boolean
  className?: string
}

export function RoleSelector({ value, onChange, disabled = false, className }: RoleSelectorProps) {
  return (
    <div data-testid="role-selector" className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'org:admin' | 'org:member')}
        disabled={disabled}
        className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="org:member">User</option>
        <option value="org:admin">Admin</option>
      </select>
    </div>
  )
}
