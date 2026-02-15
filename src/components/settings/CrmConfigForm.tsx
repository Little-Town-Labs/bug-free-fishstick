'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
interface CrmConfigFormProps {
  crmType: 'hubspot' | 'salesforce'
  accessToken?: string
  instanceUrl?: string
  onSave: (credentials: Record<string, string>) => Promise<void>
  onDisconnect: () => Promise<void>
  onCancel: () => void
  isConnected: boolean
}

export function CrmConfigForm({
  crmType,
  accessToken: initialToken = '',
  instanceUrl: initialInstanceUrl = '',
  onSave,
  onDisconnect,
  onCancel,
  isConnected,
}: CrmConfigFormProps) {
  const [accessToken, setAccessToken] = useState(initialToken)
  const [instanceUrl, setInstanceUrl] = useState(initialInstanceUrl)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const isSalesforce = crmType === 'salesforce'
  const displayName = crmType === 'hubspot' ? 'HubSpot' : 'Salesforce'

  const handleSave = async () => {
    if (!accessToken.trim()) {
      setError('Access token is required')
      return
    }
    if (isSalesforce && !instanceUrl.trim()) {
      setError('Instance URL is required for Salesforce')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const credentials: Record<string, string> = { accessToken: accessToken.trim() }
      if (isSalesforce) credentials.instanceUrl = instanceUrl.trim()
      await onSave(credentials)
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
      const res = await fetch(`/api/settings/integrations/${crmType}/test`, { method: 'POST' })
      const data = await res.json() as { success: boolean; message: string }
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: 'Failed to test connection' })
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${crmType}-access-token`} className="block text-sm font-medium">
          {displayName} Access Token
        </label>
        <input
          id={`${crmType}-access-token`}
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Enter access token"
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          autoComplete="off"
        />
      </div>

      {isSalesforce && (
        <div>
          <label htmlFor="salesforce-instance-url" className="block text-sm font-medium">
            Salesforce Instance URL
          </label>
          <input
            id="salesforce-instance-url"
            type="url"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            placeholder="https://yourinstance.salesforce.com"
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {testResult && (
        <p role="status" className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.message}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing…' : 'Test Connection'}
        </Button>
        {isConnected && (
          <Button
            type="button"
            variant="outline"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
