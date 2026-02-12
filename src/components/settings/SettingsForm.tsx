'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LlmProviderSelector } from './LlmProviderSelector'
import { ApiKeyInput } from './ApiKeyInput'
import type { LlmProvider } from '@/lib/db/schema'

interface SettingsFormProps {
  initialSettings: {
    llmProvider: LlmProvider
    llmApiKeyConfigured: boolean
    openaiApiKeyConfigured: boolean
    anthropicApiKeyConfigured: boolean
    confidenceThreshold: number
    autoLearnEnabled: boolean
  }
  isAdmin: boolean
}

export function SettingsForm({ initialSettings, isAdmin }: SettingsFormProps) {
  const [provider, setProvider] = useState<LlmProvider>(initialSettings.llmProvider)
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { llmProvider: provider }
      if (openaiKey) body.openaiApiKey = openaiKey
      if (anthropicKey) body.anthropicApiKey = anthropicKey

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      toast.success('LLM settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card data-testid="settings-form">
      <CardHeader>
        <CardTitle>LLM Provider Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="llm-provider">Active Provider</Label>
          <LlmProviderSelector
            value={provider}
            onChange={setProvider}
            disabled={!isAdmin || saving}
          />
          <p className="text-xs text-muted-foreground">The provider used for RFP processing.</p>
        </div>

        <div className="space-y-2">
          <Label>Anthropic API Key</Label>
          <ApiKeyInput
            isConfigured={initialSettings.anthropicApiKeyConfigured}
            onChange={setAnthropicKey}
            disabled={!isAdmin || saving}
          />
        </div>

        <div className="space-y-2">
          <Label>OpenAI API Key</Label>
          <ApiKeyInput
            isConfigured={initialSettings.openaiApiKeyConfigured}
            onChange={setOpenaiKey}
            disabled={!isAdmin || saving}
          />
          <p className="text-xs text-muted-foreground">Required for knowledge base embeddings.</p>
        </div>

        {!isAdmin && (
          <p className="text-xs text-muted-foreground">Only admins can update these settings.</p>
        )}

        {isAdmin && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
