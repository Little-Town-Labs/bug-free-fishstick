'use client'

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

// Must be at module level so webpack can statically process the new URL() pattern
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface DocumentViewerProps {
  documentUrl: string | null
  documentType: 'pdf' | 'docx' | null
  activePage?: number
}

export interface DocumentViewerHandle {
  scrollToPage: (page: number) => void
}

export const DocumentViewer = forwardRef<DocumentViewerHandle, DocumentViewerProps>(
  function DocumentViewer({ documentUrl, documentType, activePage }, ref) {
    const [numPages, setNumPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [wordHtml, setWordHtml] = useState<string | null>(null)
    const [loading, setLoading] = useState(documentType === 'docx')
    const [error, setError] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Expose scrollToPage
    useImperativeHandle(
      ref,
      () => ({
        scrollToPage: (page: number) => {
          if (documentType === 'pdf') {
            setCurrentPage(Math.max(1, Math.min(page + 1, numPages))) // 0-indexed to 1-indexed
          } else if (containerRef.current) {
            containerRef.current.scrollTop = 0
          }
        },
      }),
      [documentType, numPages]
    )

    // Load Word document as HTML via mammoth
    useEffect(() => {
      if (documentType !== 'docx' || !documentUrl) return
      let cancelled = false

      async function loadWord() {
        try {
          const res = await fetch(documentUrl!)
          if (!res.ok) throw new Error('Failed to fetch document')
          const buffer = await res.arrayBuffer()
          const mammoth = await import('mammoth')
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          if (!cancelled) {
            setWordHtml(result.value)
          }
        } catch {
          if (!cancelled) setError('Failed to load Word document')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      loadWord()
      return () => {
        cancelled = true
      }
    }, [documentType, documentUrl])

    // Sync activePage prop
    useEffect(() => {
      if (activePage !== undefined && documentType === 'pdf') {
        setCurrentPage(activePage + 1) // 0-indexed to 1-indexed
      }
    }, [activePage, documentType])

    const handlePrevPage = useCallback(() => {
      setCurrentPage((p) => Math.max(1, p - 1))
    }, [])

    const handleNextPage = useCallback(() => {
      setCurrentPage((p) => Math.min(numPages, p + 1))
    }, [numPages])

    if (!documentUrl || !documentType) {
      return (
        <div
          className="border rounded-lg p-8 text-center text-muted-foreground"
          role="document"
          aria-label="Document viewer"
        >
          <p>No document available for preview.</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="border rounded-lg p-8 text-center" role="alert">
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-muted-foreground text-xs mt-2">The document could not be loaded.</p>
        </div>
      )
    }

    if (loading) {
      return (
        <div
          className="border rounded-lg p-8 animate-pulse"
          aria-label="Loading document"
          role="status"
        >
          <div className="h-96 bg-muted rounded" />
        </div>
      )
    }

    // PDF rendering
    if (documentType === 'pdf') {
      return (
        <div
          className="border rounded-lg overflow-hidden"
          role="document"
          aria-label="PDF document viewer"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="px-2 py-1 text-sm rounded hover:bg-muted disabled:opacity-50"
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="text-sm" aria-live="polite" aria-atomic="true">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages}
              className="px-2 py-1 text-sm rounded hover:bg-muted disabled:opacity-50"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
          <div className="overflow-auto max-h-[70vh]" ref={containerRef}>
            <Document
              file={documentUrl}
              onLoadSuccess={({ numPages: n }: { numPages: number }) => setNumPages(n)}
              onLoadError={() => setError('Failed to load PDF')}
              loading={
                <div
                  className="h-96 flex items-center justify-center"
                  aria-label="Loading PDF"
                  role="status"
                >
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                width={550}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        </div>
      )
    }

    // Word/DOCX rendering
    if (documentType === 'docx' && wordHtml) {
      return (
        <div
          className="border rounded-lg overflow-hidden"
          role="document"
          aria-label="Word document viewer"
        >
          <div className="px-3 py-2 border-b bg-muted/50">
            <span className="text-sm text-muted-foreground">Word Document Preview</span>
          </div>
          <div
            ref={containerRef}
            className="overflow-auto max-h-[70vh] p-4 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: wordHtml }}
          />
        </div>
      )
    }

    return null
  }
)
