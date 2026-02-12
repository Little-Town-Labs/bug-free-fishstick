'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LearningEntry } from './LearningEntry'
import { ManualLearningForm } from './ManualLearningForm'
import type { Learning } from '@/lib/db/schema'

interface LearningsPanelProps {
  customerId?: string
}

export function LearningsPanel({ customerId }: LearningsPanelProps) {
  const [learningsList, setLearningsList] = useState<Learning[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLearnings = useCallback(async () => {
    setLoading(true)
    try {
      const url = customerId
        ? `/api/learnings?customerId=${customerId}`
        : '/api/learnings'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json() as { learnings: Learning[] }
        setLearningsList(data.learnings)
      }
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void fetchLearnings()
  }, [fetchLearnings])

  return (
    <Card data-testid="learnings-panel">
      <CardHeader>
        <CardTitle>Learnings & Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ManualLearningForm customerId={customerId} onSaved={fetchLearnings} />
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : learningsList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No learnings yet.</p>
        ) : (
          <div className="space-y-2">
            {learningsList.map((l) => (
              <LearningEntry key={l.id} learning={l} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
