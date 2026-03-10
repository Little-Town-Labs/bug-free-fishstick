/**
 * TDD Red-Phase Unit Tests — templateLibrary.reducer
 *
 * The reducer file does NOT exist yet. All tests are expected to FAIL
 * until `src/components/settings/proposal-templates/templateLibrary.reducer.ts`
 * is created and implemented.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  libraryReducer,
  initialLibraryState,
} from '@/components/settings/proposal-templates/templateLibrary.reducer'
import type {
  LibraryState,
  LibraryAction,
} from '@/components/settings/proposal-templates/templateLibrary.reducer'
import type {
  ProposalTemplate,
  ProposalTemplateSection,
} from '@/lib/db/schema/proposal-templates'

vi.mock('@/lib/db/schema/proposal-templates', () => ({
  proposalTemplateSections: [
    'assumptions',
    'exclusions',
    'payment_terms',
    'change_management',
    'ip_ownership',
    'liability',
    'force_majeure',
    'warranty',
  ],
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const template1: ProposalTemplate = {
  id: 'id-1',
  organizationId: 'org_1',
  section: 'assumptions',
  title: 'Template 1',
  content: 'Content 1',
  isRequired: false,
  triggerRfpTypes: null,
  triggerIndustryTags: null,
  evaluateCoverage: false,
  sortOrder: 0,
  createdBy: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const template2: ProposalTemplate = {
  ...template1,
  id: 'id-2',
  title: 'Template 2',
  sortOrder: 1,
}

const template3: ProposalTemplate = {
  ...template1,
  id: 'id-3',
  title: 'Template 3',
  section: 'exclusions',
  sortOrder: 0,
}

// ---------------------------------------------------------------------------
// Helper: produce a clean state with known templates
// ---------------------------------------------------------------------------

function stateWith(templates: ProposalTemplate[]): LibraryState {
  return { ...initialLibraryState, templates }
}

// ---------------------------------------------------------------------------
// initialLibraryState shape
// ---------------------------------------------------------------------------

describe('initialLibraryState', () => {
  it('has correct initial templates (empty array)', () => {
    expect(initialLibraryState.templates).toEqual([])
  })

  it('has status "idle"', () => {
    expect(initialLibraryState.status).toBe('idle')
  })

  it('has error null', () => {
    expect(initialLibraryState.error).toBeNull()
  })

  it('has dialog closed with correct defaults', () => {
    expect(initialLibraryState.dialog).toMatchObject({
      open: false,
      mode: 'create',
      section: null,
      initialValues: null,
      isSaving: false,
    })
  })

  it('has deleteConfirm closed with correct defaults', () => {
    expect(initialLibraryState.deleteConfirm).toMatchObject({
      open: false,
      target: null,
      isDeleting: false,
    })
  })
})

// ---------------------------------------------------------------------------
// FETCH_START
// ---------------------------------------------------------------------------

describe('FETCH_START', () => {
  it('sets status to "loading"', () => {
    const next = libraryReducer(initialLibraryState, { type: 'FETCH_START' })
    expect(next.status).toBe('loading')
  })

  it('does not change the templates array', () => {
    const state = stateWith([template1])
    const next = libraryReducer(state, { type: 'FETCH_START' })
    expect(next.templates).toEqual([template1])
  })
})

// ---------------------------------------------------------------------------
// FETCH_SUCCESS
// ---------------------------------------------------------------------------

describe('FETCH_SUCCESS', () => {
  const action: LibraryAction = {
    type: 'FETCH_SUCCESS',
    templates: [template1, template2],
  }

  it('sets status to "idle"', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.status).toBe('idle')
  })

  it('sets templates to the provided array', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.templates).toEqual([template1, template2])
  })

  it('clears error to null', () => {
    const state: LibraryState = { ...initialLibraryState, status: 'error', error: 'previous error' }
    const next = libraryReducer(state, action)
    expect(next.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FETCH_ERROR
// ---------------------------------------------------------------------------

describe('FETCH_ERROR', () => {
  const action: LibraryAction = { type: 'FETCH_ERROR', error: 'Network failure' }

  it('sets status to "error"', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.status).toBe('error')
  })

  it('sets error to the provided message', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.error).toBe('Network failure')
  })

  it('does not change templates', () => {
    const state = stateWith([template1])
    const next = libraryReducer(state, action)
    expect(next.templates).toEqual([template1])
  })
})

// ---------------------------------------------------------------------------
// OPEN_CREATE
// ---------------------------------------------------------------------------

describe('OPEN_CREATE', () => {
  const section: ProposalTemplateSection = 'payment_terms'
  const action: LibraryAction = { type: 'OPEN_CREATE', section }

  it('sets dialog.open to true', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.open).toBe(true)
  })

  it('sets dialog.mode to "create"', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.mode).toBe('create')
  })

  it('sets dialog.section to the provided section', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.section).toBe('payment_terms')
  })

  it('sets dialog.initialValues to null', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.initialValues).toBeNull()
  })

  it('sets dialog.isSaving to false', () => {
    const state: LibraryState = {
      ...initialLibraryState,
      dialog: { ...initialLibraryState.dialog, isSaving: true },
    }
    const next = libraryReducer(state, action)
    expect(next.dialog.isSaving).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// OPEN_EDIT
// ---------------------------------------------------------------------------

describe('OPEN_EDIT', () => {
  const action: LibraryAction = { type: 'OPEN_EDIT', template: template1 }

  it('sets dialog.open to true', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.open).toBe(true)
  })

  it('sets dialog.mode to "edit"', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.mode).toBe('edit')
  })

  it('sets dialog.initialValues to the provided template', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.initialValues).toEqual(template1)
  })

  it('sets dialog.section to the template section', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.dialog.section).toBe('assumptions')
  })

  it('sets dialog.isSaving to false', () => {
    const state: LibraryState = {
      ...initialLibraryState,
      dialog: { ...initialLibraryState.dialog, isSaving: true },
    }
    const next = libraryReducer(state, action)
    expect(next.dialog.isSaving).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CLOSE_DIALOG
// ---------------------------------------------------------------------------

describe('CLOSE_DIALOG', () => {
  const openState: LibraryState = {
    ...initialLibraryState,
    dialog: {
      open: true,
      mode: 'edit',
      section: 'assumptions',
      initialValues: template1,
      isSaving: true,
      saveError: null,
    },
  }

  it('sets dialog.open to false', () => {
    const next = libraryReducer(openState, { type: 'CLOSE_DIALOG' })
    expect(next.dialog.open).toBe(false)
  })

  it('resets dialog.isSaving to false', () => {
    const next = libraryReducer(openState, { type: 'CLOSE_DIALOG' })
    expect(next.dialog.isSaving).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SAVE_START
// ---------------------------------------------------------------------------

describe('SAVE_START', () => {
  it('sets dialog.isSaving to true', () => {
    const next = libraryReducer(initialLibraryState, { type: 'SAVE_START' })
    expect(next.dialog.isSaving).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SAVE_SUCCESS — create mode
// ---------------------------------------------------------------------------

describe('SAVE_SUCCESS (create mode)', () => {
  const newTemplate: ProposalTemplate = {
    ...template1,
    id: 'id-new',
    title: 'Brand New Template',
  }

  const state: LibraryState = {
    ...stateWith([template1, template2]),
    dialog: {
      open: true,
      mode: 'create',
      section: 'assumptions',
      initialValues: null,
      isSaving: true,
      saveError: null,
    },
  }

  const action: LibraryAction = { type: 'SAVE_SUCCESS', template: newTemplate }

  it('closes the dialog', () => {
    const next = libraryReducer(state, action)
    expect(next.dialog.open).toBe(false)
  })

  it('appends the new template to the templates array', () => {
    const next = libraryReducer(state, action)
    expect(next.templates).toContainEqual(newTemplate)
  })

  it('does not remove existing templates', () => {
    const next = libraryReducer(state, action)
    expect(next.templates).toContainEqual(template1)
    expect(next.templates).toContainEqual(template2)
  })

  it('increases templates length by 1', () => {
    const next = libraryReducer(state, action)
    expect(next.templates).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// SAVE_SUCCESS — edit mode
// ---------------------------------------------------------------------------

describe('SAVE_SUCCESS (edit mode)', () => {
  const updatedTemplate: ProposalTemplate = {
    ...template1,
    title: 'Updated Title',
  }

  const state: LibraryState = {
    ...stateWith([template1, template2]),
    dialog: {
      open: true,
      mode: 'edit',
      section: 'assumptions',
      initialValues: template1,
      isSaving: true,
      saveError: null,
    },
  }

  const action: LibraryAction = { type: 'SAVE_SUCCESS', template: updatedTemplate }

  it('closes the dialog', () => {
    const next = libraryReducer(state, action)
    expect(next.dialog.open).toBe(false)
  })

  it('replaces the existing template in the list', () => {
    const next = libraryReducer(state, action)
    const found = next.templates.find((t) => t.id === 'id-1')
    expect(found?.title).toBe('Updated Title')
  })

  it('keeps the list length the same', () => {
    const next = libraryReducer(state, action)
    expect(next.templates).toHaveLength(2)
  })

  it('does not affect other templates', () => {
    const next = libraryReducer(state, action)
    expect(next.templates).toContainEqual(template2)
  })
})

// ---------------------------------------------------------------------------
// SAVE_ERROR
// ---------------------------------------------------------------------------

describe('SAVE_ERROR', () => {
  const state: LibraryState = {
    ...initialLibraryState,
    dialog: {
      open: true,
      mode: 'create',
      section: 'assumptions',
      initialValues: null,
      isSaving: true,
      saveError: null,
    },
  }

  const action: LibraryAction = { type: 'SAVE_ERROR', error: 'Save failed' }

  it('keeps dialog.open true', () => {
    const next = libraryReducer(state, action)
    expect(next.dialog.open).toBe(true)
  })

  it('sets dialog.isSaving to false', () => {
    const next = libraryReducer(state, action)
    expect(next.dialog.isSaving).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// OPEN_DELETE
// ---------------------------------------------------------------------------

describe('OPEN_DELETE', () => {
  const action: LibraryAction = { type: 'OPEN_DELETE', template: template1 }

  it('sets deleteConfirm.open to true', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.deleteConfirm.open).toBe(true)
  })

  it('sets deleteConfirm.target to the provided template', () => {
    const next = libraryReducer(initialLibraryState, action)
    expect(next.deleteConfirm.target).toEqual(template1)
  })

  it('sets deleteConfirm.isDeleting to false', () => {
    const state: LibraryState = {
      ...initialLibraryState,
      deleteConfirm: { open: false, target: null, isDeleting: true },
    }
    const next = libraryReducer(state, action)
    expect(next.deleteConfirm.isDeleting).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CLOSE_DELETE
// ---------------------------------------------------------------------------

describe('CLOSE_DELETE', () => {
  const state: LibraryState = {
    ...initialLibraryState,
    deleteConfirm: { open: true, target: template1, isDeleting: false },
  }

  it('sets deleteConfirm.open to false', () => {
    const next = libraryReducer(state, { type: 'CLOSE_DELETE' })
    expect(next.deleteConfirm.open).toBe(false)
  })

  it('resets deleteConfirm.target to null', () => {
    const next = libraryReducer(state, { type: 'CLOSE_DELETE' })
    expect(next.deleteConfirm.target).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// DELETE_START
// ---------------------------------------------------------------------------

describe('DELETE_START', () => {
  it('sets deleteConfirm.isDeleting to true', () => {
    const next = libraryReducer(initialLibraryState, { type: 'DELETE_START' })
    expect(next.deleteConfirm.isDeleting).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE_SUCCESS
// ---------------------------------------------------------------------------

describe('DELETE_SUCCESS', () => {
  const state: LibraryState = {
    ...stateWith([template1, template2, template3]),
    deleteConfirm: { open: true, target: template1, isDeleting: true },
  }

  const action: LibraryAction = { type: 'DELETE_SUCCESS', templateId: 'id-1' }

  it('removes the template with matching id from templates', () => {
    const next = libraryReducer(state, action)
    expect(next.templates.find((t) => t.id === 'id-1')).toBeUndefined()
  })

  it('does not remove other templates', () => {
    const next = libraryReducer(state, action)
    expect(next.templates).toContainEqual(template2)
    expect(next.templates).toContainEqual(template3)
  })

  it('sets deleteConfirm.open to false', () => {
    const next = libraryReducer(state, action)
    expect(next.deleteConfirm.open).toBe(false)
  })

  it('sets deleteConfirm.target to null', () => {
    const next = libraryReducer(state, action)
    expect(next.deleteConfirm.target).toBeNull()
  })

  it('sets deleteConfirm.isDeleting to false', () => {
    const next = libraryReducer(state, action)
    expect(next.deleteConfirm.isDeleting).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DELETE_ERROR
// ---------------------------------------------------------------------------

describe('DELETE_ERROR', () => {
  const state: LibraryState = {
    ...initialLibraryState,
    deleteConfirm: { open: true, target: template1, isDeleting: true },
  }

  const action: LibraryAction = { type: 'DELETE_ERROR', error: 'Delete failed' }

  it('sets deleteConfirm.isDeleting to false', () => {
    const next = libraryReducer(state, action)
    expect(next.deleteConfirm.isDeleting).toBe(false)
  })

  it('keeps deleteConfirm.open true', () => {
    const next = libraryReducer(state, action)
    expect(next.deleteConfirm.open).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// MOVE_UP
// ---------------------------------------------------------------------------

describe('MOVE_UP', () => {
  // template1 (sortOrder=0, section=assumptions)
  // template2 (sortOrder=1, section=assumptions)
  // template3 (sortOrder=0, section=exclusions)
  const state = stateWith([template1, template2, template3])

  it('decrements sortOrder of target and increments previous sibling in same section', () => {
    // Moving template2 (sortOrder=1) up should give it sortOrder=0
    // and give template1 (sortOrder=0) sortOrder=1
    const next = libraryReducer(state, { type: 'MOVE_UP', templateId: 'id-2' })
    const updated2 = next.templates.find((t) => t.id === 'id-2')
    const updated1 = next.templates.find((t) => t.id === 'id-1')
    expect(updated2?.sortOrder).toBe(0)
    expect(updated1?.sortOrder).toBe(1)
  })

  it('does nothing when target is already first in its section', () => {
    // template1 has sortOrder=0 — already first in 'assumptions'
    const next = libraryReducer(state, { type: 'MOVE_UP', templateId: 'id-1' })
    const unchanged = next.templates.find((t) => t.id === 'id-1')
    expect(unchanged?.sortOrder).toBe(0)
    // templates array should be effectively equivalent
    expect(next.templates).toEqual(state.templates)
  })

  it('does not affect templates in other sections', () => {
    const next = libraryReducer(state, { type: 'MOVE_UP', templateId: 'id-2' })
    const unaffected = next.templates.find((t) => t.id === 'id-3')
    expect(unaffected?.sortOrder).toBe(0)
    expect(unaffected?.section).toBe('exclusions')
  })

  it('returns a new array (immutable state)', () => {
    const original = stateWith([template1, template2])
    const next = libraryReducer(original, { type: 'MOVE_UP', templateId: 'id-2' })
    expect(next.templates).not.toBe(original.templates)
  })

  it('does not mutate original template objects', () => {
    const originalSortOrder1 = template1.sortOrder
    const originalSortOrder2 = template2.sortOrder
    libraryReducer(state, { type: 'MOVE_UP', templateId: 'id-2' })
    expect(template1.sortOrder).toBe(originalSortOrder1)
    expect(template2.sortOrder).toBe(originalSortOrder2)
  })
})

// ---------------------------------------------------------------------------
// MOVE_DOWN
// ---------------------------------------------------------------------------

describe('MOVE_DOWN', () => {
  // template1 (sortOrder=0, section=assumptions)
  // template2 (sortOrder=1, section=assumptions)
  // template3 (sortOrder=0, section=exclusions)
  const state = stateWith([template1, template2, template3])

  it('increments sortOrder of target and decrements next sibling in same section', () => {
    // Moving template1 (sortOrder=0) down should give it sortOrder=1
    // and give template2 (sortOrder=1) sortOrder=0
    const next = libraryReducer(state, { type: 'MOVE_DOWN', templateId: 'id-1' })
    const updated1 = next.templates.find((t) => t.id === 'id-1')
    const updated2 = next.templates.find((t) => t.id === 'id-2')
    expect(updated1?.sortOrder).toBe(1)
    expect(updated2?.sortOrder).toBe(0)
  })

  it('does nothing when target is already last in its section', () => {
    // template2 has sortOrder=1 — already last in 'assumptions'
    const next = libraryReducer(state, { type: 'MOVE_DOWN', templateId: 'id-2' })
    const unchanged = next.templates.find((t) => t.id === 'id-2')
    expect(unchanged?.sortOrder).toBe(1)
    expect(next.templates).toEqual(state.templates)
  })

  it('does not affect templates in other sections', () => {
    const next = libraryReducer(state, { type: 'MOVE_DOWN', templateId: 'id-1' })
    const unaffected = next.templates.find((t) => t.id === 'id-3')
    expect(unaffected?.sortOrder).toBe(0)
    expect(unaffected?.section).toBe('exclusions')
  })

  it('returns a new array (immutable state)', () => {
    const original = stateWith([template1, template2])
    const next = libraryReducer(original, { type: 'MOVE_DOWN', templateId: 'id-1' })
    expect(next.templates).not.toBe(original.templates)
  })

  it('does not mutate original template objects', () => {
    const originalSortOrder1 = template1.sortOrder
    const originalSortOrder2 = template2.sortOrder
    libraryReducer(state, { type: 'MOVE_DOWN', templateId: 'id-1' })
    expect(template1.sortOrder).toBe(originalSortOrder1)
    expect(template2.sortOrder).toBe(originalSortOrder2)
  })
})

// ---------------------------------------------------------------------------
// MOVE_UP / MOVE_DOWN — single-item section edge cases
// ---------------------------------------------------------------------------

describe('MOVE_UP / MOVE_DOWN — single-item section', () => {
  // Only template3 in 'exclusions' — it's both first and last
  const state = stateWith([template1, template2, template3])

  it('MOVE_UP on only item in section does nothing', () => {
    const next = libraryReducer(state, { type: 'MOVE_UP', templateId: 'id-3' })
    const unchanged = next.templates.find((t) => t.id === 'id-3')
    expect(unchanged?.sortOrder).toBe(0)
  })

  it('MOVE_DOWN on only item in section does nothing', () => {
    const next = libraryReducer(state, { type: 'MOVE_DOWN', templateId: 'id-3' })
    const unchanged = next.templates.find((t) => t.id === 'id-3')
    expect(unchanged?.sortOrder).toBe(0)
  })
})
