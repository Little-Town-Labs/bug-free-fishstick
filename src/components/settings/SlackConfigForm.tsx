'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface SlackConfigFormProps {
  webhookUrl?: string
  notifyOnStatus?: string[]
  onSave: (data: { webhookUrl: string; notifyOnStatus: string[] }) => Promise<void>
  onCancel: () => void
}

const STATUS_OPTIONS = [
  { value: 'rfp_assigned', label: 'RFP Assigned' },
  { value: 'rfp_approved', label: 'RFP Approved' },
  { value: 'rfp_returned', label: 'RFP Returned' },
  { value: 'rfp_won', label: 'RFP Won' },
  { value: 'rfp_lost', label: 'RFP Lost' },
]

export function SlackConfigForm({ webhookUrl: initialUrl = '', notifyOnStatus: initialStatus = [], onSave, onCancel }: SlackConfigFormProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialUrl)
  const [notifyOnStatus, setNotifyOnStatus] = useState<string[]>(initialStatus)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const toggleStatus = (value: string) => {
    setNotifyOnStatus((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

  const handleSave = async () => {
    if (!webhookUrl.trim()) {
      setError('Webhook URL is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ webhookUrl: webhookUrl.trim(), notifyOnStatus })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/integrations/slack/test', { method: 'POST' })
      const data = await res.json() as { success: boolean; message: string }
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: 'Failed to send test message' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="slack-webhook-url" className="block text-sm font-medium">
          Slack Webhook URL
        </label>
        <input
          id="slack-webhook-url"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          aria-describedby="slack-webhook-help"
        />
        <p id="slack-webhook-help" className="mt-1 text-xs text-muted-foreground">
          Create an Incoming Webhook in your Slack app settings.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Notify on events</legend>
        <div className="mt-2 space-y-2">
          {STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyOnStatus.includes(opt.value)}
                onChange={() => toggleStatus(opt.value)}
                className="rounded"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {testResult && (
        <p role="status" className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? 'Sending…' : 'Send Test Message'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
