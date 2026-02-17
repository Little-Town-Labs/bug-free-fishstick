'use client'

import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Building2,
  BookOpen,
  Library,
  BarChart3,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'RFPs', href: '/rfps/new', icon: FileText },
  { name: 'Customers', href: '/customers', icon: Building2 },
  { name: 'Knowledge', href: '/knowledge', icon: BookOpen },
  { name: 'Content Library', href: '/content-library', icon: Library },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2"
              onClick={() => setSidebarOpen(false)}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand">
                <FileText className="size-4 text-brand-foreground" />
              </div>
              <span className="font-display font-semibold text-sm tracking-tight">
                RFP Automator
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <OrganizationSwitcher
                hidePersonal
                afterCreateOrganizationUrl="/dashboard"
                afterSelectOrganizationUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: 'flex-1',
                    organizationSwitcherTrigger: 'w-full',
                  },
                }}
              />
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center border-b border-border bg-background px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="ml-2 font-display font-semibold text-sm">RFP Automator</span>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
