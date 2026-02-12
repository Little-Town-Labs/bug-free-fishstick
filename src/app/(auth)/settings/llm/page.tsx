import { SettingsForm } from '@/components/settings/SettingsForm'
import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { headers } from 'next/headers'

export default async function LlmSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  let initialSettings = {
    llmProvider: 'claude' as const,
    llmApiKeyConfigured: false,
    openaiApiKeyConfigured: false,
    anthropicApiKeyConfigured: false,
    confidenceThreshold: 0.7,
    autoLearnEnabled: true,
  }

  if (context) {
    try {
      const headersList = await headers()
      const host = headersList.get('host') ?? ''
      const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
      const res = await fetch(`${protocol}://${host}/api/settings`, {
        headers: { cookie: headersList.get('cookie') ?? '' },
      })
      if (res.ok) {
        const data = await res.json()
        const s = data.settings
        initialSettings = {
          llmProvider: s.llmProvider,
          llmApiKeyConfigured: s.llmApiKeyConfigured,
          openaiApiKeyConfigured: s.openaiApiKeyConfigured ?? false,
          anthropicApiKeyConfigured: s.anthropicApiKeyConfigured ?? false,
          confidenceThreshold: s.confidenceThreshold,
          autoLearnEnabled: s.autoLearnEnabled,
        }
      }
    } catch {
      // fall through to defaults
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">LLM Configuration</h1>
      <SettingsForm initialSettings={initialSettings} isAdmin={admin} />
    </div>
  )
}
