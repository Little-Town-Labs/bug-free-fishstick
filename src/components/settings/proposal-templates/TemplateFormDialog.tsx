'use client'

import { useId, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TriggerTagInput } from './TriggerTagInput'
import type { ProposalTemplate, ProposalTemplateSection } from '@/lib/db/schema/proposal-templates'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateFormData {
  title: string
  content: string
  isRequired: boolean
  evaluateCoverage: boolean
  triggerRfpTypes: string[] | null
  triggerIndustryTags: string[] | null
}

interface TemplateFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  section: ProposalTemplateSection | null
  initialValues: Partial<ProposalTemplate> | null
  isSaving: boolean
  onSave: (data: TemplateFormData) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateFormDialog({
  open,
  mode,
  section: _section,
  initialValues,
  isSaving,
  onSave,
  onClose,
}: TemplateFormDialogProps) {
  const titleId = useId()
  const contentId = useId()

  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [content, setContent] = useState(initialValues?.content ?? '')
  const [isRequired, setIsRequired] = useState(initialValues?.isRequired ?? false)
  const [evaluateCoverage, setEvaluateCoverage] = useState(
    initialValues?.evaluateCoverage ?? false
  )
  const [triggerRfpTypes, setTriggerRfpTypes] = useState<string[] | null>(
    initialValues?.triggerRfpTypes ?? null
  )
  const [triggerIndustryTags, setTriggerIndustryTags] = useState<string[] | null>(
    initialValues?.triggerIndustryTags ?? null
  )

  // Re-initialise form whenever initialValues changes (e.g. dialog re-opened for a
  // different template).
  useEffect(() => {
    setTitle(initialValues?.title ?? '')
    setContent(initialValues?.content ?? '')
    setIsRequired(initialValues?.isRequired ?? false)
    setEvaluateCoverage(initialValues?.evaluateCoverage ?? false)
    setTriggerRfpTypes(initialValues?.triggerRfpTypes ?? null)
    setTriggerIndustryTags(initialValues?.triggerIndustryTags ?? null)
  }, [initialValues])

  function handleRequiredToggle() {
    const next = !isRequired
    setIsRequired(next)
    if (next) setEvaluateCoverage(false)
  }

  function handleEvaluateCoverageToggle() {
    if (!isRequired) setEvaluateCoverage((prev) => !prev)
  }

  function handleSave() {
    if (!title.trim() || !content.trim()) return
    onSave({ title, content, isRequired, evaluateCoverage, triggerRfpTypes, triggerIndustryTags })
  }

  const dialogTitle = mode === 'edit' ? 'Edit Template' : 'Add Template'

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1">
            <Label htmlFor={contentId}>Content</Label>
            <Textarea
              id={contentId}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSaving}
              rows={6}
            />
          </div>

          {/* isRequired toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-label="Required"
              aria-checked={isRequired}
              onClick={handleRequiredToggle}
              disabled={isSaving}
              className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
              data-state={isRequired ? 'checked' : 'unchecked'}
            >
              <span
                className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
                data-state={isRequired ? 'checked' : 'unchecked'}
              />
            </button>
            <span className="text-sm font-medium">Required</span>
          </div>

          {/* evaluateCoverage toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-label="Evaluate Coverage"
              aria-checked={evaluateCoverage}
              onClick={handleEvaluateCoverageToggle}
              disabled={isRequired || isSaving}
              className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
              data-state={evaluateCoverage ? 'checked' : 'unchecked'}
            >
              <span
                className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
                data-state={evaluateCoverage ? 'checked' : 'unchecked'}
              />
            </button>
            <span className="text-sm font-medium">Evaluate Coverage</span>
          </div>

          {/* Trigger RFP types */}
          <div className="flex flex-col gap-1">
            <Label>Trigger RFP Types</Label>
            <TriggerTagInput
              value={triggerRfpTypes}
              onChange={setTriggerRfpTypes}
              disabled={isSaving}
              placeholder="Add RFP type and press Enter…"
            />
          </div>

          {/* Trigger industry tags */}
          <div className="flex flex-col gap-1">
            <Label>Trigger Industry Tags</Label>
            <TriggerTagInput
              value={triggerIndustryTags}
              onChange={setTriggerIndustryTags}
              disabled={isSaving}
              placeholder="Add industry tag and press Enter…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
