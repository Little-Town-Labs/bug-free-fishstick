# Quickstart: RFP Automator Development

**Feature**: 001-rfp-automation-core
**Date**: 2026-02-04

## Prerequisites

- **Node.js**: 20.x or higher
- **pnpm**: 8.x or higher (recommended) or npm 10.x
- **Git**: 2.x or higher

## Account Setup

### 1. Clerk (Authentication)

1. Create account at [clerk.com](https://clerk.com)
2. Create new application
3. Enable "Organizations" feature in dashboard
4. Create custom role `org:super_admin` in Roles settings
5. Copy API keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `CLERK_WEBHOOK_SECRET` (create webhook for organization events)

### 2. Neon (Database)

1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Copy connection string:
   - `DATABASE_URL` (pooled connection recommended for serverless)

### 3. Vercel (Hosting & Services)

1. Create account at [vercel.com](https://vercel.com)
2. Link GitHub repository
3. Create Blob store in project settings
4. Create KV store in project settings
5. Copy tokens:
   - `BLOB_READ_WRITE_TOKEN`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

### 4. Inngest (Background Jobs)

1. Create account at [inngest.com](https://inngest.com)
2. Create new app
3. Copy:
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`

### 5. OpenAI (Embeddings)

1. Create account at [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Copy:
   - `OPENAI_API_KEY` (for embeddings)

### 6. Anthropic (LLM - Optional Default)

1. Create account at [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Copy:
   - `ANTHROPIC_API_KEY` (optional, tenants can configure their own)

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd rfp-automator
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Vercel KV
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxx

# Inngest
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=signkey-xxx

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# Anthropic (optional default LLM)
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Setup Database

```bash
# Generate Drizzle client
pnpm db:generate

# Run migrations
pnpm db:migrate

# (Optional) Seed sample data
pnpm db:seed
```

### 5. Start Development Server

```bash
# Start Next.js dev server
pnpm dev

# In separate terminal: Start Inngest dev server
pnpm inngest:dev
```

Application available at: http://localhost:3000
Inngest dashboard at: http://localhost:8288

---

## Project Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint && tsc --noEmit",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/seed.ts",
    "inngest:dev": "inngest-cli dev -u http://localhost:3000/api/inngest"
  }
}
```

---

## Directory Overview

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth-protected routes
│   ├── (public)/          # Public routes (sign-in)
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── rfp/              # Feature components
├── lib/                   # Core libraries
│   ├── db/               # Drizzle schema & client
│   ├── inngest/          # Background job functions
│   ├── ai/               # LLM utilities
│   └── documents/        # PDF/Word processing
├── hooks/                 # React hooks
└── types/                 # TypeScript types
```

---

## Key Development Workflows

### Adding a New API Route

1. Create route file in `src/app/api/[resource]/route.ts`
2. Add Zod schema in `src/lib/utils/validation.ts`
3. Implement handler with tenant isolation:

```typescript
// src/app/api/example/route.ts
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

  const data = await db.query.examples.findMany({
    where: eq(examples.organizationId, orgId),
  });

  return NextResponse.json({ data });
}
```

### Adding a New Inngest Function

1. Create function in `src/lib/inngest/functions/`
2. Register in `src/lib/inngest/functions/index.ts`
3. Test with Inngest dev server

```typescript
// src/lib/inngest/functions/my-function.ts
import { inngest } from "../client";

export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "my/event" },
  async ({ event, step }) => {
    const result = await step.run("step-name", async () => {
      // Your logic here
    });
    return result;
  }
);
```

### Adding a New Component

1. Create component in `src/components/[feature]/`
2. Use shadcn/ui primitives from `src/components/ui/`
3. Add types in `src/types/`

```typescript
// src/components/rfp/ResponseCard.tsx
"use client";

import { Card } from "@/components/ui/card";
import type { RfpResponse } from "@/types/rfp";

interface ResponseCardProps {
  response: RfpResponse;
  onUpdate: (text: string) => void;
}

export function ResponseCard({ response, onUpdate }: ResponseCardProps) {
  // Component implementation
}
```

### Adding a Database Migration

```bash
# Make schema changes in src/lib/db/schema/
# Then generate migration
pnpm db:generate

# Review generated SQL in drizzle/
# Apply migration
pnpm db:migrate
```

---

## Testing

### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
pnpm test:coverage
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
pnpm test:e2e

# With UI
pnpm test:e2e --ui

# Specific test file
pnpm test:e2e tests/e2e/rfp-workflow.spec.ts
```

### Testing Inngest Functions

```bash
# Start Inngest dev server
pnpm inngest:dev

# Open dashboard at http://localhost:8288
# Trigger test events manually or via API
```

---

## Deployment

### Vercel Deployment

1. Push to main branch (auto-deploys)
2. Or manually deploy:

```bash
vercel --prod
```

### Environment Variables

Set in Vercel dashboard under Project Settings > Environment Variables:

- All variables from `.env.local`
- Add `VERCEL_URL` (auto-set by Vercel)

### Database Migrations

Run migrations before/after deploy:

```bash
# Via Vercel CLI
vercel env pull .env.production.local
pnpm db:migrate
```

---

## Troubleshooting

### Clerk Auth Issues

```bash
# Check middleware is configured
cat src/middleware.ts

# Verify environment variables
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

### Database Connection Issues

```bash
# Test connection
pnpm db:studio

# Check pgvector extension
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### Inngest Function Not Triggering

1. Check Inngest dashboard for errors
2. Verify webhook URL is correct
3. Check event name matches function trigger

### Vercel Blob Upload Issues

```bash
# Verify token
curl -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  https://blob.vercel-storage.com/
```

---

## Resources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Clerk Docs](https://clerk.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [Inngest Docs](https://www.inngest.com/docs)
- [pgvector Docs](https://github.com/pgvector/pgvector)
- [shadcn/ui Docs](https://ui.shadcn.com/)
