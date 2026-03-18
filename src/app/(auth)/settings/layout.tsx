'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

const tabs = [
  { label: 'General', href: '/settings' },
  { label: 'Users', href: '/settings/users' },
  { label: 'LLM Configuration', href: '/settings/llm' },
  { label: 'Rate Card', href: '/settings/rate-card' },
  { label: 'Company Profile', href: '/settings/company-profile' },
  { label: 'Proposal Templates', href: '/settings/proposal-templates' },
  // Integrations hidden until client requests it
  // { label: 'Integrations', href: '/settings/integrations' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isSubPage = pathname !== '/settings'

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        {isSubPage && (
          <Link
            href="/settings"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <h1 className="font-display text-3xl font-bold">Settings</h1>
      </div>

      <nav className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:text-foreground',
              pathname === tab.href
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}
