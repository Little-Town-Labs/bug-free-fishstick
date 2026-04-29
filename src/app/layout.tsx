import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/shared/Toaster'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const bricolageGrotesque = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '600', '800'],
})

const dmSans = DM_Sans({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'RocketRFP',
  description: 'AI-powered RFP response automation platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const content = (
    <html lang="en">
      <body
        className={`${bricolageGrotesque.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        <Toaster position="top-right" />
        <Analytics />
      </body>
    </html>
  )

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return content
  }

  return <ClerkProvider>{content}</ClerkProvider>
}
