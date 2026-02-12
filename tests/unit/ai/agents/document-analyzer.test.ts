import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Vercel AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

// Mock the providers module
vi.mock('@/lib/ai/providers', () => ({
  getLanguageModel: vi.fn().mockReturnValue({ type: 'mock-model' }),
}))

import { generateObject } from 'ai'
import { getLanguageModel } from '@/lib/ai/providers'
import { analyzeDocument } from '@/lib/ai/agents/document-analyzer'
import type { DocumentAnalysisInput, DocumentAnalysisResult } from '@/lib/ai/agents/document-analyzer'

describe('Document Analyzer Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Happy Path', () => {
    it('should analyze document text and return identified fields', async () => {
      const mockResult = {
        object: {
          fields: [
            {
              id: 'field-1',
              type: 'text' as const,
              question: 'Company Name',
              position: { page: 1, x: 100, y: 200, width: 300, height: 30 },
            },
            {
              id: 'field-2',
              type: 'paragraph' as const,
              question: 'Describe your approach',
              position: { page: 1, x: 100, y: 300, width: 400, height: 100 },
            },
          ],
          summary: 'RFP for IT services with 2 sections',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const input: DocumentAnalysisInput = {
        text: 'Sample RFP document text with Company Name field and approach description',
        pages: 3,
        providerConfig: { provider: 'claude' },
      }

      const result = await analyzeDocument(input)

      expect(result).toEqual({
        fields: [
          {
            id: 'field-1',
            type: 'text',
            question: 'Company Name',
            position: { page: 1, x: 100, y: 200, width: 300, height: 30 },
          },
          {
            id: 'field-2',
            type: 'paragraph',
            question: 'Describe your approach',
            position: { page: 1, x: 100, y: 300, width: 400, height: 100 },
          },
        ],
        summary: 'RFP for IT services with 2 sections',
      })
    })

    it('should correctly categorize different field types', async () => {
      const mockResult = {
        object: {
          fields: [
            { id: 'f1', type: 'text' as const, question: 'Name', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
            { id: 'f2', type: 'paragraph' as const, question: 'Description', position: { page: 1, x: 0, y: 30, width: 100, height: 60 } },
            { id: 'f3', type: 'checkbox' as const, question: 'I agree', position: { page: 1, x: 0, y: 100, width: 20, height: 20 } },
            { id: 'f4', type: 'table' as const, question: 'Budget breakdown', position: { page: 2, x: 0, y: 0, width: 500, height: 200 } },
            { id: 'f5', type: 'date' as const, question: 'Submission date', position: { page: 2, x: 0, y: 210, width: 150, height: 20 } },
            { id: 'f6', type: 'number' as const, question: 'Total cost', position: { page: 2, x: 0, y: 240, width: 100, height: 20 } },
          ],
          summary: 'Comprehensive form with all field types',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const input: DocumentAnalysisInput = {
        text: 'Document with various field types',
        pages: 2,
        providerConfig: { provider: 'openai' },
      }

      const result = await analyzeDocument(input)

      expect(result.fields).toHaveLength(6)
      expect(result.fields[0]!.type).toBe('text')
      expect(result.fields[1]!.type).toBe('paragraph')
      expect(result.fields[2]!.type).toBe('checkbox')
      expect(result.fields[3]!.type).toBe('table')
      expect(result.fields[4]!.type).toBe('date')
      expect(result.fields[5]!.type).toBe('number')
    })

    it('should generate unique IDs for each field', async () => {
      const mockResult = {
        object: {
          fields: [
            { id: 'field-001', type: 'text' as const, question: 'Q1', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
            { id: 'field-002', type: 'text' as const, question: 'Q2', position: { page: 1, x: 0, y: 30, width: 100, height: 20 } },
            { id: 'field-003', type: 'text' as const, question: 'Q3', position: { page: 1, x: 0, y: 60, width: 100, height: 20 } },
          ],
          summary: 'Document with multiple fields',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const input: DocumentAnalysisInput = {
        text: 'Document with three questions',
        pages: 1,
        providerConfig: { provider: 'claude' },
      }

      const result = await analyzeDocument(input)

      const ids = result.fields.map(f => f.id)
      const uniqueIds = new Set(ids)

      expect(ids).toHaveLength(3)
      expect(uniqueIds.size).toBe(3)
      expect(ids).toContain('field-001')
      expect(ids).toContain('field-002')
      expect(ids).toContain('field-003')
    })

    it('should include question text for each identified field', async () => {
      const mockResult = {
        object: {
          fields: [
            { id: 'f1', type: 'text' as const, question: 'What is your company name?', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
            { id: 'f2', type: 'paragraph' as const, question: 'Describe your technical approach in detail.', position: { page: 1, x: 0, y: 30, width: 400, height: 100 } },
          ],
          summary: 'Document with detailed questions',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const input: DocumentAnalysisInput = {
        text: 'RFP document',
        pages: 1,
        providerConfig: { provider: 'azure' },
      }

      const result = await analyzeDocument(input)

      expect(result.fields[0]!.question).toBe('What is your company name?')
      expect(result.fields[1]!.question).toBe('Describe your technical approach in detail.')
      result.fields.forEach(field => {
        expect(field.question).toBeTruthy()
        expect(typeof field.question).toBe('string')
      })
    })

    it('should return a document summary', async () => {
      const mockResult = {
        object: {
          fields: [
            { id: 'f1', type: 'text' as const, question: 'Q1', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
          ],
          summary: 'This is an RFP for cloud infrastructure services with 5 main sections covering technical requirements, pricing, and timeline.',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const input: DocumentAnalysisInput = {
        text: 'Complex RFP document',
        pages: 10,
        providerConfig: { provider: 'claude' },
      }

      const result = await analyzeDocument(input)

      expect(result.summary).toBeDefined()
      expect(typeof result.summary).toBe('string')
      expect(result.summary).toBe('This is an RFP for cloud infrastructure services with 5 main sections covering technical requirements, pricing, and timeline.')
    })

    it('should call getLanguageModel with provided config', async () => {
      const mockResult = {
        object: {
          fields: [],
          summary: 'Test summary',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const providerConfig = { provider: 'openai' as const, apiKey: 'test-key-123' }
      const input: DocumentAnalysisInput = {
        text: 'Sample document',
        pages: 1,
        providerConfig,
      }

      await analyzeDocument(input)

      expect(getLanguageModel).toHaveBeenCalledWith(providerConfig)
    })

    it('should pass document text to the AI model', async () => {
      const mockResult = {
        object: {
          fields: [
            { id: 'f1', type: 'text' as const, question: 'Q1', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
          ],
          summary: 'Summary',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const documentText = 'This is the full document text extracted from the PDF. It contains multiple sections and questions that need to be analyzed.'
      const input: DocumentAnalysisInput = {
        text: documentText,
        pages: 3,
        providerConfig: { provider: 'claude' },
      }

      await analyzeDocument(input)

      expect(generateObject).toHaveBeenCalled()
      const callArgs = vi.mocked(generateObject).mock.calls[0]![0]
      expect(callArgs.prompt || callArgs.messages || JSON.stringify(callArgs)).toContain(documentText)
    })
  })

  describe('Error Handling', () => {
    it('should throw on empty document text', async () => {
      const input: DocumentAnalysisInput = {
        text: '',
        pages: 1,
        providerConfig: { provider: 'claude' },
      }

      await expect(analyzeDocument(input)).rejects.toThrow()
    })

    it('should throw on whitespace-only document text', async () => {
      const input: DocumentAnalysisInput = {
        text: '   \n\t  \n  ',
        pages: 1,
        providerConfig: { provider: 'claude' },
      }

      await expect(analyzeDocument(input)).rejects.toThrow()
    })

    it('should handle AI model errors gracefully with descriptive error', async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error('API rate limit exceeded'))

      const input: DocumentAnalysisInput = {
        text: 'Document text',
        pages: 1,
        providerConfig: { provider: 'openai' },
      }

      await expect(analyzeDocument(input)).rejects.toThrow(/document analysis failed/i)
    })

    it('should wrap AI errors with context about the operation', async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error('Network timeout'))

      const input: DocumentAnalysisInput = {
        text: 'Document text',
        pages: 5,
        providerConfig: { provider: 'azure' },
      }

      await expect(analyzeDocument(input)).rejects.toThrow()

      try {
        await analyzeDocument(input)
      } catch (error: any) {
        expect(error.message).toMatch(/document analysis|analyze|failed/i)
      }
    })

    it('should handle AI returning invalid structure', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          // Missing required 'fields' array
          summary: 'Summary only',
        },
      } as any)

      const input: DocumentAnalysisInput = {
        text: 'Document text',
        pages: 1,
        providerConfig: { provider: 'claude' },
      }

      await expect(analyzeDocument(input)).rejects.toThrow()
    })

    it('should handle AI returning unexpected field structure', async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          fields: [
            { id: 'f1', question: 'Q1' }, // Missing type and position
          ],
          summary: 'Summary',
        },
      } as any)

      const input: DocumentAnalysisInput = {
        text: 'Document text',
        pages: 1,
        providerConfig: { provider: 'claude' },
      }

      await expect(analyzeDocument(input)).rejects.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long documents', async () => {
      const mockResult = {
        object: {
          fields: [
            { id: 'f1', type: 'text' as const, question: 'Q1', position: { page: 50, x: 0, y: 0, width: 100, height: 20 } },
          ],
          summary: 'Very long document',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const veryLongText = 'Lorem ipsum '.repeat(10000) // ~120,000 characters
      const input: DocumentAnalysisInput = {
        text: veryLongText,
        pages: 100,
        providerConfig: { provider: 'claude' },
      }

      const result = await analyzeDocument(input)

      expect(result.fields).toBeDefined()
      expect(Array.isArray(result.fields)).toBe(true)
      expect(generateObject).toHaveBeenCalled()
    })

    it('should return empty fields array for documents with no identifiable fields', async () => {
      const mockResult = {
        object: {
          fields: [],
          summary: 'Document contains only narrative text with no fillable fields or questions',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const input: DocumentAnalysisInput = {
        text: 'This is just a narrative document with no questions or forms.',
        pages: 1,
        providerConfig: { provider: 'openai' },
      }

      const result = await analyzeDocument(input)

      expect(result.fields).toEqual([])
      expect(Array.isArray(result.fields)).toBe(true)
      expect(result.summary).toBeTruthy()
    })

    it('should handle documents with special characters and unicode', async () => {
      const mockResult = {
        object: {
          fields: [
            { id: 'f1', type: 'text' as const, question: 'Nom de l\'entreprise (français)', position: { page: 1, x: 0, y: 0, width: 100, height: 20 } },
            { id: 'f2', type: 'text' as const, question: '会社名 (Japanese)', position: { page: 1, x: 0, y: 30, width: 100, height: 20 } },
          ],
          summary: 'Multilingual document',
        },
      }
      vi.mocked(generateObject).mockResolvedValue(mockResult as any)

      const input: DocumentAnalysisInput = {
        text: 'Document with special chars: €, £, ¥, ©, ®, ™, and unicode: 你好, مرحبا, Здравствуйте',
        pages: 1,
        providerConfig: { provider: 'claude' },
      }

      const result = await analyzeDocument(input)

      expect(result.fields).toBeDefined()
      expect(result.fields[0]!.question).toContain('français')
      expect(result.fields[1]!.question).toContain('Japanese')
    })
  })
})
