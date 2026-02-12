'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LlmProviderSelector } from './LlmProviderSelector'
import type { LlmProvider } from '@/lib/db/schema'

interface KeyRowProps {
  label: string
  hint?: string
  isConfigured: boolean
  isAdmin: boolean
  onSave: (key: string) => Promise<void>
  onDelete: () => Promise<void>
}

function KeyRow({ label, hint, isConfigured, isAdmin, onSave, onDelete }: KeyRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value.trim())
      setValue('')
      setEditing(false)
      toast.success(`${label} saved`)
    } catch {
      toast.error(`Failed to save ${label}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await onDelete()
      toast.success(`${label} removed`)
    } catch {
      toast.error(`Failed to remove ${label}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {isConfigured && !editing ? (
        <div className="flex items-center gap-2">
          <Input value="••••••••••••••••••••••••" readOnly className="font-mono" />
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={saving}>
                Update
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                Delete
              </Button>
            </>
          )}
        </div>
      ) : isAdmin ? (
        <div className="flex items-center gap-2">
          <Input
            type="password"
            placeholder={`Enter ${label}...`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus={editing}
            disabled={saving}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Button size="sm" onClick={handleSave} disabled={saving || !value.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {editing && (
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setValue('') }} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      ) : (
        <Input value="Not configured" readOnly className="text-muted-foreground" />
      )}
    </div>
  )
}

export function SettingsForm({ isAdmin }: { isAdmin: boolean }) {
  const [provider, setProvider] = useState<LlmProvider>('claude')
  const [openaiConfigured, setOpenaiConfigured] = useState(false)
  const [anthropicConfigured, setAnthropicConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingProvider, setSavingProvider] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setProvider(data.settings.llmProvider)
          setOpenaiConfigured(data.settings.openaiApiKeyConfigured)
          setAnthropicConfigured(data.settings.anthropicApiKeyConfigured)
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  async function saveKey(field: 'openaiApiKey' | 'anthropicApiKey', value: string | null) {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) throw new Error('Failed')
    if (field === 'openaiApiKey') setOpenaiConfigured(value !== null)
    if (field === 'anthropicApiKey') setAnthropicConfigured(value !== null)
  }

  async function saveProvider(p: LlmProvider) {
    setSavingProvider(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmProvider: p }),
      })
      if (!res.ok) throw new Error('Failed')
      setProvider(p)
      toast.success('Active provider saved')
    } catch {
      toast.error('Failed to save provider')
    } finally {
      setSavingProvider(false)
    }
  }

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading settings...</CardContent></Card>
  }

  return (
    <Card data-testid="settings-form">
      <CardHeader>
        <CardTitle>LLM Provider Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Active Provider</Label>
          <div className="flex items-center gap-2">
            <LlmProviderSelector value={provider} onChange={setProvider} disabled={!isAdmin || savingProvider} />
            {isAdmin && (
              <Button size="sm" onClick={() => saveProvider(provider)} disabled={savingProvider}>
                {savingProvider ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">The provider used for RFP processing.</p>
        </div>

        <KeyRow
          label="Anthropic API Key"
          isConfigured={anthropicConfigured}
          isAdmin={isAdmin}
          onSave={(v) => saveKey('anthropicApiKey', v)}
          onDelete={() => saveKey('anthropicApiKey', null)}
        />

        <KeyRow
          label="OpenAI API Key"
          hint="Required for knowledge base embeddings."
          isConfigured={openaiConfigured}
          isAdmin={isAdmin}
          onSave={(v) => saveKey('openaiApiKey', v)}
          onDelete={() => saveKey('openaiApiKey', null)}
        />

        {!isAdmin && (
          <p className="text-xs text-muted-foreground">Only admins can update these settings.</p>
        )}
      </CardContent>
    </Card>
  )
}
