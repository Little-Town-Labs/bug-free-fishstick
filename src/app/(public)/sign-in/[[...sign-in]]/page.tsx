import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { FileText } from 'lucide-react'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[oklch(0.15_0_0)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,oklch(0.795_0.184_86.047/0.2),transparent)]" />
        <div className="relative flex flex-col justify-between p-12 text-white">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <FileText className="size-4 text-brand-foreground" />
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">RFP Automator</span>
          </Link>
          <div>
            <h1 className="font-display text-4xl font-bold mb-4">Automate your RFP workflow</h1>
            <p className="text-lg text-white/80">
              Generate accurate responses 10x faster with AI-powered automation.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Sign In Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <SignIn
            appearance={{
              variables: {
                colorPrimary: 'oklch(0.25 0.055 260)',
                colorBackground: 'oklch(0.985 0.005 90)',
                colorText: 'oklch(0.145 0 0)',
                colorTextSecondary: 'oklch(0.556 0 0)',
                fontFamily: 'var(--font-geist-sans)',
                borderRadius: '0.625rem',
              },
              elements: {
                formButtonPrimary:
                  'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                card: 'shadow-none',
                headerTitle: 'font-display font-bold text-2xl',
                headerSubtitle: 'text-muted-foreground',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
