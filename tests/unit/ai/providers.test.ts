import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLanguageModel } from '@/lib/ai/providers'
import type { ProviderConfig } from '@/lib/ai/providers'

// Mock AI SDK modules
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(),
}))

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

describe('LLM Provider Abstraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.AZURE_API_KEY
    delete process.env.AZURE_OPENAI_ENDPOINT
  })

  describe('getLanguageModel', () => {
    it('should return Claude model for claude provider', () => {
      const mockModel = { type: 'claude-model' }
      const mockAnthropic = vi.fn(() => mockModel)
      vi.mocked(createAnthropic).mockReturnValue(mockAnthropic as never)

      const config: ProviderConfig = {
        provider: 'claude',
        apiKey: 'test-claude-key',
      }

      const model = getLanguageModel(config)

      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: 'test-claude-key',
      })
      expect(mockAnthropic).toHaveBeenCalledWith('claude-sonnet-4-6')
      expect(model).toBe(mockModel)
    })

    it('should return OpenAI model for openai provider', () => {
      const mockModel = { type: 'openai-model' }
      const mockOpenAI = vi.fn(() => mockModel)
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)

      const config: ProviderConfig = {
        provider: 'openai',
        apiKey: 'test-openai-key',
      }

      const model = getLanguageModel(config)

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-openai-key',
      })
      expect(mockOpenAI).toHaveBeenCalledWith('gpt-4o')
      expect(model).toBe(mockModel)
    })

    it('should return Azure OpenAI model for azure provider', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
      const mockModel = { type: 'azure-model' }
      const mockAzure = vi.fn(() => mockModel)
      vi.mocked(createOpenAI).mockReturnValue(mockAzure as never)

      const config: ProviderConfig = {
        provider: 'azure',
        apiKey: 'test-azure-key',
      }

      const model = getLanguageModel(config)

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-azure-key',
        baseURL: 'https://test.openai.azure.com',
      })
      expect(mockAzure).toHaveBeenCalledWith('gpt-4o')
      expect(model).toBe(mockModel)
    })

    it('should use environment variable for Claude when no API key provided', () => {
      process.env.ANTHROPIC_API_KEY = 'env-claude-key'
      const mockModel = { type: 'claude-model' }
      const mockAnthropic = vi.fn(() => mockModel)
      vi.mocked(createAnthropic).mockReturnValue(mockAnthropic as never)

      const config: ProviderConfig = {
        provider: 'claude',
      }

      getLanguageModel(config)

      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: 'env-claude-key',
      })
    })

    it('should use environment variable for OpenAI when no API key provided', () => {
      process.env.OPENAI_API_KEY = 'env-openai-key'
      const mockModel = { type: 'openai-model' }
      const mockOpenAI = vi.fn(() => mockModel)
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as never)

      const config: ProviderConfig = {
        provider: 'openai',
      }

      getLanguageModel(config)

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'env-openai-key',
      })
    })

    it('should use environment variable for Azure when no API key provided', () => {
      process.env.AZURE_API_KEY = 'env-azure-key'
      process.env.AZURE_OPENAI_ENDPOINT = 'https://env.openai.azure.com'
      const mockModel = { type: 'azure-model' }
      const mockAzure = vi.fn(() => mockModel)
      vi.mocked(createOpenAI).mockReturnValue(mockAzure as never)

      const config: ProviderConfig = {
        provider: 'azure',
      }

      getLanguageModel(config)

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'env-azure-key',
        baseURL: 'https://env.openai.azure.com',
      })
    })

    it('should throw error for unknown provider', () => {
      const config = {
        provider: 'unknown-provider',
      } as unknown as ProviderConfig

      expect(() => getLanguageModel(config)).toThrow('Unknown LLM provider: unknown-provider')
    })

    it('should prefer tenant API key over environment variable', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key'
      const mockModel = { type: 'claude-model' }
      const mockAnthropic = vi.fn(() => mockModel)
      vi.mocked(createAnthropic).mockReturnValue(mockAnthropic as never)

      const config: ProviderConfig = {
        provider: 'claude',
        apiKey: 'tenant-key',
      }

      getLanguageModel(config)

      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: 'tenant-key',
      })
    })
  })
})
