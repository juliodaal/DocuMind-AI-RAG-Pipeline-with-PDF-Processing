# DocuMind AI — Architecture

> Multi-tenant RAG that ingests PDFs and documents, generates embeddings, and answers natural-language questions with cited sources.

---

## 1. System goals

| Capability                   | Detail                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Multi-tenant**             | Logical isolation by `organization_id` with Row Level Security (RLS). One cluster serves N customers.                                            |
| **Document ingestion**       | PDF (priority), DOCX, TXT, MD. Direct user upload → Supabase Storage → asynchronous pipeline.                                                    |
| **Semantic + hybrid search** | Vector search (pgvector HNSW) combined with BM25/full-text via RRF (Reciprocal Rank Fusion).                                                     |
| **Q&A with citations**       | Streaming answer + verifiable citations (document, page, fragment).                                                                              |
| **Observability**            | Per-tenant token/cost tracking in DB (`usage_events`), structured logs with pino.                                                                |
| **Security**                 | RLS at DB level, Storage with private buckets and per-tenant paths, JWT carrying `org_id`, per-tenant rate limiting.                             |
| **Cost**                     | Designed to run on free tiers (Supabase, Vercel, Inngest, Upstash). Only variable cost: OpenAI with economical models (~cents for demo traffic). |

---

## 2. Tech stack

### Application layer

- **Frontend + Backend**: Next.js 15 (App Router, Server Components, Server Actions, Streaming)
- **Language**: strict TypeScript
- **UI**: Tailwind CSS + shadcn/ui + Radix
- **State / data**: TanStack Query (client), Server Components (server)
- **Streaming chat**: Vercel AI SDK (`ai` package) with `useChat`

### Data layer

- **Auth + Postgres + Storage**: Supabase (Postgres 15 + pgvector + Auth + Realtime + S3-compatible Storage)
- **Vector store**: `pgvector` with HNSW index (cosine `<=>` operator)
- **File storage**: Supabase Storage (private buckets with RLS policies and signed URLs)
- **Cache + rate limit**: Upstash Redis (`@upstash/ratelimit`)

### AI layer (all OpenAI, optimized for cost)

- **RAG orchestration**: LangChain JS (only `RecursiveCharacterTextSplitter`) — surgical use, no heavy wrappers
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dims, **$0.02/1M tokens** — the cheapest in OpenAI's lineup)
- **Main LLM (chat + auto-titles)**: OpenAI `gpt-4o-mini` (**$0.15/1M input, $0.60/1M output**, automatic prompt caching for prompts ≥1024 tokens with 50% discount on cached input)
- **Re-ranker**: ❌ omitted in MVP (Cohere adds extra cost). Relies on hybrid search + RRF.
- **PDF parser**: `unpdf` (no native dependencies, runs in serverless)
- **LLM observability**: `usage_events` Postgres table + structured logs (no Langfuse cloud to avoid another vendor; optional self-host in v1.1)

### Asynchronous processing

- **Ingestion**: Inngest (`step.run`, automatic retries, dashboard, generous free tier) running inside Next.js as a route handler
- **Native Supabase alternative**: Supabase Edge Functions (Deno) + invocation from Server Action — viable but less ergonomic for multi-step pipelines with retries than Inngest

### Infrastructure

- **App hosting**: Vercel
- **CI/CD**: GitHub Actions (lint, typecheck, tests, build)
- **DB migrations**: Supabase CLI (`supabase/migrations/`)

---

## 3. High-level architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js 15)                           │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │ Auth UI  │  │ Workspace  │  │ Documents  │  │  Chat (stream) │   │
│  └──────────┘  └────────────┘  └────────────┘  └────────────────┘   │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ Server Actions / Route Handlers
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS SERVER (Edge/Node)                       │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │ Auth MW  │→ │ RAG engine │  │ Ingestion  │  │ Rate limit     │   │
│  │ (RLS)    │  │ (retrieve  │  │ trigger    │  │ (Upstash)      │   │
│  │          │  │  + rerank  │  │ (signed    │  │                │   │
│  │          │  │  + cite)   │  │  URL +     │  │                │   │
│  │          │  │            │  │  Inngest)  │  │                │   │
│  └──────────┘  └─────┬──────┘  └──────┬─────┘  └────────────────┘   │
└────────────────┬─────┼─────────────────┼─────────────────────────────┘
                 │     │                 │
        ┌────────┘     │                 └─────────┐
        ▼              ▼                           ▼
┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐
│  OpenAI API  │  │  Supabase        │  │  Supabase Storage      │
│              │  │  Postgres +      │  │  (private bucket,      │
│  embeddings: │  │  pgvector        │  │   tenant-prefixed)     │
│  text-embed- │  │  (per-org RLS)   │  │                        │
│  ding-3-small│  │                  │  │  documents/            │
│              │  │  ┌────────────┐  │  │   {org_id}/            │
│  chat:       │  │  │ documents  │  │  │   {document_id}/       │
│  gpt-4o-mini │  │  │ chunks     │  │  │   {filename}           │
│              │  │  │conversations│ │  │                        │
│              │  │  └────────────┘  │  └──────────┬─────────────┘
└──────────────┘  └──────────────────┘             │
                                                   │ Webhook on upload
                                                   ▼
                                       ┌────────────────────────┐
                                       │  Inngest               │
                                       │  (ingestion worker)    │
                                       │  parse → chunk →       │
                                       │  embed → upsert        │
                                       └────────────────────────┘
```

---

## 4. Data model (Postgres + pgvector)

```sql
-- Multi-tenancy
organizations          (id, name, slug, owner_id, plan, created_at)
organization_members   (org_id, user_id, role, joined_at)         -- composite PK
profiles               (id = auth.users.id, email, full_name)

-- Documents
documents              (id, org_id, uploader_id, filename, mime_type,
                        storage_path, size_bytes, sha256, status, error,
                        page_count, created_at, processed_at)
                       -- status: 'uploading' | 'queued' | 'processing'
                       --       | 'ready' | 'failed'

document_chunks        (id, document_id, org_id, chunk_index,
                        content, content_tsv (tsvector),
                        embedding vector(1536),
                        page_number, token_count, metadata jsonb,
                        created_at)
  -- INDEX HNSW: USING hnsw (embedding vector_cosine_ops)
  -- INDEX GIN:  USING gin (content_tsv)
  -- INDEX btree(org_id, document_id)

-- Conversations
conversations          (id, org_id, user_id, title, created_at, updated_at)
messages               (id, conversation_id, role, content, citations jsonb,
                        tokens_in, tokens_out, model, latency_ms, created_at)

-- Telemetry
usage_events           (id, org_id, user_id, kind, tokens, cost_cents, created_at)
                       -- kind: 'embedding' | 'chat' | 'rerank'
```

**RLS policies** (every table with `org_id`): the JWT carries `app_metadata.org_id`. Policy of the form `org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid`.

---

## 5. Data flows

### 5.1 Ingestion (asynchronous)

```
[User uploads a PDF]
  → Server Action: validates size/type, creates `documents` row (status='uploading'),
    generates a Supabase Storage signed upload URL
    (path: documents/{org_id}/{doc_id}/{filename})
[Client PUTs directly to Supabase Storage with the signed URL]
  → confirmUpload Server Action: marks status='queued', emits Inngest event
[Inngest worker]
  1. Downloads object via Supabase Storage API (service role)
  2. UPDATE documents SET status='processing'
  3. Parse PDF (unpdf) → text + page map
  4. Chunking: RecursiveCharacterTextSplitter
     - chunk_size=800 tokens, overlap=120
     - separators: ["\n\n", "\n", ". ", " "]
     - preserves page_number in metadata
  5. Batch embeddings (OpenAI, 100 chunks/call)
  6. Batch INSERT into document_chunks
  7. UPDATE documents SET status='ready', processed_at=now()
  8. Emit usage_events (tokens consumed)
[Client]
  Realtime (Supabase) or 2s polling updates the UI status
```

### 5.2 Query (RAG)

```
[User types a question in chat]
  → Server Action / Route Handler (streaming)
  1. Rate limit check (Upstash, key = org_id)
  2. Embed the query (text-embedding-3-small)
  3. Hybrid search:
     - vector: top 20 by cosine similarity (filtered WHERE org_id=...)
     - fulltext: top 20 by ts_rank(content_tsv, query)
     - RRF fusion (Reciprocal Rank Fusion) → top 8
  4. Build prompt:
     - System: strict citation instructions (stable → cacheable by OpenAI)
     - Context: numbered chunks [1], [2], ... with metadata
     - User: original question
  5. Stream `gpt-4o-mini` (Vercel AI SDK)
  6. Parse citations from the stream (inline [n] format)
  7. Persist message + citations to DB
  8. Emit usage_events (tokens in/out, estimated cost)
[Client]
  - Renders streaming tokens
  - Inline citations → onClick opens a panel with the chunk + link to the original document
```

---

## 6. Key technical decisions (with trade-offs)

### 6.1 pgvector vs Pinecone/Weaviate/Qdrant

**Chosen**: pgvector

- ✅ A single DB to maintain (auth, data, vectors)
- ✅ Native JOINs with metadata (filter by `org_id` in the same query)
- ✅ Very low cost at MVP scale
- ✅ HNSW in pgvector ≥0.5 is competitive (~95% recall)
- ❌ Beyond ~10M chunks per tenant, migration to a dedicated vector DB makes sense
- 🔁 **Future migration**: `VectorStore` interface abstraction (`upsert`, `search`)

### 6.2 Multi-tenancy: shared schema + RLS

**Chosen**: shared schema, `org_id` on every table, enforced RLS

- ✅ One DB, one migration story, simple ops
- ✅ Isolation guaranteed at the Postgres level (not just application)
- ❌ A noisy tenant could degrade neighbors → mitigate with partial indexes and quotas
- 🔁 Alternatives: schema-per-tenant (more isolation, worse ops), DB-per-tenant (enterprise)

### 6.3 Asynchronous processing queue

**Chosen**: Inngest (generous free tier, `step.run` with automatic retries, dashboard included)

- ✅ Runs as a Next.js route handler → zero extra infrastructure
- ✅ Idempotent steps with durable state; per-step retries
- ✅ Visual run/failure dashboard with no setup
- ❌ Moderate vendor lock-in → mitigated by an `IngestionQueue` interface
- 🔁 Native alternative: Supabase Edge Functions (Deno). Less ergonomic for multi-step retries but avoids one more provider
- 🔁 Local-only alternative: Postgres queue (`pg-boss`) on the same Supabase — maximum portability, more orchestration code

### 6.4 AI models (all OpenAI, cost optimization)

**Embeddings**: `text-embedding-3-small` (1536 dims, $0.02/1M tokens)

- The cheapest in OpenAI's lineup with competitive quality (MTEB ~62)
- If quality demand rises in the future: switch to `text-embedding-3-large` by changing one env var

**Chat**: `gpt-4o-mini` ($0.15/1M input, $0.60/1M output)

- Native streaming, function calling, automatic prompt caching
- Very high quality for simple RAG (not complex reasoning)
- Estimated cost for portfolio demo: ~$0.01–0.05 USD/month with moderate traffic
- Conscious decision: do NOT use Claude/GPT-5 — the quality delta does not justify the cost in a demo

### 6.5 Chunking strategy

**Chosen**: Recursive character (LangChain) with page awareness

- chunk_size: 800 tokens (context/precision balance)
- overlap: 120 tokens (~15%)
- Preserves `page_number` and `section` in metadata
- 🔁 Future upgrade: semantic chunking (split by similarity), structure-aware (markdown headings)

### 6.6 Citations: function calling vs inline format

**Chosen**: inline `[n]` format + regex parser on the stream

- ✅ Works with native streaming
- ✅ Simple, no tool-use overhead
- ✅ The stable system prompt is automatically cached by OpenAI (≥1024 tokens)
- ❌ Less strict than enforced JSON
- Mitigation: prompt with few-shot examples + post-stream validation

### 6.7 BYOK (Bring Your Own Key)

**MVP**: NO. The platform uses its own API key, charges per use.
**v1.1**: YES, `organizations.openai_key_encrypted` column ciphered with `pgsodium` (Supabase native extension for column-level encryption).

---

## 7. Folder structure

```
documind-ai/
├── app/                          # Next.js 15 App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/
│   │   ├── layout.tsx            # workspace switcher + sidebar
│   │   └── w/[workspaceId]/
│   │       ├── documents/
│   │       │   ├── page.tsx
│   │       │   └── [docId]/page.tsx
│   │       ├── chat/
│   │       │   ├── page.tsx      # new chat
│   │       │   └── [convId]/page.tsx
│   │       └── settings/page.tsx
│   ├── api/
│   │   ├── chat/route.ts         # streaming endpoint
│   │   ├── inngest/route.ts      # Inngest functions handler
│   │   └── upload/sign/route.ts  # signed upload URL (Supabase Storage)
│   └── layout.tsx
│
├── components/
│   ├── ui/                       # shadcn primitives
│   ├── chat/                     # MessageList, MessageInput, CitationCard
│   ├── documents/                # UploadZone, DocumentList, StatusBadge
│   └── workspace/
│
├── lib/
│   ├── auth/
│   │   ├── server.ts             # createClient (server-side Supabase)
│   │   ├── middleware.ts
│   │   └── require-org.ts        # helper for Server Actions
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts             # Zod schemas mirroring the DB
│   │   └── queries/              # typed query helpers
│   ├── storage/
│   │   ├── supabase.ts           # signed upload/download URLs, get/put
│   │   └── keys.ts               # tenantKey() helper
│   ├── ingestion/
│   │   ├── parser.ts             # PDF → text + pages
│   │   ├── chunker.ts            # RecursiveCharacterTextSplitter wrapper
│   │   ├── embedder.ts           # batch embedding
│   │   └── pipeline.ts           # orchestrates everything
│   ├── rag/
│   │   ├── retriever.ts          # hybrid search + RRF
│   │   ├── reranker.ts           # Cohere wrapper (optional)
│   │   ├── prompt.ts             # system prompt + context builder
│   │   ├── citations.ts          # inline [n] parser
│   │   └── pipeline.ts           # query → answer (streaming)
│   ├── llm/
│   │   ├── openai.ts             # OpenAI client (embeddings + chat)
│   │   └── usage.ts              # token + estimated cost tracking
│   ├── ratelimit/
│   │   └── index.ts              # Upstash + per-org tier
│   └── observability/
│       └── logger.ts             # pino (structured logs)
│
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql
│       ├── 0002_pgvector.sql
│       ├── 0003_rls.sql
│       └── 0004_indexes.sql
│
├── tests/
│   ├── unit/
│   │   ├── chunker.test.ts
│   │   ├── citations.test.ts
│   │   └── rrf.test.ts
│   ├── integration/
│   │   └── ingestion.test.ts     # against a test DB
│   ├── e2e/
│   │   └── chat-flow.spec.ts     # Playwright
│   └── eval/
│       ├── golden-set.json       # 20 reference Q&A
│       └── run-eval.ts
│
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── next.config.ts
├── ARCHITECTURE.md
├── PLAN.md
└── README.md
```

---

## 8. Performance — checklist

- [ ] HNSW index with `m=16, ef_construction=64` (reasonable defaults)
- [ ] `SET hnsw.ef_search = 40` per query session
- [ ] Batched embeddings (100 chunks/call) with limited concurrency (p-limit 3)
- [ ] System prompt ≥1024 tokens (stable) → OpenAI caches it automatically (50% off input)
- [ ] Postgres connection pooling (Supabase pooler in transaction mode)
- [ ] React Server Components wherever interactivity isn't needed
- [ ] Token-by-token streaming (don't wait for the full response)
- [ ] Images / UI: `next/image`, automatic code splitting

---

## 9. Security — checklist

- [ ] RLS enabled on every table that has `org_id`
- [ ] Service role key NEVER exposed to the client (server-only)
- [ ] Supabase Storage: private bucket, signed upload/download URLs with short expiry (5 min); Storage policies that validate `org_id` from the path
- [ ] MIME type and size validation on the server (don't trust the client)
- [ ] Rate limiting per `org_id` and per `user_id` (Upstash)
- [ ] Secrets in Vercel env vars, never in repo
- [ ] CSP headers configured in `next.config.ts`
- [ ] CSRF: Next.js Server Actions handle this natively
- [ ] SQL injection: parameterized query builders (postgres-js)
- [ ] LLM output sanitization before rendering (markdown safe)

---

## 10. Testing — pyramid

| Type            | Tool                             | Target coverage                                                                |
| --------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| **Unit**        | Vitest                           | chunker, citations parser, RRF, prompt builder, key tenant scoping             |
| **Integration** | Vitest + Supabase test container | full ingestion pipeline (test PDF), hybrid retriever                           |
| **E2E**         | Playwright                       | login → upload → wait ready → chat with verifiable citation                    |
| **LLM eval**    | Custom script                    | 20 Q&A golden set, measures: groundedness, citation accuracy, answer relevance |

---

## 11. Deployment

```
┌────────────────┐     ┌──────────────┐     ┌─────────────┐
│ GitHub         │────▶│ GitHub Actions│────▶│ Vercel      │
│ (main branch)  │     │ lint/test/build│    │ (Next.js)   │
└────────────────┘     └──────────────┘     └─────────────┘
                                                     │
                              ┌──────────────────────┼──────────────┐
                              ▼                      ▼              ▼
                      ┌────────────────────┐  ┌──────────┐   ┌──────────┐
                      │ Supabase           │  │ Upstash  │   │ Inngest  │
                      │ (Postgres+pgvector,│  │ (Redis,  │   │ (ingest  │
                      │  Auth, Storage,    │  │  rate    │   │  queue)  │
                      │  Realtime)         │  │  limit)  │   │          │
                      └────────────────────┘  └──────────┘   └──────────┘
```

---

## 12. Post-MVP roadmap (not for today, for the README)

- v1.1: BYOK + DOCX/MD/HTML support + per-workspace upgrade option to `gpt-4o` or Claude Sonnet 4.6
- v1.2: Clickable citations open the PDF at the exact page (PDF.js viewer)
- v1.3: Multi-document conversations with memory
- v1.4: Re-ranker (Cohere or local cross-encoder) once volumes justify it
- v1.5: Agent with tools (web search, calculator) over the corpus
- v2.0: Self-hosted Langfuse + optional migration to a dedicated vector DB (Qdrant) if >10M chunks

## 13. Demo cost estimate (for the README)

Assuming portfolio usage: 50 PDFs ingested (~10 pages each on average) + 200 chat queries per month:

- **Supabase** (Free): $0 — DB up to 500MB, Storage 1GB, Auth 50k MAU
- **Vercel** (Hobby): $0 — 100GB bandwidth, unlimited builds for hobby
- **Inngest** (Free): $0 — 50k step runs/month
- **Upstash Redis** (Free): $0 — 10k requests/day
- **OpenAI**:
  - Ingestion embeddings: 50 docs × ~5K tokens = 250K tokens × $0.02/1M = **$0.005**
  - Query embeddings: 200 × ~10 tokens = 2K tokens = ~$0.0001
  - Chat: 200 queries × (3K input + 400 output) = 600K input + 80K output → 600K × $0.15/1M + 80K × $0.60/1M = **$0.14**
  - **OpenAI total: ~$0.15 USD/month**
- **Monthly total: ~$0.15 USD** (literally cents)
