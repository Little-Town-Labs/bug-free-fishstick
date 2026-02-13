'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CustomerSettings {
  preferredTone?: 'formal' | 'casual' | 'technical'
  industryContext?: string
  customInstructions?: string
}

interface CustomerSettingsFormProps {
  customerId: string
  settings: CustomerSettings | null
  isAdmin: boolean
  onSave?: (settings: CustomerSettings) => void
}

export function CustomerSettingsForm({ customerId, settings, isAdmin, onSave }: CustomerSettingsFormProps) {
  const [tone, setTone] = useState(settings?.preferredTone ?? 'formal')
  const [industry, setIndustry] = useState(settings?.industryContext ?? '')
  const [instructions, setInstructions] = useState(settings?.customInstructions ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            preferredTone: tone,
            industryContext: industry || undefined,
            customInstructions: instructions || undefined,
          },
        }),
      })

      if (!res.ok) throw new Error('Failed to save settings')

      setSaved(true)
      onSave?.({ preferredTone: tone, industryContext: industry, customInstructions: instructions })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }, [customerId, tone, industry, instructions, onSave])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tone">Preferred Tone</Label>
        <select
          id="tone"
          value={tone}
          onChange={(e) => setTone((e.target.value || 'formal') as 'formal' | 'casual' | 'technical')}
          disabled={!isAdmin}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="formal">Formal</option>
          <option value="casual">Casual</option>
          <option value="technical">Technical</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">Industry Context</Label>
        <Textarea
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          disabled={!isAdmin}
          maxLength={500}
          placeholder="Describe the customer's industry..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">{industry.length}/500</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Custom Instructions</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={!isAdmin}
          maxLength={2000}
          placeholder="Custom instructions for AI responses..."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">{instructions.length}/2000</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Settings saved.</p>}

      {isAdmin && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      )}
    </div>
  )
}
