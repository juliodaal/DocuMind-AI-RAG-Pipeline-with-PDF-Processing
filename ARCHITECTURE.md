# DocuMind AI — Arquitectura

> RAG multi-tenant que ingiere PDFs y documentos, genera embeddings, y responde preguntas en lenguaje natural con fuentes citadas.

---

## 1. Objetivos del sistema

| Capacidad                        | Detalle                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-tenant**                 | Aislamiento lógico por `organization_id` con Row Level Security (RLS). Un mismo cluster sirve N clientes.                                           |
| **Ingesta de documentos**        | PDF (prioridad), DOCX, TXT, MD. Subida directa del usuario → Supabase Storage → pipeline asíncrono.                                                 |
| **Búsqueda semántica + híbrida** | Vector search (pgvector HNSW) combinado con BM25/full-text via RRF (Reciprocal Rank Fusion).                                                        |
| **Q&A con citas**                | Respuesta en streaming + citas verificables (documento, página, fragmento).                                                                         |
| **Observabilidad**               | Tracking de tokens/costo por tenant en DB (`usage_events`), logs estructurados con pino.                                                            |
| **Seguridad**                    | RLS a nivel DB, Storage con buckets privados y paths por tenant, JWT con `org_id`, rate limiting por tenant.                                        |
| **Costo**                        | Diseñado para correr en free tiers (Supabase, Vercel, Inngest, Upstash). Único costo variable: OpenAI con modelos económicos (~céntimos para demo). |

---

## 2. Stack tecnológico

### Capa de aplicación

- **Frontend + Backend**: Next.js 15 (App Router, Server Components, Server Actions, Streaming)
- **Lenguaje**: TypeScript estricto
- **UI**: Tailwind CSS + shadcn/ui + Radix
- **Estado/datos**: TanStack Query (cliente), Server Components (servidor)
- **Streaming chat**: Vercel AI SDK (`ai` package) con `useChat`

### Capa de datos

- **Auth + Postgres + Storage**: Supabase (Postgres 15 + pgvector + Auth + Realtime + Storage S3-compatible)
- **Vector store**: `pgvector` con índice HNSW (operador `<=>` cosine)
- **Storage de archivos**: Supabase Storage (buckets privados con políticas RLS y signed URLs)
- **Cache + rate limit**: Upstash Redis (`@upstash/ratelimit`)

### Capa de IA (todo OpenAI, optimizado para costo)

- **Orquestación RAG**: LangChain JS (solo `RecursiveCharacterTextSplitter`) — uso quirúrgico, sin envoltorios pesados
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dims, **$0.02/1M tokens** — el más barato de OpenAI)
- **LLM principal (chat + auto-título)**: OpenAI `gpt-4o-mini` (**$0.15/1M input, $0.60/1M output**, prompt caching automático para prompts ≥1024 tokens con 50% descuento en input cacheado)
- **Re-ranker**: ❌ omitido en MVP (Cohere genera costo extra). Se confía en hybrid search + RRF
- **Parser PDF**: `unpdf` (sin dependencias nativas, funciona en serverless)
- **Observabilidad LLM**: tabla `usage_events` en Postgres + logs estructurados (sin Langfuse cloud para evitar otro proveedor; opcional self-host en v1.1)

### Procesamiento asíncrono

- **Ingesta**: Inngest (`step.run`, retries automáticos, dashboard, free tier) ejecutándose dentro de Next.js como route handler
- **Alternativa nativa Supabase**: Supabase Edge Functions (Deno) + invocación desde Server Action — viable pero menos cómoda para steps con retries que Inngest

### Infraestructura

- **Hosting app**: Vercel
- **CI/CD**: GitHub Actions (lint, typecheck, tests, build)
- **Migraciones DB**: Supabase CLI (`supabase/migrations/`)

---

## 3. Arquitectura de alto nivel

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Next.js 15)                          │
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
│              │  │  Postgres +      │  │  (bucket privado,      │
│  embeddings: │  │  pgvector        │  │   tenant-prefixed)     │
│  text-embed- │  │  (RLS por org)   │  │                        │
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

## 4. Modelo de datos (Postgres + pgvector)

```sql
-- Multi-tenancy
organizations          (id, name, slug, owner_id, plan, created_at)
organization_members   (org_id, user_id, role, joined_at)         -- PK compuesta
profiles               (id = auth.users.id, email, full_name)

-- Documentos
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

-- Conversaciones
conversations          (id, org_id, user_id, title, created_at, updated_at)
messages               (id, conversation_id, role, content, citations jsonb,
                        tokens_in, tokens_out, model, latency_ms, created_at)

-- Telemetría
usage_events           (id, org_id, user_id, kind, tokens, cost_cents, created_at)
                       -- kind: 'embedding' | 'chat' | 'rerank'
```

**RLS policies** (todas las tablas con `org_id`): el JWT incluye `app_metadata.org_id`. Política tipo `org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid`.

---

## 5. Flujos de datos

### 5.1 Ingesta (asíncrona)

```
[Usuario sube PDF]
  → Server Action: valida tamaño/tipo, crea row `documents` (status='uploading'),
    genera signed upload URL de Supabase Storage
    (path: documents/{org_id}/{doc_id}/{filename})
[Cliente hace PUT directo a Supabase Storage con la signed URL]
  → confirmUpload Server Action: marca status='queued', emite evento Inngest
[Inngest worker]
  1. Descarga objeto vía Supabase Storage API (service role)
  2. UPDATE documents SET status='processing'
  3. Parse PDF (unpdf) → texto + page map
  4. Chunking: RecursiveCharacterTextSplitter
     - chunk_size=800 tokens, overlap=120
     - separators: ["\n\n", "\n", ". ", " "]
     - preserva page_number en metadata
  5. Embeddings batch (OpenAI, 100 chunks/llamada)
  6. INSERT batch en document_chunks
  7. UPDATE documents SET status='ready', processed_at=now()
  8. Emit usage_events (tokens consumidos)
[Cliente]
  Realtime (Supabase) o polling cada 2s actualiza estado en UI
```

### 5.2 Query (RAG)

```
[Usuario escribe pregunta en chat]
  → Server Action / Route Handler (streaming)
  1. Rate limit check (Upstash, key = org_id)
  2. Embed la query (text-embedding-3-small)
  3. Hybrid search:
     - vector: top 20 por similitud coseno (filtrado WHERE org_id=...)
     - fulltext: top 20 por ts_rank(content_tsv, query)
     - fusion RRF (Reciprocal Rank Fusion) → top 8
  4. Build prompt:
     - System: instrucciones de cita estricta (estable → cacheable por OpenAI)
     - Context: chunks numerados [1], [2], ... con metadata
     - User: pregunta original
  5. Stream `gpt-4o-mini` (Vercel AI SDK)
  6. Parse citas del stream (formato [n] inline)
  7. Persist message + citations en DB
  8. Emit usage_events (tokens in/out, costo estimado)
[Cliente]
  - Renderiza tokens en streaming
  - Citas inline → onClick abre panel con chunk + link a documento original
```

---

## 6. Decisiones técnicas clave (con trade-offs)

### 6.1 pgvector vs Pinecone/Weaviate/Qdrant

**Elegido**: pgvector

- ✅ Una sola DB que mantener (auth, datos, vectores)
- ✅ JOINs nativos con metadata (filtro por `org_id` en el mismo query)
- ✅ Costo muy bajo a escala MVP
- ✅ HNSW en pgvector ≥0.5 es competitivo (~95% recall)
- ❌ A >10M chunks por tenant conviene migrar a vector DB dedicado
- 🔁 **Migración futura**: abstracción `VectorStore` interface (`upsert`, `search`)

### 6.2 Multi-tenancy: schema compartido + RLS

**Elegido**: shared schema, `org_id` en cada tabla, RLS forzado

- ✅ Una sola DB, una sola migración, ops simples
- ✅ Aislamiento garantizado a nivel Postgres (no solo aplicación)
- ❌ Tenant gigante puede degradar al resto → mitigar con índices parciales y quotas
- 🔁 Alternativas: schema-per-tenant (más aislamiento, peor ops), DB-per-tenant (enterprise)

### 6.3 Cola de procesamiento asíncrono

**Elegido**: Inngest (free tier generoso, `step.run` con retries automáticos, dashboard incluido)

- ✅ Se ejecuta como route handler dentro de Next.js → cero infra extra
- ✅ Steps idempotentes con state durable; reintentos por step
- ✅ Dashboard visual de runs/fallos sin montar nada
- ❌ Vendor lock-in moderado → mitigado con interfaz `IngestionQueue`
- 🔁 Alternativa nativa: Supabase Edge Functions (Deno). Menos cómoda para multi-step con retries pero evita un proveedor más
- 🔁 Alternativa local-only: Postgres queue (`pg-boss`) sobre el mismo Supabase — máxima portabilidad, más código de orquestación

### 6.4 Modelos de IA (todos OpenAI, optimización de costo)

**Embeddings**: `text-embedding-3-small` (1536 dims, $0.02/1M tokens)

- El más barato de OpenAI con calidad competitiva (MTEB ~62)
- Si sube exigencia futura: switch a `text-embedding-3-large` cambiando una env var

**Chat**: `gpt-4o-mini` ($0.15/1M input, $0.60/1M output)

- Streaming nativo, function calling, prompt caching automático
- Calidad muy alta para RAG simple (no es razonamiento complejo)
- Coste estimado para demo de portfolio: ~$0.01–0.05 USD/mes con tráfico moderado
- Decisión consciente: NO usar Claude/GPT-5 — el delta de calidad no justifica el costo en un demo

### 6.5 Chunking strategy

**Elegido**: Recursive character (LangChain) con conciencia de página

- chunk_size: 800 tokens (balance contexto/precisión)
- overlap: 120 tokens (~15%)
- Preserva `page_number` y `section` en metadata
- 🔁 Upgrade futuro: semantic chunking (split por similitud), structure-aware (markdown headings)

### 6.6 Citations: function calling vs format inline

**Elegido**: format inline `[n]` + parser regex en el stream

- ✅ Funciona con streaming nativo
- ✅ Simple, sin tool-use overhead
- ✅ El system prompt estable es cacheado por OpenAI automáticamente (≥1024 tokens)
- ❌ Menos estricto que JSON forzado
- Mitigación: prompt con few-shot examples + validación post-stream

### 6.7 BYOK (Bring Your Own Key)

**MVP**: NO. Plataforma usa su propia API key, cobra por uso.
**v1.1**: SÍ, columna `organizations.openai_key_encrypted` cifrada con `pgsodium` (extensión nativa de Supabase para column-level encryption).

---

## 7. Estructura de carpetas

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
│   │       │   ├── page.tsx      # nuevo chat
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
│   │   └── require-org.ts        # helper para Server Actions
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts             # Zod schemas espejo de DB
│   │   └── queries/              # query helpers tipados
│   ├── storage/
│   │   ├── supabase.ts           # signed upload/download URLs, get/put
│   │   └── keys.ts               # tenantKey() helper
│   ├── ingestion/
│   │   ├── parser.ts             # PDF → texto + pages
│   │   ├── chunker.ts            # RecursiveCharacterTextSplitter wrapper
│   │   ├── embedder.ts           # batch embedding
│   │   └── pipeline.ts           # orquesta todo
│   ├── rag/
│   │   ├── retriever.ts          # hybrid search + RRF
│   │   ├── reranker.ts           # Cohere wrapper (opcional)
│   │   ├── prompt.ts             # system prompt + context builder
│   │   ├── citations.ts          # parser de [n] inline
│   │   └── pipeline.ts           # query → answer (streaming)
│   ├── llm/
│   │   ├── openai.ts             # cliente OpenAI (embeddings + chat)
│   │   └── usage.ts              # tracking de tokens y costo estimado
│   ├── ratelimit/
│   │   └── index.ts              # Upstash + tier por org
│   └── observability/
│       └── logger.ts             # pino (logs estructurados)
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
│   │   └── ingestion.test.ts     # con DB de test
│   ├── e2e/
│   │   └── chat-flow.spec.ts     # Playwright
│   └── eval/
│       ├── golden-set.json       # 20 Q&A de referencia
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

- [ ] Índice HNSW con `m=16, ef_construction=64` (defaults razonables)
- [ ] `SET hnsw.ef_search = 40` por sesión de query
- [ ] Embeddings en batch (100 chunks/call) con concurrencia limitada (p-limit 3)
- [ ] System prompt ≥1024 tokens (estable) → OpenAI lo cachea automáticamente (50% off input)
- [ ] Connection pooling de Postgres (Supabase pooler en transaction mode)
- [ ] React Server Components donde no haga falta interactividad
- [ ] Streaming token-a-token (no esperar respuesta completa)
- [ ] Imágenes/UI: `next/image`, code splitting automático

---

## 9. Seguridad — checklist

- [ ] RLS habilitado en todas las tablas con `org_id`
- [ ] Service role key NUNCA expuesta al cliente (solo en server)
- [ ] Supabase Storage: bucket privado, signed upload/download URLs con expiry corto (5 min); políticas de Storage que validan `org_id` desde el path
- [ ] Validación de tipo MIME y tamaño en server (no confiar en cliente)
- [ ] Rate limiting por `org_id` y por `user_id` (Upstash)
- [ ] Secrets en Vercel env vars, nunca en repo
- [ ] CSP headers configurados en `next.config.ts`
- [ ] CSRF: Server Actions de Next.js ya lo manejan
- [ ] SQL injection: query builders parametrizados (postgres-js)
- [ ] Sanitización de output del LLM antes de renderizar (markdown safe)

---

## 10. Testing — pirámide

| Tipo            | Herramienta                      | Cobertura objetivo                                                         |
| --------------- | -------------------------------- | -------------------------------------------------------------------------- |
| **Unit**        | Vitest                           | chunker, citations parser, RRF, prompt builder, key tenant scoping         |
| **Integration** | Vitest + supabase test container | pipeline ingesta completo (PDF de prueba), retriever hybrid                |
| **E2E**         | Playwright                       | login → upload → wait ready → chat con cita verificable                    |
| **Eval LLM**    | Script custom                    | 20 Q&A golden set, mide: groundedness, citation accuracy, answer relevance |

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
                      │ (Postgres+pgvector,│  │ (Redis,  │   │ (cola de │
                      │  Auth, Storage,    │  │  rate    │   │  ingesta)│
                      │  Realtime)         │  │  limit)  │   │          │
                      └────────────────────┘  └──────────┘   └──────────┘
```

---

## 12. Roadmap post-MVP (no para hoy, para README)

- v1.1: BYOK + soporte DOCX/MD/HTML + opción de upgrade a `gpt-4o` o Claude Sonnet 4.6 por workspace
- v1.2: Citations clicables abren PDF en página exacta (PDF.js viewer)
- v1.3: Multi-document conversations con memoria
- v1.4: Re-ranker (Cohere o cross-encoder local) cuando los volúmenes lo justifiquen
- v1.5: Agente con tools (search web, calculadora) sobre el corpus
- v2.0: Langfuse self-host + migración optativa a vector DB dedicado (Qdrant) si >10M chunks

## 13. Costo estimado del demo (para poner en README)

Asumiendo uso de portfolio: 50 PDFs ingeridos (10 pgs c/u promedio) + 200 queries en chat al mes:

- **Supabase** (Free): $0 — DB hasta 500MB, Storage 1GB, Auth 50k MAU
- **Vercel** (Hobby): $0 — 100GB bandwidth, builds ilimitados para hobby
- **Inngest** (Free): $0 — 50k step runs/mes
- **Upstash Redis** (Free): $0 — 10k requests/día
- **OpenAI**:
  - Embeddings ingest: 50 docs × ~5K tokens = 250K tokens × $0.02/1M = **$0.005**
  - Embeddings de queries: 200 × ~10 tokens = 2K tokens = ~$0.0001
  - Chat: 200 queries × (3K input + 400 output) = 600K input + 80K output → 600K × $0.15/1M + 80K × $0.60/1M = **$0.14**
  - **Total OpenAI: ~$0.15 USD/mes**
- **Total mensual: ~$0.15 USD** (literalmente céntimos)
