'use client'

import { useReducer, useEffect, useRef } from 'react'
import { libraryReducer, initialLibraryState } from './templateLibrary.reducer'
import { TemplateSectionGroup } from './TemplateSectionGroup'
import { TemplateFormDialog } from './TemplateFormDialog'
import { TemplateDeleteConfirm } from './TemplateDeleteConfirm'
import { proposalTemplateSections } from '@/lib/db/schema/proposal-templates'
import type { ProposalTemplate, ProposalTemplateSection } from '@/lib/db/schema/proposal-templates'
import type { TemplateFormData } from './TemplateFormDialog'

// ---------------------------------------------------------------------------
// Section display labels
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<ProposalTemplateSection, string> = {
  assumptions: 'Assumptions',
  exclusions: 'Exclusions',
  payment_terms: 'Payment Terms',
  change_management: 'Change Management',
  ip_ownership: 'IP Ownership',
  liability: 'Liability',
  force_majeure: 'Force Majeure',
  warranty: 'Warranty',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProposalTemplateLibraryProps {
  isAdmin: boolean
}

export function ProposalTemplateLibrary({ isAdmin }: ProposalTemplateLibraryProps) {
  const [state, dispatch] = useReducer(libraryReducer, initialLibraryState)
  // Track whether a MOVE_UP/MOVE_DOWN was dispatched so we know to persist
  // after the state update is committed to `state.templates`.
  const pendingReorderRef = useRef(false)

  // Initial fetch
  useEffect(() => {
    dispatch({ type: 'FETCH_START' })
    fetch('/api/settings/proposal-templates')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ templates: ProposalTemplate[] }>
      })
      .then(({ templates }) => dispatch({ type: 'FETCH_SUCCESS', templates }))
      .catch(() => dispatch({ type: 'FETCH_ERROR', error: 'Failed to load templates' }))
  }, [])

  // Persist reorder after state update is committed — avoids the stale-closure
  // bug that occurs when reading state.templates inside an async callback that
  // fires before the dispatch has been applied.
  useEffect(() => {
    if (!pendingReorderRef.current) return
    pendingReorderRef.current = false
    void persistReorder(state.templates)
  }, [state.templates])  

  // Persist reorder optimistically (fire-and-forget)
  async function persistReorder(templates: ProposalTemplate[]) {
    const items = templates.map((t) => ({ id: t.id, sortOrder: t.sortOrder }))
    await fetch('/api/settings/proposal-templates/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }).catch(() => {
      // reorder failure is non-critical — UI already shows updated order
    })
  }

  async function handleSave(data: TemplateFormData) {
    dispatch({ type: 'SAVE_START' })

    const { mode, section, initialValues } = state.dialog
    const isEdit = mode === 'edit' && Boolean(initialValues?.id)

    try {
      const url = isEdit
        ? `/api/settings/proposal-templates/${initialValues!.id}`
        : '/api/settings/proposal-templates'

      const body = isEdit ? data : { ...data, section }

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const json = await res.json() as { template: ProposalTemplate }
        dispatch({ type: 'SAVE_SUCCESS', template: json.template })
      } else {
        const json = await res.json() as { error?: string }
        dispatch({ type: 'SAVE_ERROR', error: json.error ?? 'Save failed' })
      }
    } catch {
      dispatch({ type: 'SAVE_ERROR', error: 'Network error' })
    }
  }

  async function handleDelete() {
    const target = state.deleteConfirm.target
    if (!target) return

    dispatch({ type: 'DELETE_START' })

    try {
      const res = await fetch(`/api/settings/proposal-templates/${target.id}`, {
        method: 'DELETE',
      })

      if (res.ok || res.status === 204) {
        dispatch({ type: 'DELETE_SUCCESS', templateId: target.id })
      } else {
        dispatch({ type: 'DELETE_ERROR', error: 'Delete failed' })
      }
    } catch {
      dispatch({ type: 'DELETE_ERROR', error: 'Network error' })
    }
  }

  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="Loading templates" className="py-8 text-center">
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm text-destructive">{state.error}</p>
      </div>
    )
  }

  return (
    <div>
      {proposalTemplateSections.map((section) => {
        const sectionTemplates = state.templates
          .filter((t) => t.section === section)
          .sort((a, b) => a.sortOrder - b.sortOrder)

        return (
          <TemplateSectionGroup
            key={section}
            section={section}
            label={SECTION_LABELS[section]}
            templates={sectionTemplates}
            isAdmin={isAdmin}
            onAdd={() => dispatch({ type: 'OPEN_CREATE', section })}
            onEdit={(template) => dispatch({ type: 'OPEN_EDIT', template })}
            onDelete={(template) => dispatch({ type: 'OPEN_DELETE', template })}
            onMoveUp={(templateId) => {
              dispatch({ type: 'MOVE_UP', templateId })
              pendingReorderRef.current = true
            }}
            onMoveDown={(templateId) => {
              dispatch({ type: 'MOVE_DOWN', templateId })
              pendingReorderRef.current = true
            }}
          />
        )
      })}

      <TemplateFormDialog
        open={state.dialog.open}
        mode={state.dialog.mode}
        section={state.dialog.section}
        initialValues={state.dialog.initialValues}
        isSaving={state.dialog.isSaving}
        error={state.dialog.saveError}
        onSave={handleSave}
        onClose={() => dispatch({ type: 'CLOSE_DIALOG' })}
      />

      <TemplateDeleteConfirm
        open={state.deleteConfirm.open}
        target={state.deleteConfirm.target}
        isDeleting={state.deleteConfirm.isDeleting}
        onConfirm={handleDelete}
        onCancel={() => dispatch({ type: 'CLOSE_DELETE' })}
      />
    </div>
  )
}
