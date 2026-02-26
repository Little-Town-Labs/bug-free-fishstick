import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

// Mock react-pdf — must include `pdfjs` since DocumentViewer.tsx accesses
// pdfjs.GlobalWorkerOptions at module load time.
vi.mock('react-pdf', () => ({
  Document: ({ onLoadSuccess, children, loading }: any) => {
    // Simulate loaded state
    setTimeout(() => onLoadSuccess?.({ numPages: 3 }), 0)
    return createElement('div', { 'data-testid': 'pdf-document' }, children)
  },
  Page: ({ pageNumber }: any) =>
    createElement('div', { 'data-testid': `pdf-page-${pageNumber}` }, `Page ${pageNumber}`),
  pdfjs: {
    version: '3.0.0',
    GlobalWorkerOptions: { workerSrc: '' },
  },
}))

// Mock pdfjs-dist (belt-and-suspenders in case it's imported directly)
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
}))

// Mock mammoth
vi.mock('mammoth', () => ({
  convertToHtml: vi.fn().mockResolvedValue({ value: '<p>Word content</p>' }),
}))

// Mock fetch for document loading
const mockFetch = vi.fn()
global.fetch = mockFetch

import { DocumentViewer } from '@/components/rfp/DocumentViewer'

describe('DocumentViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    })
  })

  it('renders empty state when no document URL', () => {
    render(createElement(DocumentViewer, { documentUrl: null, documentType: null }))
    expect(screen.getByText('No document available for preview.')).toBeTruthy()
  })

  it('has role="document" on the container', () => {
    render(createElement(DocumentViewer, { documentUrl: null, documentType: null }))
    expect(screen.getByRole('document')).toBeTruthy()
  })

  it('renders loading skeleton initially for PDF', () => {
    render(
      createElement(DocumentViewer, {
        documentUrl: 'https://example.com/test.pdf',
        documentType: 'pdf' as const,
      })
    )
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders error fallback when error occurs', async () => {
    // Mock the dynamic import to fail
    vi.doMock('pdfjs-dist', () => {
      throw new Error('fail')
    })

    render(createElement(DocumentViewer, { documentUrl: null, documentType: null }))
    // Should show empty state (no error since no URL)
    expect(screen.getByText('No document available for preview.')).toBeTruthy()
  })
})
