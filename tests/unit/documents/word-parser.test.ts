import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Buffer } from 'node:buffer'

// Mock mammoth BEFORE importing the module under test
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
    convertToHtml: vi.fn(),
  },
}))

// Import AFTER mock
import mammoth from 'mammoth'
import { parseWord } from '@/lib/documents/word-parser'

describe('Word Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Happy Path', () => {
    it('should parse valid DOCX and return extracted text', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = 'Request for Proposal\n\n1. Project Overview\n\nDescribe your project.'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Request for Proposal</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.text).toBe(mockText)
      expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: mockBuffer })
    })

    it('should return HTML representation for document preview', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockHtml = '<h1>Request for Proposal</h1><p>Section 1</p><table><tr><td>Field</td></tr></table>'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: 'Request for Proposal\n\nSection 1',
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: mockHtml,
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.html).toBe(mockHtml)
      expect(mammoth.convertToHtml).toHaveBeenCalledWith({ buffer: mockBuffer })
    })

    it('should extract structured fields from parsed content', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = '1. Company Name: _____________\n2. Project Description:\n\n3. Budget: [ ] <$50k [ ] $50k-$100k'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>1. Company Name: _____________</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.fields).toBeDefined()
      expect(Array.isArray(result.fields)).toBe(true)
      expect(result.fields.length).toBeGreaterThan(0)
      expect(result.fields[0]).toMatchObject({
        type: expect.stringMatching(/^(text|paragraph|checkbox|table)$/),
        question: expect.any(String),
      })
    })

    it('should assign unique IDs to fields', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = '1. Field One: ___\n2. Field Two: ___\n3. Field Three: ___'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Fields</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      const fieldIds = result.fields.map((f) => f.id)
      const uniqueIds = new Set(fieldIds)

      expect(fieldIds.length).toBe(uniqueIds.size)
      expect(result.fields[0].id).toMatch(/^field_\d+_\w+$/)
    })

    it('should include field position information', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = '1. Question: ___________'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>1. Question: ___________</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.fields[0].position).toBeDefined()
      expect(result.fields[0].position).toMatchObject({
        page: expect.any(Number),
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      })
    })

    it('should include question text for each field', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = '1. What is your company name?\n2. Describe your project approach.'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Questions</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.fields.length).toBeGreaterThan(0)
      expect(result.fields[0].question).toBeTruthy()
      expect(typeof result.fields[0].question).toBe('string')
      expect(result.fields[0].question.length).toBeGreaterThan(0)
    })

    it('should return metadata (title, author) from document properties', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = 'RFP Document'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>RFP Document</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.metadata).toBeDefined()
      expect(result.metadata).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          author: expect.any(String),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw on corrupted/invalid DOCX data', async () => {
      const corruptedBuffer = Buffer.from('not a valid docx file')

      vi.mocked(mammoth.extractRawText).mockRejectedValue(
        new Error('Invalid DOCX file')
      )

      await expect(parseWord(corruptedBuffer)).rejects.toThrow('Invalid DOCX file')
    })

    it('should throw on empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0)

      await expect(parseWord(emptyBuffer)).rejects.toThrow(
        'Buffer cannot be empty'
      )

      expect(mammoth.extractRawText).not.toHaveBeenCalled()
    })

    it('should throw on files exceeding 50MB', async () => {
      // 50MB + 1 byte
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024 + 1)

      await expect(parseWord(largeBuffer)).rejects.toThrow(
        'File size exceeds 50MB limit'
      )

      expect(mammoth.extractRawText).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle DOCX with no extractable text', async () => {
      const mockBuffer = Buffer.from('mock docx with only images')

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: '',
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.text).toBe('')
      expect(result.html).toBe('')
      expect(result.fields).toEqual([])
    })

    it('should handle DOCX with no form fields', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = 'This is a simple document with no fields or questions.'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>This is a simple document with no fields or questions.</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.text).toBe(mockText)
      expect(result.fields).toEqual([])
    })

    it('should handle missing metadata gracefully', async () => {
      const mockBuffer = Buffer.from('mock docx data')
      const mockText = 'Document without metadata'

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: mockText,
        messages: [],
      })

      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Document without metadata</p>',
        messages: [],
      })

      const result = await parseWord(mockBuffer)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.title).toBeDefined()
      expect(result.metadata.author).toBeDefined()
      // Should have default/fallback values
      expect(typeof result.metadata.title).toBe('string')
      expect(typeof result.metadata.author).toBe('string')
    })
  })
})
