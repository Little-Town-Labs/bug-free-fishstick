import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the docx library
vi.mock('docx', () => ({
  Document: vi.fn(),
  Packer: {
    toBuffer: vi.fn(),
  },
  Paragraph: vi.fn(),
  TextRun: vi.fn(),
}))

import { Document, Packer } from 'docx'
import { generateWordOutput } from '@/lib/documents/word-output'
import type { WordOutputOptions, WordOutputResult } from '@/lib/documents/word-output'

describe('generateWordOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Happy path', () => {
    it('should generate a Word document with responses inserted', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-docx')
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test response text',
            position: {
              page: 1,
              x: 100,
              y: 200,
              width: 400,
              height: 50,
            },
          },
        ],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(Buffer.from('mock-docx-output'))

      // Act
      const result: WordOutputResult = await generateWordOutput(options)

      // Assert
      expect(result).toBeDefined()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(Document).toHaveBeenCalled()
      expect(Packer.toBuffer).toHaveBeenCalled()
    })

    it('should return a Buffer containing the .docx output', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-docx')
      const mockOutputBuffer = Buffer.from('mock-generated-docx')
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Response',
            position: {
              page: 1,
              x: 0,
              y: 0,
              width: 100,
              height: 20,
            },
          },
        ],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(mockOutputBuffer)

      // Act
      const result = await generateWordOutput(options)

      // Assert
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.buffer).toBe(mockOutputBuffer)
    })

    it('should insert multiple responses into the document', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-docx')
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'First response',
            position: {
              page: 1,
              x: 100,
              y: 100,
              width: 300,
              height: 30,
            },
          },
          {
            fieldId: 'field-2',
            responseText: 'Second response',
            position: {
              page: 2,
              x: 150,
              y: 200,
              width: 350,
              height: 40,
            },
          },
          {
            fieldId: 'field-3',
            responseText: 'Third response',
            position: {
              page: 3,
              x: 200,
              y: 300,
              width: 400,
              height: 50,
            },
          },
        ],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(Buffer.from('mock-multi-response-output'))

      // Act
      const result = await generateWordOutput(options)

      // Assert
      expect(result).toBeDefined()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(Document).toHaveBeenCalled()
      expect(Packer.toBuffer).toHaveBeenCalled()
    })

    it('should preserve original document structure when adding responses', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-with-structure')
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Inserted text',
            position: {
              page: 1,
              x: 100,
              y: 100,
              width: 200,
              height: 25,
            },
          },
        ],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(Buffer.from('mock-preserved-structure'))

      // Act
      const result = await generateWordOutput(options)

      // Assert
      expect(result).toBeDefined()
      expect(result.buffer).toBeInstanceOf(Buffer)
      // Verify that Document was called (indicating structure processing)
      expect(Document).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should throw on invalid/corrupted original DOCX buffer', async () => {
      // Arrange
      const corruptedBuffer = Buffer.from('not-a-valid-docx')
      const options: WordOutputOptions = {
        originalDocx: corruptedBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test',
            position: {
              page: 1,
              x: 0,
              y: 0,
              width: 100,
              height: 20,
            },
          },
        ],
      }

      // Mock Document constructor to throw on corrupted input
      vi.mocked(Document).mockImplementationOnce(() => {
        throw new Error('Invalid DOCX format')
      })

      // Act & Assert
      await expect(generateWordOutput(options)).rejects.toThrow('Invalid DOCX format')
    })

    it('should throw on empty original DOCX buffer', async () => {
      // Arrange
      const emptyBuffer = Buffer.from([])
      const options: WordOutputOptions = {
        originalDocx: emptyBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: 'Test',
            position: {
              page: 1,
              x: 0,
              y: 0,
              width: 100,
              height: 20,
            },
          },
        ],
      }

      // Act & Assert
      await expect(generateWordOutput(options)).rejects.toThrow()
    })

    it('should handle empty responses array (return original unchanged)', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-docx')
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(mockDocxBuffer)

      // Act
      const result = await generateWordOutput(options)

      // Assert
      expect(result).toBeDefined()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.buffer).toBe(mockDocxBuffer)
    })
  })

  describe('Edge cases', () => {
    it('should handle long text responses', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-docx')
      const longText = 'A'.repeat(5000) // 5000 character response
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: longText,
            position: {
              page: 1,
              x: 100,
              y: 100,
              width: 500,
              height: 200,
            },
          },
        ],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(Buffer.from('mock-long-text-output'))

      // Act
      const result = await generateWordOutput(options)

      // Assert
      expect(result).toBeDefined()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(Document).toHaveBeenCalled()
    })

    it('should handle special characters in response text', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-docx')
      const specialCharsText = 'Test with special chars: @#$%^&*()_+{}[]|\\:";\'<>?,./\n\t\r'
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [
          {
            fieldId: 'field-1',
            responseText: specialCharsText,
            position: {
              page: 1,
              x: 100,
              y: 100,
              width: 400,
              height: 50,
            },
          },
        ],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(Buffer.from('mock-special-chars-output'))

      // Act
      const result = await generateWordOutput(options)

      // Assert
      expect(result).toBeDefined()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(Document).toHaveBeenCalled()
    })

    it('should handle responses with different field types (text, paragraph, checkbox)', async () => {
      // Arrange
      const mockDocxBuffer = Buffer.from('mock-original-docx')
      const options: WordOutputOptions = {
        originalDocx: mockDocxBuffer,
        responses: [
          {
            fieldId: 'text-field',
            responseText: 'Short text',
            position: {
              page: 1,
              x: 100,
              y: 100,
              width: 200,
              height: 20,
            },
          },
          {
            fieldId: 'paragraph-field',
            responseText: 'This is a longer paragraph response that spans multiple lines and contains more detailed information.',
            position: {
              page: 1,
              x: 100,
              y: 150,
              width: 400,
              height: 100,
            },
          },
          {
            fieldId: 'checkbox-field',
            responseText: '☑', // Checkbox marked
            position: {
              page: 2,
              x: 100,
              y: 100,
              width: 20,
              height: 20,
            },
          },
        ],
      }

      vi.mocked(Packer.toBuffer).mockResolvedValue(Buffer.from('mock-mixed-types-output'))

      // Act
      const result = await generateWordOutput(options)

      // Assert
      expect(result).toBeDefined()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(Document).toHaveBeenCalled()
      expect(Packer.toBuffer).toHaveBeenCalled()
    })
  })
})
