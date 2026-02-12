import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentPreview } from '@/components/rfp/DocumentPreview'

describe('DocumentPreview', () => {
  const mockParsedStructure = {
    pages: 5,
    fields: [
      {
        id: 'field-1',
        type: 'text',
        question: 'What is your company name?',
        position: { page: 1, x: 100, y: 200, width: 300, height: 40 }
      },
      {
        id: 'field-2',
        type: 'paragraph',
        question: 'Describe your experience with similar projects',
        position: { page: 2, x: 100, y: 300, width: 500, height: 100 }
      },
      {
        id: 'field-3',
        type: 'checkbox',
        question: 'Do you have ISO 9001 certification?',
        position: { page: 3, x: 100, y: 150, width: 20, height: 20 }
      }
    ]
  }

  describe('when document is provided', () => {
    it('renders document info with all props provided', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/rfp-document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="RFP-2024-Q1.pdf"
          isLoading={false}
        />
      )

      expect(screen.getByText('RFP-2024-Q1.pdf')).toBeInTheDocument()
    })

    it('shows PDF document type badge when type is pdf', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByText('PDF')).toBeInTheDocument()
    })

    it('shows DOCX document type badge when type is docx', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.docx"
          documentType="docx"
          parsedStructure={mockParsedStructure}
          fileName="test.docx"
        />
      )

      expect(screen.getByText('DOCX')).toBeInTheDocument()
    })

    it('displays field count from parsedStructure', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByText(/3.*field/i)).toBeInTheDocument()
    })

    it('displays page count from parsedStructure', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByText(/5.*page/i)).toBeInTheDocument()
    })

    it('shows list of field questions', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByText('What is your company name?')).toBeInTheDocument()
      expect(screen.getByText('Describe your experience with similar projects')).toBeInTheDocument()
      expect(screen.getByText('Do you have ISO 9001 certification?')).toBeInTheDocument()
    })

    it('displays field types alongside questions', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByText(/text/i)).toBeInTheDocument()
      expect(screen.getByText(/paragraph/i)).toBeInTheDocument()
      expect(screen.getByText(/checkbox/i)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={null}
          fileName="test.pdf"
          isLoading={true}
        />
      )

      expect(screen.getByTestId('document-preview-skeleton')).toBeInTheDocument()
    })

    it('does not show document info when loading', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
          isLoading={true}
        />
      )

      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty state when documentUrl is null', () => {
      render(
        <DocumentPreview
          documentUrl={null}
          documentType={null}
          parsedStructure={null}
          isLoading={false}
        />
      )

      expect(screen.getByText(/no document/i)).toBeInTheDocument()
    })

    it('shows upload prompt in empty state', () => {
      render(
        <DocumentPreview
          documentUrl={null}
          documentType={null}
          parsedStructure={null}
          isLoading={false}
        />
      )

      expect(screen.getByText(/upload.*document/i)).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles parsedStructure with no fields', () => {
      const emptyStructure = {
        pages: 3,
        fields: []
      }

      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={emptyStructure}
          fileName="empty.pdf"
        />
      )

      expect(screen.getByText(/0.*field/i)).toBeInTheDocument()
      expect(screen.getByText(/3.*page/i)).toBeInTheDocument()
    })

    it('handles parsedStructure with zero pages', () => {
      const zeroPagesStructure = {
        pages: 0,
        fields: []
      }

      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={zeroPagesStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByText(/0.*page/i)).toBeInTheDocument()
    })

    it('uses fallback text when fileName is not provided', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
        />
      )

      expect(screen.getByText('Untitled Document')).toBeInTheDocument()
    })

    it('handles null parsedStructure gracefully', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={null}
          fileName="test.pdf"
          isLoading={false}
        />
      )

      // Should show document info but indicate no parsed data
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
      expect(screen.getByText(/not.*parsed|no.*fields/i)).toBeInTheDocument()
    })

    it('handles very long field questions with truncation', () => {
      const longQuestionStructure = {
        pages: 1,
        fields: [
          {
            id: 'field-long',
            type: 'text',
            question: 'This is an extremely long question that goes on and on and should probably be truncated in the UI to maintain a clean layout and prevent overflow issues in the component display area',
            position: { page: 1, x: 0, y: 0, width: 100, height: 50 }
          }
        ]
      }

      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={longQuestionStructure}
          fileName="test.pdf"
        />
      )

      // Question should be present but possibly truncated
      const questionElement = screen.getByText(/This is an extremely long question/i)
      expect(questionElement).toBeInTheDocument()
    })

    it('displays page numbers for each field', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByText(/page 1/i)).toBeInTheDocument()
      expect(screen.getByText(/page 2/i)).toBeInTheDocument()
      expect(screen.getByText(/page 3/i)).toBeInTheDocument()
    })

    it('handles documentType being null', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document"
          documentType={null}
          parsedStructure={mockParsedStructure}
          fileName="test"
        />
      )

      // Should still render but without type badge
      expect(screen.getByText('test')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper semantic structure for document preview', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByRole('region', { name: /document preview/i })).toBeInTheDocument()
    })

    it('labels field list with appropriate heading', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      expect(screen.getByRole('heading', { name: /fields|questions/i })).toBeInTheDocument()
    })

    it('uses list markup for fields', () => {
      render(
        <DocumentPreview
          documentUrl="https://example.com/document.pdf"
          documentType="pdf"
          parsedStructure={mockParsedStructure}
          fileName="test.pdf"
        />
      )

      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()

      const listItems = screen.getAllByRole('listitem')
      expect(listItems).toHaveLength(3)
    })
  })
})
