import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pdf-lib before importing the module under test
vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn(),
    create: vi.fn(),
  },
  rgb: vi.fn((r: number, g: number, b: number) => ({ r, g, b })),
  StandardFonts: {
    Helvetica: 'Helvetica',
    HelveticaBold: 'HelveticaBold',
  },
}))

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { generatePdfOutput } from '@/lib/documents/pdf-output'
import type { PdfOutputOptions, PdfOutputResult } from '@/lib/documents/pdf-output'

describe('PDF Output Generator', () => {
  let mockPage: any
  let mockDoc: any
  let mockFont: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock font
    mockFont = {
      widthOfTextAtSize: vi.fn().mockReturnValue(100),
      heightAtSize: vi.fn().mockReturnValue(12),
    }

    // Create mock page
    mockPage = {
      drawText: vi.fn(),
      getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
    }

    // Create mock PDF document
    mockDoc = {
      getPages: vi.fn().mockReturnValue([mockPage]),
      getPageCount: vi.fn().mockReturnValue(1),
      save: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])), // PDF header bytes
      embedFont: vi.fn().mockResolvedValue(mockFont),
    }

    // Set up PDFDocument.load to return our mock
    vi.mocked(PDFDocument.load).mockResolvedValue(mockDoc as any)
  })

  describe('Happy Path', () => {
    it('should load the original PDF and overlay text responses', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test Response',
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      expect(PDFDocument.load).toHaveBeenCalledWith(originalPdf)
      expect(mockDoc.embedFont).toHaveBeenCalledWith(StandardFonts.Helvetica)
      expect(mockPage.drawText).toHaveBeenCalledWith(
        'Test Response',
        expect.objectContaining({
          x: 100,
          y: 500,
        })
      )
    })

    it('should return a Buffer with the completed PDF', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test Response',
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      const result = await generatePdfOutput(options)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(mockDoc.save).toHaveBeenCalled()
    })

    it('should return correct page count', async () => {
      mockDoc.getPageCount.mockReturnValue(5)

      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [],
      }

      const result = await generatePdfOutput(options)

      expect(result.pageCount).toBe(5)
      expect(mockDoc.getPageCount).toHaveBeenCalled()
    })

    it('should position text at specified coordinates on correct pages', async () => {
      const mockPage1 = {
        drawText: vi.fn(),
        getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
      }
      const mockPage2 = {
        drawText: vi.fn(),
        getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
      }

      mockDoc.getPages.mockReturnValue([mockPage1, mockPage2])
      mockDoc.getPageCount.mockReturnValue(2)

      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Page 1 Response',
            position: {
              page: 0,
              x: 50,
              y: 600,
              width: 200,
              height: 50,
            },
          },
          {
            fieldId: 'field-2',
            responseText: 'Page 2 Response',
            position: {
              page: 1,
              x: 100,
              y: 400,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      expect(mockPage1.drawText).toHaveBeenCalledWith(
        'Page 1 Response',
        expect.objectContaining({
          x: 50,
          y: 600,
        })
      )

      expect(mockPage2.drawText).toHaveBeenCalledWith(
        'Page 2 Response',
        expect.objectContaining({
          x: 100,
          y: 400,
        })
      )
    })

    it('should use configurable font size (default and custom)', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Default font size',
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
          {
            fieldId: 'field-2',
            responseText: 'Custom font size',
            position: {
              page: 0,
              x: 100,
              y: 400,
              width: 200,
              height: 50,
              fontSize: 14,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      // First call should use default font size (typically 12)
      expect(mockPage.drawText).toHaveBeenNthCalledWith(
        1,
        'Default font size',
        expect.objectContaining({
          size: 12,
        })
      )

      // Second call should use custom font size
      expect(mockPage.drawText).toHaveBeenNthCalledWith(
        2,
        'Custom font size',
        expect.objectContaining({
          size: 14,
        })
      )
    })

    it('should handle multiple responses across multiple pages', async () => {
      const pages = [
        {
          drawText: vi.fn(),
          getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
        },
        {
          drawText: vi.fn(),
          getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
        },
        {
          drawText: vi.fn(),
          getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
        },
      ]

      mockDoc.getPages.mockReturnValue(pages)
      mockDoc.getPageCount.mockReturnValue(3)

      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Response 1',
            position: { page: 0, x: 50, y: 700, width: 200, height: 50 },
          },
          {
            fieldId: 'field-2',
            responseText: 'Response 2',
            position: { page: 0, x: 50, y: 600, width: 200, height: 50 },
          },
          {
            fieldId: 'field-3',
            responseText: 'Response 3',
            position: { page: 1, x: 50, y: 500, width: 200, height: 50 },
          },
          {
            fieldId: 'field-4',
            responseText: 'Response 4',
            position: { page: 2, x: 50, y: 400, width: 200, height: 50 },
          },
        ],
      }

      await generatePdfOutput(options)

      expect(pages[0].drawText).toHaveBeenCalledTimes(2)
      expect(pages[1].drawText).toHaveBeenCalledTimes(1)
      expect(pages[2].drawText).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should throw on invalid/corrupted original PDF', async () => {
      vi.mocked(PDFDocument.load).mockRejectedValue(new Error('Invalid PDF structure'))

      const originalPdf = Buffer.from('not-a-pdf')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [],
      }

      await expect(generatePdfOutput(options)).rejects.toThrow('Invalid PDF structure')
    })

    it('should throw on empty original PDF buffer', async () => {
      const originalPdf = Buffer.from('')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [],
      }

      await expect(generatePdfOutput(options)).rejects.toThrow(
        /empty|invalid|buffer/i
      )
    })

    it('should throw on response with page number exceeding document pages', async () => {
      mockDoc.getPageCount.mockReturnValue(2)

      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Invalid page',
            position: {
              page: 5, // Document only has 2 pages
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await expect(generatePdfOutput(options)).rejects.toThrow(
        /page.*out of range|invalid page/i
      )
    })

    it('should handle empty responses array (return original unchanged)', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [],
      }

      const result = await generatePdfOutput(options)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(mockPage.drawText).not.toHaveBeenCalled()
      expect(mockDoc.save).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle long text that exceeds field width (wrapping)', async () => {
      mockFont.widthOfTextAtSize.mockImplementation((text: string, size: number) => {
        return text.length * 6 // Simulate text width calculation
      })

      const originalPdf = Buffer.from('mock-pdf-content')
      const longText = 'This is a very long response text that will definitely exceed the field width and needs to be wrapped to multiple lines'
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: longText,
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200, // Narrow width that will require wrapping
              height: 100,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      // Should call drawText multiple times for wrapped lines
      expect(mockPage.drawText).toHaveBeenCalled()
      // Verify that text wrapping occurred (multiple drawText calls)
      const callCount = mockPage.drawText.mock.calls.length
      expect(callCount).toBeGreaterThan(1)
    })

    it('should handle special characters in response text', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const specialCharsText = 'Response with special chars: @#$%^&*()[]{}|\\<>?/~`'
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: specialCharsText,
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      expect(mockPage.drawText).toHaveBeenCalledWith(
        specialCharsText,
        expect.any(Object)
      )
    })

    it('should handle unicode characters in response text', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const unicodeText = 'Response with unicode: 你好 мир 🌟 café'
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: unicodeText,
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      expect(mockPage.drawText).toHaveBeenCalledWith(
        unicodeText,
        expect.any(Object)
      )
    })

    it('should handle empty string response text', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: '',
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      // Should still work, just not draw anything visible
      expect(mockDoc.save).toHaveBeenCalled()
    })

    it('should handle zero-width or zero-height field positions', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test',
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 0,
              height: 0,
            },
          },
        ],
      }

      await expect(generatePdfOutput(options)).rejects.toThrow(
        /invalid.*width|invalid.*height|dimension/i
      )
    })

    it('should handle negative coordinates', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test',
            position: {
              page: 0,
              x: -50,
              y: -100,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await expect(generatePdfOutput(options)).rejects.toThrow(
        /invalid.*coordinate|negative/i
      )
    })

    it('should preserve original PDF metadata', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test Response',
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
            },
          },
        ],
      }

      await generatePdfOutput(options)

      // Verify that we loaded the original PDF (preserving its metadata)
      expect(PDFDocument.load).toHaveBeenCalledWith(originalPdf)
      // And saved it (with modifications)
      expect(mockDoc.save).toHaveBeenCalled()
    })
  })

  describe('Type Validation', () => {
    it('should accept valid PdfOutputOptions', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test',
            position: {
              page: 0,
              x: 100,
              y: 500,
              width: 200,
              height: 50,
              fontSize: 12,
            },
          },
        ],
      }

      const result = await generatePdfOutput(options)

      expect(result).toHaveProperty('buffer')
      expect(result).toHaveProperty('pageCount')
    })

    it('should return PdfOutputResult with correct structure', async () => {
      const originalPdf = Buffer.from('mock-pdf-content')
      const options: PdfOutputOptions = {
        originalPdf,
        responses: [],
      }

      const result: PdfOutputResult = await generatePdfOutput(options)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(typeof result.pageCount).toBe('number')
      expect(result.pageCount).toBeGreaterThan(0)
    })
  })
})
