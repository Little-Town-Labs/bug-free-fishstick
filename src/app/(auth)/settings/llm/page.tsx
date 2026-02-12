import { SettingsForm } from '@/components/settings/SettingsForm'
import { getAuthContext } from '@/lib/utils/auth'
import { isAdmin } from '@/lib/utils/auth'

export default async function LlmSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">LLM Configuration</h1>
      <SettingsForm
        initialSettings={{
          llmProvider: 'claude',
          llmApiKeyConfigured: false,
          confidenceThreshold: 0.7,
          autoLearnEnabled: true,
        }}
        isAdmin={admin}
      />
    </div>
  )
}
