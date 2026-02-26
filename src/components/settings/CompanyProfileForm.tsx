'use client'

import { useState, useEffect, useId } from 'react'
import ReactMarkdown from 'react-markdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CompanyProfileFormProps {
  isAdmin: boolean
}

export function CompanyProfileForm({ isAdmin }: CompanyProfileFormProps) {
  const counterId = useId()

  const [profile, setProfile] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/company-profile')
      .then((r) => r.json())
      .then((data: { companyProfile: string | null }) => {
        setProfile(data.companyProfile ?? '')
      })
      .catch(() => {
        setError('Failed to load company profile.')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (profile.length > 10000) {
      setFieldError('Company profile must be 10,000 characters or fewer.')
      return
    }

    setError(null)
    setFieldError(null)
    setSaving(true)
    setSaveSuccess(false)

    try {
      const res = await fetch('/api/settings/company-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyProfile: profile || null }),
      })

      const body = await res.json()

      if (res.status === 422 && body.details) {
        const firstDetail = body.details[0]
        setFieldError(firstDetail?.message ?? 'Validation error.')
      } else if (!res.ok) {
        setError(body.error ?? 'An error occurred. Please try again.')
      } else {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin && (
          <p className="text-sm text-muted-foreground">
            Only admins can edit the company profile. You are viewing in read-only mode.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {/* Editor — 60% */}
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="company-profile-textarea">Profile (Markdown supported)</Label>
            <Textarea
              id="company-profile-textarea"
              value={profile}
              onChange={(e) => {
                setProfile(e.target.value)
                setFieldError(null)
              }}
              disabled={!isAdmin}
              aria-describedby={counterId}
              placeholder="Describe your company…"
              rows={16}
              className="resize-none font-mono text-sm"
            />
            <p id={counterId} className="text-xs text-muted-foreground">
              {profile.length} / 10000
            </p>
            {fieldError && (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            )}
          </div>

          {/* Preview — 40% */}
          <div className="md:col-span-2">
            <Label>Preview</Label>
            <div className="mt-2 min-h-[18rem] rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {profile ? (
                <ReactMarkdown>{profile}</ReactMarkdown>
              ) : (
                <span className="text-muted-foreground">Preview will appear here</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={handleSave}
            disabled={saving || !isAdmin}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>

          {saveSuccess && (
            <p role="status" className="text-sm text-green-600">
              Profile saved successfully.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
