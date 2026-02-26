import type { ProposalTemplate, ProposalTemplateSection } from '@/lib/db/schema/proposal-templates'

export interface LibraryState {
  templates: ProposalTemplate[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
  dialog: {
    open: boolean
    mode: 'create' | 'edit'
    section: ProposalTemplateSection | null
    initialValues: Partial<ProposalTemplate> | null
    isSaving: boolean
  }
  deleteConfirm: {
    open: boolean
    target: ProposalTemplate | null
    isDeleting: boolean
  }
}

export type LibraryAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; templates: ProposalTemplate[] }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'OPEN_CREATE'; section: ProposalTemplateSection }
  | { type: 'OPEN_EDIT'; template: ProposalTemplate }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; template: ProposalTemplate }
  | { type: 'SAVE_ERROR'; error: string }
  | { type: 'OPEN_DELETE'; template: ProposalTemplate }
  | { type: 'CLOSE_DELETE' }
  | { type: 'DELETE_START' }
  | { type: 'DELETE_SUCCESS'; templateId: string }
  | { type: 'DELETE_ERROR'; error: string }
  | { type: 'MOVE_UP'; templateId: string }
  | { type: 'MOVE_DOWN'; templateId: string }

export const initialLibraryState: LibraryState = {
  templates: [],
  status: 'idle',
  error: null,
  dialog: {
    open: false,
    mode: 'create',
    section: null,
    initialValues: null,
    isSaving: false,
  },
  deleteConfirm: {
    open: false,
    target: null,
    isDeleting: false,
  },
}

export function libraryReducer(state: LibraryState, action: LibraryAction): LibraryState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading' }

    case 'FETCH_SUCCESS':
      return { ...state, status: 'idle', templates: action.templates, error: null }

    case 'FETCH_ERROR':
      return { ...state, status: 'error', error: action.error }

    case 'OPEN_CREATE':
      return {
        ...state,
        dialog: {
          open: true,
          mode: 'create',
          section: action.section,
          initialValues: null,
          isSaving: false,
        },
      }

    case 'OPEN_EDIT':
      return {
        ...state,
        dialog: {
          open: true,
          mode: 'edit',
          section: action.template.section,
          initialValues: action.template,
          isSaving: false,
        },
      }

    case 'CLOSE_DIALOG':
      return {
        ...state,
        dialog: { ...state.dialog, open: false, isSaving: false },
      }

    case 'SAVE_START':
      return { ...state, dialog: { ...state.dialog, isSaving: true } }

    case 'SAVE_SUCCESS': {
      const exists = state.templates.some(t => t.id === action.template.id)
      const templates = exists
        ? state.templates.map(t => t.id === action.template.id ? action.template : t)
        : [...state.templates, action.template]
      return {
        ...state,
        templates,
        dialog: { ...state.dialog, open: false, isSaving: false },
      }
    }

    case 'SAVE_ERROR':
      return {
        ...state,
        dialog: { ...state.dialog, isSaving: false },
        error: action.error,
      }

    case 'OPEN_DELETE':
      return {
        ...state,
        deleteConfirm: { open: true, target: action.template, isDeleting: false },
      }

    case 'CLOSE_DELETE':
      return {
        ...state,
        deleteConfirm: { open: false, target: null, isDeleting: false },
      }

    case 'DELETE_START':
      return {
        ...state,
        deleteConfirm: { ...state.deleteConfirm, isDeleting: true },
      }

    case 'DELETE_SUCCESS':
      return {
        ...state,
        templates: state.templates.filter(t => t.id !== action.templateId),
        deleteConfirm: { open: false, target: null, isDeleting: false },
      }

    case 'DELETE_ERROR':
      return {
        ...state,
        deleteConfirm: { ...state.deleteConfirm, isDeleting: false },
      }

    case 'MOVE_UP': {
      const targetTemplate = state.templates.find(t => t.id === action.templateId)
      if (!targetTemplate) return state

      const sectionTemplates = state.templates
        .filter(t => t.section === targetTemplate.section)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const idx = sectionTemplates.findIndex(t => t.id === action.templateId)
      if (idx <= 0) return state

      const current = sectionTemplates[idx]!
      const previous = sectionTemplates[idx - 1]!

      const newTemplates = state.templates.map(t => {
        if (t.id === current.id) return { ...t, sortOrder: previous.sortOrder }
        if (t.id === previous.id) return { ...t, sortOrder: current.sortOrder }
        return t
      })

      return { ...state, templates: newTemplates }
    }

    case 'MOVE_DOWN': {
      const targetTemplate = state.templates.find(t => t.id === action.templateId)
      if (!targetTemplate) return state

      const sectionTemplates = state.templates
        .filter(t => t.section === targetTemplate.section)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const idx = sectionTemplates.findIndex(t => t.id === action.templateId)
      if (idx >= sectionTemplates.length - 1) return state

      const current = sectionTemplates[idx]!
      const next = sectionTemplates[idx + 1]!

      const newTemplates = state.templates.map(t => {
        if (t.id === current.id) return { ...t, sortOrder: next.sortOrder }
        if (t.id === next.id) return { ...t, sortOrder: current.sortOrder }
        return t
      })

      return { ...state, templates: newTemplates }
    }

    default:
      return state
  }
}
