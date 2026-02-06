# RFP Automator

> Multi-tenant SaaS platform that automates RFP completion using AI agents and intelligent document processing

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-80%25-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## Overview

RFP Automator is an AI-powered platform that dramatically reduces the manual effort marketing and sales teams spend responding to RFPs (Requests for Proposals). By leveraging multi-agent AI systems, customer-specific knowledge bases, and intelligent document processing, the platform can automatically complete 60-80% of RFP fields while maintaining high accuracy and document formatting integrity.

The solution addresses a critical business need: teams currently spend significant time manually completing repetitive RFPs, which is error-prone and diverts skilled personnel from higher-value activities. RFP Automator transforms this process through intelligent automation while maintaining human oversight for complex decisions.

## Features

- **Intelligent Document Ingestion**: Automatically parse PDF and Word RFPs, extracting fields, tables, and form elements while preserving document structure
- **AI-Powered Auto-Completion**: Multi-agent system that analyzes questions, retrieves relevant knowledge, generates responses, and validates quality with confidence scoring
- **Customer-Specific Learning**: Dedicated AI agents per end-customer that learn from past RFPs and improve completion accuracy over time
- **Knowledge Base Management**: Organized document storage by end-customer with semantic search, supporting past RFPs, case studies, certifications, and company documentation
- **Human-in-the-Loop Workflow**: Intuitive dashboard for reviewing AI-generated content, editing responses, and completing flagged items requiring manual input
- **Format-Preserving Output**: Generate completed RFPs in original PDF/Word format with exact formatting and branding preservation
- **Multi-Tenant Architecture**: Secure, isolated environment for each organization with role-based access control
- **Approval Workflow**: Formal review process with version history, state management (Draft → Submitted → Approved → Finalized)

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.0+ (strict mode)
- **Styling**: Tailwind CSS 3.0
- **Components**: shadcn/ui
- **Forms**: React Hook Form + Zod
- **State**: Zustand

### Backend & Infrastructure
- **Hosting**: Vercel
- **Authentication**: Clerk (Organizations for multi-tenancy)
- **Database**: Neon PostgreSQL + pgvector
- **ORM**: Drizzle ORM
- **File Storage**: Vercel Blob
- **Cache**: Vercel KV
- **Background Jobs**: Inngest

### AI & Document Processing
- **LLM Integration**: Vercel AI SDK (multi-provider: Claude, GPT, Azure)
- **Embeddings**: OpenAI text-embedding-3-small
- **Vector Search**: pgvector on Neon
- **PDF Processing**: pdf-parse + pdf-lib
- **Word Processing**: mammoth + docx

### Testing
- **Unit Tests**: Vitest
- **E2E Tests**: Playwright
- **Coverage Target**: 80%

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Next.js 15 App Router Dashboard                  │   │
│  │  • RFP Management  • KB Management  • User Management           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Next.js API Routes                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   REST API      │  │  Document       │  │    Inngest Functions    │ │
│  │   (Route        │  │  Processor      │  │                         │ │
│  │    Handlers)    │  │ • PDF Parser    │  │  • processRfp           │ │
│  │ • Clerk Auth    │  │ • Word Parser   │  │  • generateEmbeddings   │ │
│  │ • Zod Valid.    │  │ • Overlay Gen   │  │  • exportRfp            │ │
│  │ • Multi-tenant  │  │                 │  │  • extractLearnings     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    Neon PostgreSQL  │  │    Vercel Blob      │  │    Vercel KV        │
│    + pgvector       │  │                     │  │                     │
│                     │  │ • Original RFPs     │  │ • Processing status │
│ • Organizations     │  │ • Completed RFPs    │  │ • Session cache     │
│ • Customers         │  │ • KB Documents      │  │ • Rate limiting     │
│ • RFPs/Responses    │  │                     │  │                     │
│ • Knowledge entries │  │                     │  │                     │
│ • Vector embeddings │  │                     │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### AI Agent System

```
┌─────────────────────────────────────────────────────────────┐
│                   Inngest Workflow Orchestrator             │
│            (Handles multi-step AI processing)               │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Document       │ │  Response       │ │  Quality        │
│  Analyzer       │ │  Generator      │ │  Checker        │
│                 │ │                 │ │                 │
│ • Parse struct  │ │ • Query KB      │ │ • Validate      │
│ • Identify flds │ │ • Draft answers │ │ • Score conf.   │
│ • Map sections  │ │ • Format output │ │ • Flag review   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth-protected routes
│   │   ├── dashboard/     # Main dashboard
│   │   ├── rfps/          # RFP management
│   │   ├── knowledge/     # Knowledge base
│   │   └── settings/      # Organization settings
│   ├── (public)/          # Public routes
│   │   ├── sign-in/       # Clerk sign-in
│   │   └── sign-up/       # Clerk sign-up
│   └── api/               # API routes
│       ├── rfps/          # RFP endpoints
│       ├── customers/     # Customer endpoints
│       ├── knowledge/     # Knowledge base endpoints
│       ├── webhooks/      # Clerk webhooks
│       └── inngest/       # Inngest webhook
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   ├── rfp/              # RFP feature components
│   ├── knowledge/        # Knowledge base components
│   └── layout/           # Layout components
├── lib/                   # Core libraries
│   ├── db/               # Drizzle schema & client
│   │   ├── schema/       # Table definitions
│   │   └── index.ts      # Database client
│   ├── inngest/          # Background job functions
│   │   ├── client.ts     # Inngest client
│   │   └── functions/    # Job definitions
│   ├── ai/               # AI/LLM utilities
│   │   ├── providers.ts  # Multi-provider setup
│   │   └── embeddings.ts # Vector operations
│   └── documents/        # PDF/Word processing
├── hooks/                 # React hooks
└── types/                 # TypeScript types
```

## Getting Started

### Prerequisites

- **Node.js**: 20.x or higher
- **pnpm**: 8.x or higher (recommended) or npm 10.x
- **Git**: 2.x or higher

### Account Setup

1. **Clerk** (clerk.com) - Create app, enable Organizations, create `org:super_admin` role
2. **Neon** (neon.tech) - Create project, enable pgvector extension
3. **Vercel** (vercel.com) - Link repo, create Blob and KV stores
4. **Inngest** (inngest.com) - Create app for background jobs
5. **OpenAI** (platform.openai.com) - Get API key for embeddings
6. **Anthropic** (console.anthropic.com) - Optional default LLM key

### Installation

```bash
# Clone the repository
git clone https://github.com/Little-Town-Labs/bug-free-fishstick.git
cd bug-free-fishstick

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your keys (see .env.example for all required variables)

# Setup database
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev

# In separate terminal: Start Inngest dev server
pnpm inngest:dev
```

Application available at: http://localhost:3000
Inngest dashboard at: http://localhost:8288

### Project Scripts

```bash
# Development
pnpm dev              # Start Next.js dev server
pnpm inngest:dev      # Start Inngest dev server

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema directly (dev only)
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:seed          # Seed sample data

# Testing
pnpm test             # Run unit tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage report
pnpm test:e2e         # Run Playwright E2E tests

# Build & Deploy
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # ESLint + TypeScript check
```

## Configuration

### Environment Variables

See `.env.example` for all required environment variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token |
| `KV_REST_API_URL` | Vercel KV REST URL |
| `KV_REST_API_TOKEN` | Vercel KV REST token |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `INNGEST_SIGNING_KEY` | Inngest signing key |
| `OPENAI_API_KEY` | OpenAI API key (for embeddings) |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional) |

## Development

### Running Tests

```bash
# Unit tests with Vitest
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode
pnpm test:coverage           # With coverage

# E2E tests with Playwright
pnpm test:e2e                # Run E2E tests
pnpm test:e2e --ui           # With UI mode
```

### Database Migrations

```bash
# Make schema changes in src/lib/db/schema/
# Generate migration
pnpm db:generate

# Review generated SQL in drizzle/
# Apply migration
pnpm db:migrate
```

### Testing Inngest Functions

```bash
# Start Inngest dev server
pnpm inngest:dev

# Open dashboard at http://localhost:8288
# Trigger test events manually or via API
```

## Deployment

### Vercel Deployment

1. Push to main branch (auto-deploys)
2. Or use Vercel CLI: `vercel --prod`

### Environment Variables

Set all variables from `.env.example` in Vercel dashboard under Project Settings > Environment Variables.

### Database Migrations

```bash
# Pull production env and run migrations
vercel env pull .env.production.local
pnpm db:migrate
```

## Security

- **Authentication**: Clerk with Organizations for multi-tenancy
- **Authorization**: Role-based (Super Admin, Admin, User)
- **Data Isolation**: Clerk orgId enforced on all queries
- **API Security**: Zod validation, rate limiting via Vercel KV
- **Secrets**: Encrypted tenant LLM keys in database
- **File Access**: Signed URLs with expiration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run tests and linting (`pnpm test && pnpm lint`)
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
6. Push and open a Pull Request

## Documentation

- **Specifications**: See `specs/001-rfp-automation-core/`
- **API Contracts**: See `specs/001-rfp-automation-core/contracts/api.yaml`
- **Data Model**: See `specs/001-rfp-automation-core/data-model.md`
- **Quickstart**: See `specs/001-rfp-automation-core/quickstart.md`

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

**Last Updated**: 2026-02-04
**Version**: 1.0.0 (Development)
**Status**: In Development
