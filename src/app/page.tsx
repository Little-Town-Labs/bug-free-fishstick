import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Brain,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Upload,
  PenTool,
  Send,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand">
              <FileText className="size-4 text-brand-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              TTS RFP Automator
            </span>
          </div>

          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button
                  size="sm"
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  Get Started
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-16">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.795_0.184_86.047/0.15),transparent)]" />
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-24 pt-24 sm:pb-32 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mb-6 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand">
              <Zap className="size-3.5" />
              AI-Powered RFP Automation
            </div>

            <h1 className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Respond to RFPs{" "}
              <span className="bg-gradient-to-r from-brand to-[oklch(0.7_0.2_50)] bg-clip-text text-transparent">
                10x faster
              </span>{" "}
              with AI
            </h1>

            <p className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Upload your RFP documents and let AI generate accurate, contextual
              responses. Review, refine, and finalize — all in one platform.
            </p>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button
                    size="lg"
                    className="bg-brand text-brand-foreground hover:bg-brand/90 h-12 px-8 text-base"
                  >
                    Start Automating
                    <ArrowRight className="size-4" />
                  </Button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                    Sign In
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Button
                  size="lg"
                  className="bg-brand text-brand-foreground hover:bg-brand/90 h-12 px-8 text-base"
                  asChild
                >
                  <Link href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </SignedIn>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-t border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to win more bids
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From document analysis to final submission, streamline your entire
              RFP workflow.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Brain,
                title: "AI-Powered Responses",
                description:
                  "Generate contextual answers using your knowledge base and past submissions.",
              },
              {
                icon: FileText,
                title: "Document Analysis",
                description:
                  "Upload PDFs and let AI extract questions, requirements, and compliance needs.",
              },
              {
                icon: Shield,
                title: "Review & Approval",
                description:
                  "Built-in workflow for team review, approval, and version tracking.",
              },
              {
                icon: Zap,
                title: "Learn & Improve",
                description:
                  "The system learns from approved responses to get smarter over time.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border/60 bg-card p-6 transition-all hover:border-brand/40 hover:shadow-md"
              >
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps to faster proposals
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Go from raw RFP document to polished response in minutes, not
              days.
            </p>
          </div>

          <div className="grid gap-12 sm:grid-cols-3">
            {[
              {
                step: "01",
                icon: Upload,
                title: "Upload",
                description:
                  "Drop your RFP document and let AI parse every question and requirement automatically.",
              },
              {
                step: "02",
                icon: PenTool,
                title: "Review & Edit",
                description:
                  "AI generates draft responses. Review each answer, edit where needed, and approve.",
              },
              {
                step: "03",
                icon: Send,
                title: "Finalize & Submit",
                description:
                  "Route through approval workflow, finalize the document, and export your response.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mb-4 text-5xl font-black text-brand/20">
                  {item.step}
                </div>
                <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <item.icon className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="border-t border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Built for proposal teams
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Stop copying and pasting from old proposals. Let AI handle the
                heavy lifting while your team focuses on strategy.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "Reduce response time by up to 80%",
                  "Consistent, on-brand answers every time",
                  "Knowledge base grows with every RFP",
                  "Role-based access and approval workflows",
                  "Full version history and audit trail",
                ].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" />
                    <span className="text-sm leading-relaxed">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">RFP-2024-0847</span>
                  <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Approved
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-brand" />
                  <span className="text-sm font-medium">RFP-2024-0912</span>
                  <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    In Review
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">RFP-2024-0963</span>
                  <span className="ml-auto rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    Processing
                  </span>
                </div>
                <div className="mt-6 rounded-lg bg-muted p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Completion Progress
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div className="h-full w-[78%] rounded-full bg-brand" />
                  </div>
                  <div className="mt-1 text-right text-xs text-muted-foreground">
                    78% complete
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-2xl bg-[oklch(0.15_0_0)] px-8 py-16 text-center sm:px-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,oklch(0.795_0.184_86.047/0.2),transparent)]" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to automate your RFP responses?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
                Join teams that are winning more bids in less time. Get started
                in minutes.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <SignedOut>
                  <SignUpButton mode="modal">
                    <Button
                      size="lg"
                      className="bg-brand text-brand-foreground hover:bg-brand/90 h-12 px-8 text-base"
                    >
                      Get Started Free
                      <ArrowRight className="size-4" />
                    </Button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <Button
                    size="lg"
                    className="bg-brand text-brand-foreground hover:bg-brand/90 h-12 px-8 text-base"
                    asChild
                  >
                    <Link href="/dashboard">
                      Go to Dashboard
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </SignedIn>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex size-6 items-center justify-center rounded bg-brand">
              <FileText className="size-3 text-brand-foreground" />
            </div>
            TTS RFP Automator
          </div>
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TTS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
