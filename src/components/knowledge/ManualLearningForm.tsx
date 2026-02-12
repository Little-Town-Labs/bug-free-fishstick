'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface ManualLearningFormProps {
  customerId?: string
  onSaved?: () => void
}

export function ManualLearningForm({ customerId, onSaved }: ManualLearningFormProps) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), customerId }),
      })
      if (!res.ok) throw new Error('Failed to save learning')
      setContent('')
      toast.success('Learning saved')
      onSaved?.()
    } catch {
      toast.error('Failed to save learning')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form data-testid="manual-learning-form" onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="learning-content">Add a learning or insight</Label>
        <Textarea
          id="learning-content"
          placeholder="Enter insight about this customer or domain..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={saving}
          rows={3}
        />
      </div>
      <Button type="submit" disabled={saving || !content.trim()} size="sm">
        {saving ? 'Saving...' : 'Save Learning'}
      </Button>
    </form>
  )
}
