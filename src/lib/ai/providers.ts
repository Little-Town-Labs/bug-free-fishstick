import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { db } from '@/lib/db'
import { tenantSettings } from '@/lib/db/schema'
import { decrypt } from '@/lib/services/encryption'
import { eq } from 'drizzle-orm'

export type LlmProvider = 'claude' | 'openai' | 'azure'

export interface ProviderConfig {
  provider: LlmProvider
  apiKey?: string
}

export function getLanguageModel(config: ProviderConfig): LanguageModel {
  switch (config.provider) {
    case 'claude': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      })
      return anthropic('claude-sonnet-4-6')
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      })
      return openai('gpt-4o')
    }
    case 'azure': {
      const azure = createOpenAI({
        apiKey: config.apiKey || process.env.AZURE_API_KEY,
        baseURL: process.env.AZURE_OPENAI_ENDPOINT,
      })
      return azure('gpt-4o')
    }
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`)
  }
}

export async function getLanguageModelForOrg(orgId: string): Promise<LanguageModel> {
  const [row] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, orgId))
    .limit(1)

  const provider = (row?.llmProvider ?? 'claude') as LlmProvider
  const encryptedKey =
    provider === 'claude'
      ? (row?.anthropicApiKeyEncrypted ?? row?.llmApiKeyEncrypted)
      : provider === 'openai'
        ? (row?.openaiApiKeyEncrypted ?? row?.llmApiKeyEncrypted)
        : row?.llmApiKeyEncrypted
  const apiKey = encryptedKey ? decrypt(encryptedKey) : undefined

  return getLanguageModel({ provider, apiKey })
}
