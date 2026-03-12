import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

// Mock the provider config
vi.mock('@/lib/ai/providers', () => ({
  getLanguageModel: vi.fn().mockReturnValue({ type: 'mock-model' }),
}))

import { generateObject } from 'ai'
import { getLanguageModel } from '@/lib/ai/providers'
import { checkQuality } from '@/lib/ai/agents/quality-checker'
import type { QualityCheckInput } from '@/lib/ai/agents/quality-checker'

describe('quality-checker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkQuality', () => {
    describe('Happy path', () => {
      it('should check quality of multiple responses and return results', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'What is your approach to project management?',
              fieldType: 'paragraph',
              responseText: 'We follow an agile methodology with two-week sprints, daily standups, and continuous integration.',
              confidenceScore: 0.85,
            },
            {
              fieldId: 'field-2',
              question: 'Project start date',
              fieldType: 'date',
              responseText: '2024-03-15',
              confidenceScore: 0.95,
            },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: true,
                adjustedConfidence: 0.88,
                issues: [],
                suggestion: undefined,
              },
              {
                fieldId: 'field-2',
                passed: true,
                adjustedConfidence: 0.95,
                issues: [],
                suggestion: undefined,
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results).toHaveLength(2)
        expect(result.results[0]!.fieldId).toBe('field-1')
        expect(result.results[1]!.fieldId).toBe('field-2')
        expect(generateObject).toHaveBeenCalledTimes(1)
      })

      it('should pass responses that are appropriate and accurate', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Company name',
              fieldType: 'text',
              responseText: 'Acme Corporation',
              confidenceScore: 0.98,
            },
          ],
          providerConfig: { provider: 'openai', apiKey: 'test-key' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: true,
                adjustedConfidence: 0.98,
                issues: [],
                suggestion: undefined,
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.passed).toBe(true)
        expect(result.results[0]!.issues).toEqual([])
      })

      it('should fail responses that don\'t match the field type', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Contract end date',
              fieldType: 'date',
              responseText: 'Sometime in Q4 2024, probably around the holidays',
              confidenceScore: 0.6,
            },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: false,
                adjustedConfidence: 0.2,
                issues: ['Response is not in date format (YYYY-MM-DD)'],
                suggestion: 'Convert to ISO date format or use [NEEDS INPUT]',
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.passed).toBe(false)
        expect(result.results[0]!.issues.length).toBeGreaterThan(0)
      })

      it('should return adjusted confidence scores after review', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Describe your team size',
              fieldType: 'paragraph',
              responseText: 'Our team consists of 15 engineers, 3 designers, and 2 product managers.',
              confidenceScore: 0.75,
            },
          ],
          providerConfig: { provider: 'azure' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: true,
                adjustedConfidence: 0.82,
                issues: [],
                suggestion: undefined,
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.adjustedConfidence).toBe(0.82)
        expect(result.results[0]!.adjustedConfidence).not.toBe(0.75)
      })

      it('should provide issue descriptions for failed checks', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'List all team members',
              fieldType: 'table',
              responseText: 'John, Jane, Bob',
              confidenceScore: 0.5,
            },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: false,
                adjustedConfidence: 0.3,
                issues: [
                  'Response is not in table format',
                  'Missing structured data (columns/rows)',
                ],
                suggestion: 'Format as a proper table with headers and rows',
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.issues).toContain('Response is not in table format')
        expect(result.results[0]!.issues).toContain('Missing structured data (columns/rows)')
      })

      it('should provide suggestions for improving failed responses', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Describe your quality assurance process',
              fieldType: 'paragraph',
              responseText: 'We test.',
              confidenceScore: 0.4,
            },
          ],
          providerConfig: { provider: 'openai' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: false,
                adjustedConfidence: 0.25,
                issues: ['Response too short for paragraph field', 'Lacks detail and specificity'],
                suggestion: 'Expand with details about testing methodology, tools, and processes',
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.suggestion).toBeDefined()
        expect(result.results[0]!.suggestion).toContain('Expand with details')
      })

      it('should call getLanguageModel with provided config', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Test question',
              fieldType: 'text',
              responseText: 'Test answer',
              confidenceScore: 0.9,
            },
          ],
          providerConfig: { provider: 'azure', apiKey: 'azure-key-123' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: true,
                adjustedConfidence: 0.9,
                issues: [],
                suggestion: undefined,
              },
            ],
          },
        } as never)

        await checkQuality(input)

        expect(getLanguageModel).toHaveBeenCalledWith({
          provider: 'azure',
          apiKey: 'azure-key-123',
        })
      })
    })

    describe('Error handling', () => {
      it('should throw on empty responses array', async () => {
        const input: QualityCheckInput = {
          responses: [],
          providerConfig: { provider: 'claude' },
        }

        await expect(checkQuality(input)).rejects.toThrow('No responses provided for quality check')
      })

      it('should handle AI model errors gracefully', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Test',
              fieldType: 'text',
              responseText: 'Answer',
              confidenceScore: 0.8,
            },
          ],
          providerConfig: { provider: 'openai' },
        }

        vi.mocked(generateObject).mockRejectedValue(new Error('AI model timeout'))

        await expect(checkQuality(input)).rejects.toThrow('AI model timeout')
      })

      it('should handle responses with missing fields', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Test question',
              fieldType: 'text',
              responseText: '',
              confidenceScore: 0.0,
            },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: false,
                adjustedConfidence: 0.0,
                issues: ['Response text is empty'],
                suggestion: 'Provide a valid response or use [NEEDS INPUT]',
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.passed).toBe(false)
        expect(result.results[0]!.issues).toContain('Response text is empty')
      })
    })

    describe('Edge cases', () => {
      it('should handle [NEEDS INPUT] placeholder responses', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'What is your budget range?',
              fieldType: 'text',
              responseText: '[NEEDS INPUT]',
              confidenceScore: 0.0,
            },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: true,
                adjustedConfidence: 0.0,
                issues: [],
                suggestion: undefined,
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.passed).toBe(true)
        expect(result.results[0]!).not.toHaveProperty('responseText') // Should pass through without modification
      })

      it('should handle responses with very high confidence that still have issues', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Number of employees',
              fieldType: 'number',
              responseText: 'approximately 150-200 staff members',
              confidenceScore: 0.95,
            },
          ],
          providerConfig: { provider: 'openai' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: false,
                adjustedConfidence: 0.4,
                issues: ['Response should be a numeric value, not a range or text'],
                suggestion: 'Use a single number or [NEEDS INPUT] if uncertain',
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        expect(result.results[0]!.passed).toBe(false)
        expect(result.results[0]!.adjustedConfidence).toBeLessThan(0.95)
      })

      it('should return 100% pass rate when all responses are high quality', async () => {
        const input: QualityCheckInput = {
          responses: [
            {
              fieldId: 'field-1',
              question: 'Company name',
              fieldType: 'text',
              responseText: 'Acme Inc.',
              confidenceScore: 0.99,
            },
            {
              fieldId: 'field-2',
              question: 'Years in business',
              fieldType: 'number',
              responseText: '15',
              confidenceScore: 0.98,
            },
            {
              fieldId: 'field-3',
              question: 'Founded date',
              fieldType: 'date',
              responseText: '2009-01-15',
              confidenceScore: 0.97,
            },
          ],
          providerConfig: { provider: 'claude' },
        }

        vi.mocked(generateObject).mockResolvedValue({
          object: {
            results: [
              {
                fieldId: 'field-1',
                passed: true,
                adjustedConfidence: 0.99,
                issues: [],
                suggestion: undefined,
              },
              {
                fieldId: 'field-2',
                passed: true,
                adjustedConfidence: 0.98,
                issues: [],
                suggestion: undefined,
              },
              {
                fieldId: 'field-3',
                passed: true,
                adjustedConfidence: 0.97,
                issues: [],
                suggestion: undefined,
              },
            ],
          },
        } as never)

        const result = await checkQuality(input)

        const allPassed = result.results.every((r) => r.passed)
        expect(allPassed).toBe(true)
        expect(result.results).toHaveLength(3)
      })
    })
  })
})
