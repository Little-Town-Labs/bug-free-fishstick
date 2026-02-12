'use client'

import { llmProviders } from '@/lib/db/schema'
import type { LlmProvider } from '@/lib/db/schema'

interface LlmProviderSelectorProps {
  value: LlmProvider
  onChange: (provider: LlmProvider) => void
  disabled?: boolean
}

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  claude: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  azure: 'Azure OpenAI',
}

export function LlmProviderSelector({ value, onChange, disabled }: LlmProviderSelectorProps) {
  return (
    <select
      data-testid="llm-provider-selector"
      value={value}
      onChange={(e) => onChange(e.target.value as LlmProvider)}
      disabled={disabled}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {llmProviders.map((p) => (
        <option key={p} value={p}>
          {PROVIDER_LABELS[p]}
        </option>
      ))}
    </select>
  )
}
