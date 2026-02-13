import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

// Mock dependencies
vi.mock('@/components/rfp/DocumentPreview', () => ({
  DocumentPreview: () => createElement('div', { 'data-testid': 'doc-preview' }, 'Preview'),
}))
vi.mock('@/components/rfp/ResponseCard', () => ({
  ResponseCard: () => createElement('div', { 'data-testid': 'response-card' }, 'Card'),
}))
vi.mock('@/components/rfp/CompletionProgress', () => ({
  CompletionProgress: () => createElement('div', null, 'Progress'),
}))

import { RfpEditor } from '@/components/rfp/RfpEditor'

describe('RfpEditor layout', () => {
  it('renders split view with both panels', () => {
    render(
      createElement(RfpEditor, {
        rfpId: 'rfp-1',
        documentUrl: null,
        documentType: null,
        parsedStructure: null,
        responses: [],
      })
    )

    const editor = screen.getByTestId('rfp-editor')
    expect(editor).toBeTruthy()
    // Should have the grid layout with md: breakpoint (768px)
    const grid = editor.querySelector('.grid')
    expect(grid?.className).toContain('md:grid-cols-2')
  })

  it('renders custom documentViewer when provided', () => {
    const customViewer = createElement('div', { 'data-testid': 'custom-viewer' }, 'Custom')

    render(
      createElement(RfpEditor, {
        rfpId: 'rfp-1',
        documentUrl: null,
        documentType: null,
        parsedStructure: null,
        responses: [],
        documentViewer: customViewer,
      })
    )

    expect(screen.getByTestId('custom-viewer')).toBeTruthy()
    expect(screen.queryByTestId('doc-preview')).toBeNull()
  })

  it('falls back to DocumentPreview when no viewer provided', () => {
    render(
      createElement(RfpEditor, {
        rfpId: 'rfp-1',
        documentUrl: null,
        documentType: null,
        parsedStructure: null,
        responses: [],
      })
    )

    expect(screen.getByTestId('doc-preview')).toBeTruthy()
  })
})
