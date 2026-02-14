import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateObject = vi.fn()

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModel: vi.fn().mockReturnValue('mock-model'),
}))

import { generateResponses } from '@/lib/ai/agents/response-generator'

describe('generateResponses with customerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateObject.mockResolvedValue({
      object: {
        responses: [{
          fieldId: 'f1',
          responseText: 'Test response',
          confidenceScore: 0.9,
          sources: ['kb-1'],
        }],
      },
    })
  })

  it('includes customerContext in prompt when provided', async () => {
    await generateResponses({
      fields: [{ id: 'f1', type: 'text', question: 'Company name?' }],
      knowledgeContext: [],
      providerConfig: { provider: 'claude' },
      customerContext: {
        preferredTone: 'technical',
        industryContext: 'Healthcare IT',
        customInstructions: 'Always mention HIPAA compliance',
      },
    })

    const callArgs = mockGenerateObject.mock.calls[0]![0]
    expect(callArgs.prompt).toContain('technical')
    expect(callArgs.prompt).toContain('Healthcare IT')
    expect(callArgs.prompt).toContain('HIPAA compliance')
  })

  it('works without customerContext (backward compatible)', async () => {
    await generateResponses({
      fields: [{ id: 'f1', type: 'text', question: 'Company name?' }],
      knowledgeContext: [],
      providerConfig: { provider: 'claude' },
    })

    const callArgs = mockGenerateObject.mock.calls[0]![0]
    expect(callArgs.prompt).not.toContain('Customer-Specific')
  })

  it('includes all three customerContext fields in prompt', async () => {
    await generateResponses({
      fields: [{ id: 'f1', type: 'text', question: 'Test?' }],
      knowledgeContext: [],
      providerConfig: { provider: 'claude' },
      customerContext: {
        preferredTone: 'casual',
        industryContext: 'Fintech',
        customInstructions: 'Use simple language',
      },
    })

    const callArgs = mockGenerateObject.mock.calls[0]![0]
    expect(callArgs.prompt).toContain('casual')
    expect(callArgs.prompt).toContain('Fintech')
    expect(callArgs.prompt).toContain('Use simple language')
  })
})
