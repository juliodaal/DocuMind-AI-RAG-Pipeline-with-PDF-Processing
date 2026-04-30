# DocuMind AI

> Multi-tenant RAG SaaS that ingests PDFs, generates embeddings, and answers natural language questions about their content — with cited sources.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20pgvector-3FCF8E?logo=supabase)](https://supabase.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)](https://openai.com)

## Overview

DocuMind AI is a production-grade Retrieval-Augmented Generation (RAG) platform. Each workspace (tenant) can upload documents, which are parsed, chunked, embedded, and stored in `pgvector`. Users can then query their corpus in natural language and receive answers with verifiable citations back to the source.

## Features

- Multi-tenant with Postgres Row Level Security
- PDF ingestion via async pipeline (Inngest workers)
- Hybrid search: vector (pgvector HNSW) + full-text (BM25) fused via RRF
- Streaming chat with inline citations
- Per-tenant usage tracking (tokens + estimated cost)
- Rate limiting per workspace (Upstash Redis)
- Tested: unit + integration + E2E + LLM eval

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

## Stack

| Layer               | Tech                                                       |
| ------------------- | ---------------------------------------------------------- |
| Frontend + Backend  | Next.js 15 (App Router, Server Components, Server Actions) |
| Auth + DB + Storage | Supabase (Postgres + pgvector + Auth + Storage)            |
| Async pipeline      | Inngest                                                    |
| Rate limiting       | Upstash Redis                                              |
| Embeddings          | OpenAI `text-embedding-3-small`                            |
| Chat LLM            | OpenAI `gpt-4o-mini`                                       |
| Hosting             | Vercel                                                     |

## Quickstart

```bash
# 1. Clone
git clone https://github.com/your-username/documind-ai.git
cd documind-ai

# 2. Install
pnpm install

# 3. Configure
cp .env.example .env.local
# Fill in Supabase, OpenAI, Inngest, Upstash credentials

# 4. Run migrations
pnpm dlx supabase link
pnpm dlx supabase db push

# 5. Start dev (two terminals)
pnpm dev
pnpm dlx inngest-cli@latest dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command          | What it does                           |
| ---------------- | -------------------------------------- |
| `pnpm dev`       | Next.js dev server with Turbopack      |
| `pnpm build`     | Production build                       |
| `pnpm typecheck` | Run TypeScript compiler in noEmit mode |
| `pnpm lint`      | ESLint                                 |
| `pnpm format`    | Prettier write                         |
| `pnpm test`      | Vitest (unit + integration)            |
| `pnpm test:e2e`  | Playwright E2E                         |
| `pnpm eval`      | LLM eval against golden dataset        |

## Project status

Work in progress. See [PLAN.md](./PLAN.md) for the build roadmap.

## License

MIT
