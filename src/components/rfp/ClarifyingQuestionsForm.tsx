'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ClarifyingQuestion, ProposalDraft } from '@/lib/db/schema/proposal-drafts'

interface ClarifyingQuestionsFormProps {
  rfpId: string
  draftId: string
  questions: ClarifyingQuestion[]
  onSubmitted: (draft: ProposalDraft) => void
}

export function ClarifyingQuestionsForm({
  rfpId,
  draftId,
  questions,
  onSubmitted,
}: ClarifyingQuestionsFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const answersArray = questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id]?.trim() || null,
      }))

      const res = await fetch(`/api/rfps/${rfpId}/proposals/${draftId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to submit answers')
      }

      const data = await res.json()
      onSubmitted(data.draft)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit answers')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      data-testid="clarifying-questions-form"
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <p className="text-sm text-muted-foreground">
        Answer the questions below to help generate a tailored proposal. You may leave any question
        blank to skip it.
      </p>

      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <div className="flex items-start gap-2">
            <span
              id={`q-${q.id}-section`}
              aria-label={`Section: ${q.rfpSection}`}
              className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              {q.rfpSection}
            </span>
          </div>
          <label
            htmlFor={`q-${q.id}`}
            className="block text-sm font-medium text-foreground"
          >
            {q.question}
          </label>
          <Textarea
            id={`q-${q.id}`}
            aria-describedby={`q-${q.id}-section`}
            value={answers[q.id] ?? ''}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
            }
            placeholder="Your answer (optional — leave blank to skip)"
            rows={3}
          />
        </div>
      ))}

      <Button
        type="submit"
        disabled={submitting}
        aria-label="Submit answers and generate proposal"
      >
        {submitting ? 'Submitting…' : 'Generate Proposal'}
      </Button>
    </form>
  )
}
