import { describe, it, expect, vi, beforeEach } from 'vitest'

// The implementation uses require('pdf-parse/lib/pdf-parse') — mock at that path.
// Vite's CJS-to-ESM interop exposes `default` when require() is used, so we
// mock the default export as a function that returns { text, numpages, info }.
const mockPdfParseFn = vi.hoisted(() => vi.fn())

vi.mock('pdf-parse/lib/pdf-parse', () => ({
  default: mockPdfParseFn,
}))

import { parsePdf } from '@/lib/documents/pdf-parser'

describe('PDF Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupMock(options: {
    text?: string
    numpages?: number
    info?: Record<string, unknown>
  }) {
    mockPdfParseFn.mockResolvedValue({
      text: options.text ?? '',
      numpages: options.numpages ?? 1,
      info: options.info ?? {},
    })
  }

  describe('parsePdf', () => {
    it('should parse a valid PDF and return text content', async () => {
      setupMock({
        text: 'Section 1: Company Overview\nPlease describe your company.\n\nSection 2: Technical Approach\nDescribe your technical solution.',
        numpages: 3,
        info: { Title: 'Test RFP', Author: 'Test Corp' },
      })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      expect(result.text).toContain('Company Overview')
      expect(result.text).toContain('Technical Approach')
      expect(result.pages).toBe(3)
    })

    it('should return page count from parsed PDF', async () => {
      setupMock({ text: 'Page content', numpages: 12 })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      expect(result.pages).toBe(12)
    })

    it('should return metadata from parsed PDF', async () => {
      setupMock({
        text: 'RFP content',
        numpages: 1,
        info: { Title: 'Government RFP 2026', Author: 'City of Springfield' },
      })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.title).toBe('Government RFP 2026')
      expect(result.metadata.author).toBe('City of Springfield')
    })

    it('should extract structured fields from PDF content', async () => {
      setupMock({
        text: [
          '1. Company Name: ___________',
          '2. Please provide a detailed description of your approach:',
          '',
          '3. Do you agree to the terms? [ ]',
          '',
          'Table 1: Pricing Schedule',
          '| Item | Quantity | Unit Price | Total |',
        ].join('\n'),
        numpages: 2,
      })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      expect(result.fields).toBeDefined()
      expect(Array.isArray(result.fields)).toBe(true)
      expect(result.fields.length).toBeGreaterThan(0)

      // Should identify different field types
      const fieldTypes = result.fields.map((f) => f.type)
      expect(fieldTypes).toContain('text')
      expect(fieldTypes).toContain('paragraph')
    })

    it('should assign unique IDs to each extracted field', async () => {
      setupMock({
        text: '1. Name: ___\n2. Address: ___\n3. Description:',
        numpages: 1,
      })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      const ids = result.fields.map((f) => f.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should include field position information', async () => {
      setupMock({
        text: '1. Company Name: ___________',
        numpages: 1,
      })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      expect(result.fields.length).toBeGreaterThan(0)
      const field = result.fields[0]!
      expect(field.position).toBeDefined()
      expect(field.position).toHaveProperty('page')
      expect(field.position).toHaveProperty('x')
      expect(field.position).toHaveProperty('y')
      expect(field.position).toHaveProperty('width')
      expect(field.position).toHaveProperty('height')
    })

    it('should include the question text for each field', async () => {
      setupMock({
        text: '1. Describe your company history:\n\n2. Annual revenue: ___',
        numpages: 1,
      })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      expect(result.fields.length).toBeGreaterThan(0)
      result.fields.forEach((field) => {
        expect(field.question).toBeDefined()
        expect(typeof field.question).toBe('string')
        expect(field.question.length).toBeGreaterThan(0)
      })
    })

    it('should handle multi-page PDFs correctly', async () => {
      setupMock({
        text: 'Page 1 content\n\nPage 2 content\n\nPage 3 content\n\nPage 4 content\n\nPage 5 content',
        numpages: 5,
      })

      const buffer = Buffer.from('fake-pdf-content')
      const result = await parsePdf(buffer)

      expect(result.pages).toBe(5)
      expect(result.text).toContain('Page 1 content')
      expect(result.text).toContain('Page 5 content')
    })
  })

  describe('error handling', () => {
    it('should throw on corrupted PDF data', async () => {
      mockPdfParseFn.mockRejectedValue(new Error('Invalid PDF structure'))

      const buffer = Buffer.from('not-a-pdf')

      await expect(parsePdf(buffer)).rejects.toThrow()
    })

    it('should throw on password-protected PDF', async () => {
      mockPdfParseFn.mockRejectedValue(
        new Error('PasswordException: Incorrect Password')
      )

      const buffer = Buffer.from('encrypted-pdf')

      await expect(parsePdf(buffer)).rejects.toThrow(/password/i)
    })

    it('should throw on empty buffer input', async () => {
      const buffer = Buffer.alloc(0)

      await expect(parsePdf(buffer)).rejects.toThrow()
    })

    it('should throw on files exceeding 50MB size limit', async () => {
      const largeBuffer = { length: 50 * 1024 * 1024 + 1 } as Buffer

      await expect(parsePdf(largeBuffer)).rejects.toThrow(/size|50MB|limit/i)
    })
  })

  describe('edge cases', () => {
    it('should handle PDF with no extractable text', async () => {
      setupMock({ text: '', numpages: 1 })

      const buffer = Buffer.from('scanned-image-pdf')
      const result = await parsePdf(buffer)

      expect(result.text).toBe('')
      expect(result.pages).toBe(1)
      expect(result.fields).toEqual([])
    })

    it('should handle PDF with no form fields (plain text)', async () => {
      setupMock({
        text: 'This is a plain text document with no questions or fields to fill in. It contains only narrative content about the project requirements and scope.',
        numpages: 2,
      })

      const buffer = Buffer.from('plain-text-pdf')
      const result = await parsePdf(buffer)

      expect(result.text).toContain('plain text document')
      expect(result.fields).toEqual([])
    })

    it('should handle missing metadata gracefully', async () => {
      setupMock({ text: 'Some content', numpages: 1, info: {} })

      const buffer = Buffer.from('fake-pdf')
      const result = await parsePdf(buffer)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.title).toBeUndefined()
      expect(result.metadata.author).toBeUndefined()
    })
  })
})
