import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-sm">
              RFP Automator
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/rfps/new" className="text-muted-foreground hover:text-foreground transition-colors">
                RFPs
              </Link>
              <Link href="/customers" className="text-muted-foreground hover:text-foreground transition-colors">
                Customers
              </Link>
              <Link href="/knowledge" className="text-muted-foreground hover:text-foreground transition-colors">
                Knowledge
              </Link>
              <Link href="/content-library" className="text-muted-foreground hover:text-foreground transition-colors">
                Content Library
              </Link>
              <Link href="/analytics" className="text-muted-foreground hover:text-foreground transition-colors">
                Analytics
              </Link>
              <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher
              hidePersonal
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
            />
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
