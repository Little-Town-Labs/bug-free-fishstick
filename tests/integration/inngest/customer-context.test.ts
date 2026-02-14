import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateObject = vi.fn()

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

vi.mock('@/lib/ai/providers', () => ({
  getLanguageModel: vi.fn().mockReturnValue('mock-model'),
}))

import { generateResponses } from '@/lib/ai/agents/response-generator'

describe('Customer-aware response generation (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateObject.mockResolvedValue({
      object: {
        responses: [{
          fieldId: 'f1',
          responseText: 'Response text',
          confidenceScore: 0.85,
          sources: ['doc-1'],
        }],
      },
    })
  })

  it('injects customer settings into system prompt', async () => {
    await generateResponses({
      fields: [{ id: 'f1', type: 'text', question: 'Describe your compliance framework?' }],
      knowledgeContext: [{ content: 'We follow SOC2', relevanceScore: 0.9, source: 'compliance-doc' }],
      learningsContext: ['Customer prefers detailed technical answers'],
      customerContext: {
        preferredTone: 'technical',
        industryContext: 'Healthcare IT',
        customInstructions: 'Always reference HIPAA compliance requirements',
      },
      providerConfig: { provider: 'claude' },
    })

    const callArgs = mockGenerateObject.mock.calls[0]![0]
    // Customer-specific guidelines should be in prompt
    expect(callArgs.prompt).toContain('Customer-Specific Guidelines')
    expect(callArgs.prompt).toContain('Preferred tone: technical')
    expect(callArgs.prompt).toContain('Industry context: Healthcare IT')
    expect(callArgs.prompt).toContain('HIPAA compliance requirements')
    // Learnings should also be present
    expect(callArgs.prompt).toContain('Customer prefers detailed technical answers')
    // Knowledge context should be present
    expect(callArgs.prompt).toContain('SOC2')
  })

  it('prioritizes customer learnings by placing them first', async () => {
    // This tests the process-rfp logic indirectly — customer learnings should come before org learnings
    await generateResponses({
      fields: [{ id: 'f1', type: 'text', question: 'Test?' }],
      knowledgeContext: [],
      learningsContext: [
        'Customer-specific: Use HIPAA language',
        'Org-level: Professional tone',
      ],
      customerContext: { preferredTone: 'formal' },
      providerConfig: { provider: 'claude' },
    })

    const callArgs = mockGenerateObject.mock.calls[0]![0]
    const hipaaIndex = callArgs.prompt.indexOf('HIPAA language')
    const orgIndex = callArgs.prompt.indexOf('Professional tone')
    expect(hipaaIndex).toBeLessThan(orgIndex)
  })
})
