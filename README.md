# DocuMind AI

> Multi-tenant Retrieval-Augmented Generation (RAG) platform. Upload PDFs, ask questions in natural language, get answers grounded in cited source excerpts.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20pgvector-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai&logoColor=white)](https://openai.com)
[![Inngest](https://img.shields.io/badge/Inngest-async%20queue-9333EA)](https://www.inngest.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it does

Each workspace is an isolated tenant. Members upload PDFs; the ingestion pipeline parses, chunks, and embeds every page; queries run a hybrid (vector + full-text) search and stream an answer from `gpt-4o-mini` with inline citations that you can click to see the exact excerpt and page.

- **Multi-tenant by Postgres RLS** — every query is filtered at the database level
- **Hybrid retrieval** — pgvector cosine similarity (HNSW) + Postgres `tsvector`, fused via Reciprocal Rank Fusion
- **Streaming chat with citations** — `gpt-4o-mini` answers stream token-by-token; `[N]` markers resolve to interactive popovers
- **Realtime status** — document ingestion progress streams to the UI via Supabase Realtime
- **Cost tracking** — every LLM call records tokens + cost in cents into `usage_events`
- **Built for free tiers** — typical demo usage runs at ~$0.05 USD/month on OpenAI alone

A 4-page test PDF goes from upload to ready in **~5 seconds**, costing about **$0.000004**.

## Architecture in one diagram

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser  ─►  Next.js (App Router, Server Actions, streaming)      │
│                ├─ Auth via @supabase/ssr (cookie session)          │
│                ├─ /api/chat: hybrid search → streamText (gpt-4o-mini)│
│                └─ /api/inngest: ingestion worker                    │
└────┬─────────────────────────────┬──────────────────────────┬──────┘
     │                             │                          │
     ▼                             ▼                          ▼
┌─────────┐                ┌──────────────────┐       ┌──────────────┐
│ OpenAI  │                │ Supabase         │       │ Inngest      │
│ embed + │                │ Postgres+pgvector│       │ async queue  │
│ chat    │                │ Storage / Auth   │       │              │
└─────────┘                │ Realtime         │       └──────────────┘
                           └──────────────────┘
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design, RLS strategy, and trade-offs.

---

## Run it locally — step by step

You'll set up four free-tier accounts (Supabase, OpenAI, Inngest, Upstash), clone the repo, and have it running on `localhost:3000` in roughly **15 minutes**.

### 0. Prerequisites

Install these once:

- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- **pnpm 10+**: `npm install -g pnpm`
- **Git**

Verify:

```bash
node --version    # v20+ or v22+
pnpm --version    # 10+
git --version
```

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/documind-ai.git
cd documind-ai
pnpm install
```

### 2. Create a Supabase project (free tier)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Pick a region close to you, set a strong database password, and **save that password** — you'll need it for migrations
3. Once the project finishes provisioning (~2 minutes), open **Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key

You'll paste these into `.env.local` in the next step.

### 3. Create an OpenAI API key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Add a payment method and load **$5** in credits (the demo costs cents per month — this lasts a long time)
3. Create a key and copy it (`sk-...`)

### 4. Create an Inngest account (free tier)

Inngest runs the async ingestion pipeline in production. Locally you'll use the Inngest dev server which doesn't need an account.

1. Sign up at [inngest.com](https://inngest.com) with GitHub
2. Open your default app and grab:
   - `INNGEST_EVENT_KEY` from **Manage → Event Keys**
   - `INNGEST_SIGNING_KEY` from **Manage → Signing Key**

These are only needed for production deploy; in dev the SDK uses the local Inngest CLI.

### 5. Create an Upstash Redis instance (free tier)

Used for per-workspace rate limiting.

1. Sign up at [upstash.com](https://upstash.com)
2. Click **Create Database**, pick a region, **Regional**, eviction enabled
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 6. Configure environment variables

Copy the template and fill in the values you collected above:

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your keys into the relevant slots. The file is already in `.gitignore` and won't be committed.

> Make sure `INNGEST_DEV=1` is set — it forces the SDK into dev mode so events route to the local Inngest server instead of Inngest Cloud.

### 7. Apply database migrations

We use the Supabase CLI to push our 10 migrations (schema + RLS + RPC functions + storage policies + Realtime publication).

Create a Personal Access Token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) (Generate new token → name it whatever).

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."           # macOS/Linux
# or on Windows PowerShell:  $env:SUPABASE_ACCESS_TOKEN="sbp_..."

pnpm dlx supabase@latest link --project-ref <YOUR_PROJECT_REF> --password "<DB_PASSWORD>"
pnpm dlx supabase@latest db push --password "<DB_PASSWORD>"
```

Your `<YOUR_PROJECT_REF>` is the subdomain of your Supabase URL, e.g. for `https://abc123xyz.supabase.co` the ref is `abc123xyz`.

### 8. Disable email confirmation (dev only)

For local development we want signup to work without bouncing through an email confirmation link. The Supabase Management API can flip this for you:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/<YOUR_PROJECT_REF>/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mailer_autoconfirm": true}'
```

Or do it from the dashboard: **Authentication → Providers → Email → uncheck "Confirm email"**.

### 9. Verify the setup

Three sanity-check scripts make sure your environment is wired correctly before launching the app:

```bash
pnpm exec tsx scripts/check-env.ts          # parses .env.local with Zod
pnpm exec tsx scripts/check-db.ts           # confirms tables + helper RPCs exist
pnpm exec tsx scripts/check-storage.ts      # bucket exists + signed-URL roundtrip works
```

All three should print green checkmarks. If something fails, the message points at the exact missing piece.

### 10. Run the app

You need **two terminals** open during development:

**Terminal 1 — Next.js dev server:**

```bash
pnpm dev
```

**Terminal 2 — Inngest dev server (handles async ingestion):**

```bash
pnpm dlx inngest-cli@latest dev
```

Open:

- [http://localhost:3000](http://localhost:3000) — the app
- [http://localhost:8288](http://localhost:8288) — Inngest dashboard (run logs, events, function metrics)

### 11. Try it end-to-end

1. **Sign up** at `/signup` with any email + password (≥ 8 chars). The signup trigger automatically creates your profile + a personal workspace.
2. **Upload a PDF** at `/w/<workspace-id>/documents`. Watch the status progress: `queued → processing → ready` (the badge updates via Supabase Realtime — no page refresh needed).
3. **Ask a question** at `/w/<workspace-id>/chat`. The answer streams in with `[N]` citations. Click any citation to see the exact source excerpt and page.

You can verify the full pipeline ran cleanly with:

```bash
pnpm exec tsx scripts/check-ingestion.ts    # ingests a synthetic PDF, asserts chunks+embeddings
pnpm exec tsx scripts/check-chat.ts         # full RAG cycle: search → answer → citation
```

---

## Component playground (Storybook)

Every primitive lives in Storybook for isolated visual review:

```bash
pnpm storybook
```

Opens at [http://localhost:6006](http://localhost:6006). You'll find the design tokens (colors, typography, radii, spacing), button variants, status badges, citation popovers, message bubbles, and the message input — each in its own story with a dark/light theme toggle.

To export a static build (for hosting or screenshots):

```bash
pnpm build-storybook
```

---

## Project layout

```
documind-ai/
├── app/                          Next.js App Router
│   ├── (auth)/                   login, signup, server actions
│   ├── (dashboard)/              authenticated routes
│   │   └── w/[workspaceId]/      per-workspace pages (overview, documents, chat)
│   ├── api/
│   │   ├── chat/route.ts         streaming RAG endpoint
│   │   └── inngest/route.ts      Inngest function handler
│   ├── globals.css               design tokens + base styles
│   └── layout.tsx
├── components/
│   ├── ui/                       shadcn primitives + base button stories
│   ├── chat/                     ChatWindow, MessageList, CitationCard, …
│   ├── documents/                UploadZone, DocumentList, StatusBadge
│   ├── workspace/                DashboardShell
│   ├── auth/                     AuthForm
│   └── foundation/               token + page-header stories
├── lib/
│   ├── auth/                     server/client/admin Supabase clients + middleware
│   ├── db/                       hand-rolled types + query helpers
│   ├── storage/                  Supabase Storage helpers (signed URLs, etc.)
│   ├── ingestion/                parser, chunker, embedder, pipeline
│   ├── rag/                      retriever, prompt builder, citations parser
│   ├── llm/                      OpenAI client + cost tracking
│   ├── inngest/                  client + functions
│   └── env.ts                    Zod-validated env vars
├── supabase/migrations/          10 SQL migrations (schema, RLS, RPC, storage)
├── scripts/                      check-* utility scripts (env, db, vector, …)
├── tests/                        unit + integration + e2e + eval (Vitest + Playwright)
├── .storybook/                   Storybook config
└── ARCHITECTURE.md               full system design
```

---

## Scripts

| Command                | What it does                     |
| ---------------------- | -------------------------------- |
| `pnpm dev`             | Next.js dev server (Turbopack)   |
| `pnpm build`           | Production build                 |
| `pnpm start`           | Run the production build locally |
| `pnpm lint`            | ESLint                           |
| `pnpm typecheck`       | `tsc --noEmit` strict type check |
| `pnpm format`          | Prettier write                   |
| `pnpm test`            | Vitest unit + integration        |
| `pnpm test:e2e`        | Playwright end-to-end            |
| `pnpm storybook`       | Start Storybook on `:6006`       |
| `pnpm build-storybook` | Static Storybook export          |

Plus the verification scripts in `scripts/`:

- `check-env.ts` — env vars parse with Zod
- `check-db.ts` — tables + helper RPCs exist
- `check-storage.ts` — Supabase Storage bucket + signed URL roundtrip
- `check-vector.ts` — pgvector schema + content_tsv generated column
- `check-signup-trigger.ts` — auth trigger creates profile + org + member
- `check-ingestion.ts` — full ingest pipeline E2E (generates a PDF + asserts chunks)
- `check-chat.ts` — full RAG cycle (search → stream → citations)

---

## Deploying to Vercel

1. Push the repo to GitHub
2. Import it into [Vercel](https://vercel.com/new), select Next.js
3. Add the same environment variables you set locally in **Project → Settings → Environment Variables**, but **remove `INNGEST_DEV`** (production should route to Inngest Cloud)
4. In the Inngest dashboard, point your app at `https://<your-deploy>.vercel.app/api/inngest`
5. In Supabase, add your Vercel domain to **Authentication → URL Configuration → Site URL** and Redirect URLs

That's it. Vercel auto-deploys on every push to `main`.

---

## License

MIT — see [LICENSE](./LICENSE).
