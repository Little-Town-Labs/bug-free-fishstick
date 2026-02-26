'use client'

import { useState, KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TriggerTagInputProps {
  label: string
  tags: string[] | null
  onChange: (tags: string[] | null) => void
  disabled?: boolean
  placeholder?: string
}

export function TriggerTagInput({
  label,
  tags,
  onChange,
  disabled = false,
  placeholder = 'Add tag…',
}: TriggerTagInputProps) {
  const [inputValue, setInputValue] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    const existing = tags ?? []
    if (!existing.includes(tag)) {
      onChange([...existing, tag])
    }
    setInputValue('')
  }

  function removeTag(tag: string) {
    const next = (tags ?? []).filter((t) => t !== tag)
    onChange(next.length > 0 ? next : null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    }
    if (e.key === 'Backspace' && inputValue === '' && tags && tags.length > 0) {
      removeTag(tags[tags.length - 1]!)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-md border border-input bg-background p-2 min-h-10">
        {(tags ?? []).map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 rounded-full hover:bg-muted"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            )}
          </Badge>
        ))}
        {!disabled && (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (inputValue) addTag(inputValue) }}
            placeholder={placeholder}
            className="h-auto flex-1 border-0 p-0 focus-visible:ring-0 shadow-none min-w-20"
            aria-label={placeholder}
          />
        )}
      </div>
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange(null)}
          disabled={!tags || tags.length === 0}
        >
          Clear all
        </Button>
      )}
    </div>
  )
}
