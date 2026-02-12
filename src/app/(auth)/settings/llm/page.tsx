import { SettingsForm } from '@/components/settings/SettingsForm'
import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { tenantSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function LlmSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  let llmProvider = tenantSettings.llmProvider.default as 'claude' | 'openai' | 'azure'
  let llmApiKeyConfigured = false
  let openaiApiKeyConfigured = false
  let anthropicApiKeyConfigured = false
  let confidenceThreshold = 0.7
  let autoLearnEnabled = true

  if (context) {
    const [row] = await db
      .select({
        llmProvider: tenantSettings.llmProvider,
        llmApiKeyEncrypted: tenantSettings.llmApiKeyEncrypted,
        openaiApiKeyEncrypted: tenantSettings.openaiApiKeyEncrypted,
        anthropicApiKeyEncrypted: tenantSettings.anthropicApiKeyEncrypted,
        confidenceThreshold: tenantSettings.confidenceThreshold,
        autoLearnEnabled: tenantSettings.autoLearnEnabled,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, context.orgId))
      .limit(1)

    if (row) {
      llmProvider = row.llmProvider
      llmApiKeyConfigured = row.llmApiKeyEncrypted !== null
      openaiApiKeyConfigured = row.openaiApiKeyEncrypted !== null
      anthropicApiKeyConfigured = row.anthropicApiKeyEncrypted !== null
      confidenceThreshold = row.confidenceThreshold
      autoLearnEnabled = row.autoLearnEnabled
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">LLM Configuration</h1>
      <SettingsForm
        initialSettings={{
          llmProvider,
          llmApiKeyConfigured,
          openaiApiKeyConfigured,
          anthropicApiKeyConfigured,
          confidenceThreshold,
          autoLearnEnabled,
        }}
        isAdmin={admin}
      />
    </div>
  )
}
