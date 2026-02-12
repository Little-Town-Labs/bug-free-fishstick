# RFP Automator — Quickstart

## Prerequisites

- Node.js 18+
- PostgreSQL database (or [Neon](https://neon.tech) serverless Postgres)
- [Clerk](https://clerk.com) account (for authentication and organizations)
- [Vercel](https://vercel.com) project (for Blob storage and KV cache)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | [Neon console](https://neon.tech) |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) for API key encryption | Run: `openssl rand -hex 32` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk secret key | Clerk dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret | Clerk dashboard → Webhooks |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | Vercel project → Storage → Blob |
| `KV_REST_API_URL` | Vercel KV endpoint | Vercel project → Storage → KV |
| `KV_REST_API_TOKEN` | Vercel KV token | Vercel project → Storage → KV |
| `INNGEST_EVENT_KEY` | Inngest event key | [Inngest dashboard](https://inngest.com) |
| `INNGEST_SIGNING_KEY` | Inngest signing key | Inngest dashboard |
| `OPENAI_API_KEY` | OpenAI key (for embeddings) | [OpenAI platform](https://platform.openai.com) |

**Note:** `KV_REST_API_URL` and `KV_REST_API_TOKEN` are optional for local development — the app falls back gracefully to direct DB queries.

### 3. Run database migrations

```bash
npx drizzle-kit migrate
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Create a Clerk organization

After signing in, create an organization in Clerk to enable multi-tenant features.

## Running Tests

```bash
# Run all unit and integration tests
npm test

# Run with coverage report (target: 80%+ across all modules)
npm run test:coverage

# Run end-to-end tests (requires app to be running on port 3000)
npx playwright test
```

## Building for Production

```bash
npm run build
npm start
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run unit and integration tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run type-check` | TypeScript type checking |
| `npx drizzle-kit migrate` | Apply database migrations |
| `npx drizzle-kit generate` | Generate new migration from schema changes |

## Architecture Overview

- **Frontend**: Next.js 15 App Router, Tailwind CSS, shadcn/ui
- **Auth**: Clerk (JWT, organizations, roles)
- **Database**: Neon PostgreSQL + pgvector (via Drizzle ORM)
- **File Storage**: Vercel Blob
- **Cache**: Vercel KV (Redis-compatible)
- **Background Jobs**: Inngest
- **AI**: Vercel AI SDK (Claude / OpenAI)
