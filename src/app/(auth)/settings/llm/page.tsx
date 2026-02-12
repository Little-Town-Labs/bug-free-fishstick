import { SettingsForm } from '@/components/settings/SettingsForm'

export default function LlmSettingsPage() {
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
        isAdmin={false}
      />
    </div>
  )
}
