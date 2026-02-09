import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AI SDK and providers before importing the module under test
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModel: vi.fn().mockReturnValue({ type: 'mock-model' }),
}))

import { generateObject } from 'ai'
import { getLanguageModel } from '@/lib/ai/providers'
import { generateResponses } from '@/lib/ai/agents/response-generator'
import type { GenerateResponsesInput, GenerateResponsesResult } from '@/lib/ai/agents/response-generator'

describe('response-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateResponses', () => {
    describe('happy path', () => {
      it('should generate responses for multiple fields with knowledge context', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'What is your company name?' },
            { id: 'field-2', type: 'paragraph', question: 'Describe your security practices.' },
          ],
          knowledgeContext: [
            { content: 'Company name: Acme Corp', relevanceScore: 0.95, source: 'company_info' },
            { content: 'We use SOC 2 Type II compliance and encryption', relevanceScore: 0.88, source: 'security_doc' },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Acme Corp', confidenceScore: 0.95, sources: ['company_info'] },
              { fieldId: 'field-2', responseText: 'We maintain SOC 2 Type II compliance and use end-to-end encryption.', confidenceScore: 0.88, sources: ['security_doc'] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        expect(result.responses).toHaveLength(2)
        expect(result.responses[0].fieldId).toBe('field-1')
        expect(result.responses[0].responseText).toBe('Acme Corp')
        expect(result.responses[1].fieldId).toBe('field-2')
        expect(result.responses[1].responseText).toContain('SOC 2')
      })

      it('should return confidence scores (0-1) for each response', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Company name?' },
          ],
          knowledgeContext: [
            { content: 'Acme Corp', relevanceScore: 0.92, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Acme Corp', confidenceScore: 0.92, sources: ['source1'] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        expect(result.responses[0].confidenceScore).toBe(0.92)
        expect(result.responses[0].confidenceScore).toBeGreaterThanOrEqual(0)
        expect(result.responses[0].confidenceScore).toBeLessThanOrEqual(1)
      })

      it('should mark high-confidence responses as auto_filled', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Company name?' },
          ],
          knowledgeContext: [
            { content: 'Acme Corp', relevanceScore: 0.95, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
          confidenceThreshold: 0.7,
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Acme Corp', confidenceScore: 0.95, sources: ['source1'] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        expect(result.responses[0].status).toBe('auto_filled')
        expect(result.responses[0].confidenceScore).toBeGreaterThan(0.7)
      })

      it('should mark low-confidence responses as needs_input with [NEEDS INPUT] placeholder', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Obscure question?' },
          ],
          knowledgeContext: [
            { content: 'Some vaguely related content', relevanceScore: 0.3, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
          confidenceThreshold: 0.7,
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: '[NEEDS INPUT: No matching knowledge found]', confidenceScore: 0.3, sources: [] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        expect(result.responses[0].status).toBe('needs_input')
        expect(result.responses[0].responseText).toContain('[NEEDS INPUT')
        expect(result.responses[0].confidenceScore).toBeLessThan(0.7)
      })

      it('should include source references for each response', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Company name?' },
          ],
          knowledgeContext: [
            { content: 'Acme Corp from doc1', relevanceScore: 0.9, source: 'doc1' },
            { content: 'Acme Corp from doc2', relevanceScore: 0.85, source: 'doc2' },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Acme Corp', confidenceScore: 0.9, sources: ['doc1', 'doc2'] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        expect(result.responses[0].sources).toEqual(['doc1', 'doc2'])
        expect(result.responses[0].sources.length).toBeGreaterThan(0)
      })

      it('should call getLanguageModel with provided config', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Question?' },
          ],
          knowledgeContext: [
            { content: 'Answer', relevanceScore: 0.9, source: 'source1' },
          ],
          providerConfig: { provider: 'openai', apiKey: 'test-key' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Answer', confidenceScore: 0.9, sources: ['source1'] },
            ],
          },
        } as any)

        // Act
        await generateResponses(input)

        // Assert
        expect(getLanguageModel).toHaveBeenCalledWith({ provider: 'openai', apiKey: 'test-key' })
      })

      it('should generate short text for text/number/date fields, paragraphs for paragraph fields', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Company name?' },
            { id: 'field-2', type: 'number', question: 'Employee count?' },
            { id: 'field-3', type: 'date', question: 'Founded date?' },
            { id: 'field-4', type: 'paragraph', question: 'Describe your company?' },
          ],
          knowledgeContext: [
            { content: 'Acme Corp, 500 employees, founded 2010', relevanceScore: 0.9, source: 'company_info' },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Acme Corp', confidenceScore: 0.95, sources: ['company_info'] },
              { fieldId: 'field-2', responseText: '500', confidenceScore: 0.9, sources: ['company_info'] },
              { fieldId: 'field-3', responseText: '2010-01-01', confidenceScore: 0.85, sources: ['company_info'] },
              { fieldId: 'field-4', responseText: 'Acme Corp is a leading technology company founded in 2010 with 500 employees dedicated to innovation and excellence.', confidenceScore: 0.88, sources: ['company_info'] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        // Text field should be short
        expect(result.responses[0].responseText.length).toBeLessThan(50)
        // Number field should be numeric
        expect(result.responses[1].responseText).toBe('500')
        // Date field should be a date format
        expect(result.responses[2].responseText).toMatch(/\d{4}-\d{2}-\d{2}/)
        // Paragraph field should be longer
        expect(result.responses[3].responseText.length).toBeGreaterThan(50)
      })
    })

    describe('error handling', () => {
      it('should throw on empty fields array', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [],
          knowledgeContext: [
            { content: 'Some content', relevanceScore: 0.9, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
        }

        // Act & Assert
        await expect(generateResponses(input)).rejects.toThrow('Fields array cannot be empty')
      })

      it('should handle AI model errors gracefully', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Question?' },
          ],
          knowledgeContext: [
            { content: 'Content', relevanceScore: 0.9, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockRejectedValue(new Error('API rate limit exceeded'))

        // Act & Assert
        await expect(generateResponses(input)).rejects.toThrow('API rate limit exceeded')
      })

      it('should handle missing knowledge context (empty array — should produce low-confidence responses)', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Question?' },
          ],
          knowledgeContext: [],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: '[NEEDS INPUT: No knowledge context available]', confidenceScore: 0.0, sources: [] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        expect(result.responses[0].status).toBe('needs_input')
        expect(result.responses[0].confidenceScore).toBeLessThan(0.7)
        expect(result.responses[0].responseText).toContain('[NEEDS INPUT')
      })
    })

    describe('edge cases', () => {
      it('should use default confidence threshold of 0.7 when not specified', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Question?' },
          ],
          knowledgeContext: [
            { content: 'Answer', relevanceScore: 0.75, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
          // No confidenceThreshold specified
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Answer', confidenceScore: 0.75, sources: ['source1'] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        // 0.75 > 0.7 (default threshold), so should be auto_filled
        expect(result.responses[0].status).toBe('auto_filled')
      })

      it('should use custom confidence threshold when provided', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Question?' },
          ],
          knowledgeContext: [
            { content: 'Answer', relevanceScore: 0.75, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
          confidenceThreshold: 0.8, // Custom threshold
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: 'Answer', confidenceScore: 0.75, sources: ['source1'] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        // 0.75 < 0.8 (custom threshold), so should be needs_input
        expect(result.responses[0].status).toBe('needs_input')
      })

      it('should handle fields with no matching knowledge (all needs_input)', async () => {
        // Arrange
        const input: GenerateResponsesInput = {
          fields: [
            { id: 'field-1', type: 'text', question: 'Unrelated question 1?' },
            { id: 'field-2', type: 'text', question: 'Unrelated question 2?' },
          ],
          knowledgeContext: [
            { content: 'Completely unrelated content', relevanceScore: 0.1, source: 'source1' },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            responses: [
              { fieldId: 'field-1', responseText: '[NEEDS INPUT: No matching knowledge found]', confidenceScore: 0.1, sources: [] },
              { fieldId: 'field-2', responseText: '[NEEDS INPUT: No matching knowledge found]', confidenceScore: 0.1, sources: [] },
            ],
          },
        } as any)

        // Act
        const result = await generateResponses(input)

        // Assert
        expect(result.responses).toHaveLength(2)
        expect(result.responses.every(r => r.status === 'needs_input')).toBe(true)
        expect(result.responses.every(r => r.responseText.includes('[NEEDS INPUT'))).toBe(true)
        expect(result.responses.every(r => r.confidenceScore < 0.7)).toBe(true)
      })
    })
  })
})
