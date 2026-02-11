'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ApiKeyInputProps {
  isConfigured: boolean
  onChange: (value: string) => void
  disabled?: boolean
}

export function ApiKeyInput({ isConfigured, onChange, disabled }: ApiKeyInputProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  if (!editing && isConfigured) {
    return (
      <div className="flex items-center gap-2">
        <Input
          data-testid="api-key-input"
          value="••••••••••••••••••••"
          readOnly
          className="font-mono"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={disabled}
        >
          Update
        </Button>
      </div>
    )
  }

  return (
    <Input
      data-testid="api-key-input"
      type="password"
      placeholder="Enter API key..."
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        onChange(e.target.value)
      }}
      autoFocus={editing}
      disabled={disabled}
    />
  )
}
