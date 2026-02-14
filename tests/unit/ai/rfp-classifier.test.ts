import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModel: vi.fn().mockReturnValue('mock-model'),
}))

import { classifyRfp } from '@/lib/ai/agents/rfp-classifier'
import { generateObject } from 'ai'

const mockGenerateObject = vi.mocked(generateObject)

describe('classifyRfp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns classification from AI model', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        rfpType: 'technical',
        complexity: 'medium',
        industryTags: ['healthcare', 'government'],
      },
    } as any)

    const result = await classifyRfp({
      documentText: 'Technical requirements for a healthcare system...',
      fieldCount: 15,
      fieldTypes: ['text', 'paragraph', 'checkbox'],
      providerConfig: { provider: 'claude' },
    })

    expect(result).toEqual({
      rfpType: 'technical',
      complexity: 'medium',
      industryTags: ['healthcare', 'government'],
    })
    expect(mockGenerateObject).toHaveBeenCalledOnce()
  })

  it('truncates document text to 2000 chars in prompt', async () => {
    const longText = 'A'.repeat(5000)
    mockGenerateObject.mockResolvedValueOnce({
      object: { rfpType: 'mixed', complexity: 'complex', industryTags: [] },
    } as any)

    await classifyRfp({
      documentText: longText,
      fieldCount: 50,
      fieldTypes: ['text'],
      providerConfig: { provider: 'claude' },
    })

    const call = mockGenerateObject.mock.calls[0]![0]
    expect((call as any).prompt).toContain('A'.repeat(2000))
    expect((call as any).prompt).not.toContain('A'.repeat(2001))
  })

  it('deduplicates field types in prompt', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { rfpType: 'commercial', complexity: 'simple', industryTags: ['fintech'] },
    } as any)

    await classifyRfp({
      documentText: 'Pricing document',
      fieldCount: 5,
      fieldTypes: ['text', 'text', 'number', 'text'],
      providerConfig: { provider: 'claude' },
    })

    const call = mockGenerateObject.mock.calls[0]![0]
    expect((call as any).prompt).toContain('text, number')
  })
})
