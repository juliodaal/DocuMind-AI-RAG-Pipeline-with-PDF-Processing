# DocuMind AI — Plan de ejecución (1 día)

> Plan granular por fases. Tiempo estimado total: **9–10 horas**. Marca cada checkbox conforme avanzas.

**Antes de empezar — pre-requisitos** (15 min):

- [ ] Cuenta Supabase (proyecto nuevo free tier; Storage habilitado por defecto)
- [ ] Cuenta OpenAI (API key — usaremos `gpt-4o-mini` y `text-embedding-3-small`, cuesta céntimos)
- [ ] Cuenta Inngest (free tier — 50k step runs/mes)
- [ ] Cuenta Upstash (Redis free tier — 10k req/día)
- [ ] Node 20+ instalado, pnpm preferido (`npm i -g pnpm` si no lo tienes)
- [ ] Cuenta Vercel conectada a GitHub (free hobby tier)
- [ ] Git configurado localmente

---

## FASE 0 — Setup del proyecto (40 min)

### 0.1 Inicializar repo

- [ ] `pnpm dlx create-next-app@latest documind-ai --ts --tailwind --app --src-dir=false --import-alias="@/*"`
- [ ] `cd documind-ai && git init && git branch -M main`
- [ ] Crear `.gitignore` extra: `.env.local`, `.env.*.local`, `coverage/`, `playwright-report/`, `test-results/`

### 0.2 Tooling de calidad

- [ ] Instalar: `pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom`
- [ ] Instalar: `pnpm add -D @playwright/test`
- [ ] Instalar: `pnpm add -D eslint-config-prettier prettier prettier-plugin-tailwindcss`
- [ ] Instalar: `pnpm add -D husky lint-staged`
- [ ] Configurar `vitest.config.ts` con alias `@/*` y `setupFiles`
- [ ] Configurar `playwright.config.ts` (baseURL `http://localhost:3000`)
- [ ] Configurar `.prettierrc` + `.prettierignore`
- [ ] Configurar `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] `npx husky init` + hook `pre-commit` con `lint-staged`
- [ ] Scripts en `package.json`: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, `format`

### 0.3 shadcn/ui

- [ ] `pnpm dlx shadcn@latest init` (estilo: New York, base color: slate, RSC: yes)
- [ ] `pnpm dlx shadcn@latest add button input textarea card dialog dropdown-menu sonner avatar badge skeleton scroll-area`

### 0.4 Variables de entorno

- [ ] Crear `.env.example` con todas las claves (sin valores)
- [ ] Crear `.env.local` con valores reales
- [ ] Validar env vars con `zod` en `lib/env.ts` (T3-style):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET     # ej: "documents"
OPENAI_API_KEY
OPENAI_CHAT_MODEL           # default: "gpt-4o-mini"
OPENAI_EMBEDDING_MODEL      # default: "text-embedding-3-small"
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### 0.5 Estructura de carpetas

- [ ] Crear todas las carpetas del árbol definido en ARCHITECTURE.md sección 7
- [ ] Commit inicial: `chore: project scaffold`

---

## FASE 1 — Auth + Multi-tenancy (60 min)

### 1.1 Supabase setup

- [ ] En el dashboard Supabase: habilitar email auth (sin confirmación para dev)
- [ ] (Opcional) Habilitar Google OAuth
- [ ] Instalar: `pnpm add @supabase/supabase-js @supabase/ssr`
- [ ] Crear `lib/auth/server.ts` (cliente server-side con cookies)
- [ ] Crear `lib/auth/client.ts` (cliente browser)
- [ ] Crear `middleware.ts` que refresca sesión y redirige `/login` si no autenticado en `/(dashboard)`

### 1.2 Migraciones — schema base

- [ ] `pnpm dlx supabase init` + `pnpm dlx supabase login` + `pnpm dlx supabase link`
- [ ] Crear `supabase/migrations/0001_init.sql`:
  - `profiles` (id ref auth.users, email, full_name, avatar_url, created_at)
  - `organizations` (id, name, slug unique, owner_id, plan default 'free', created_at)
  - `organization_members` (org_id, user_id, role enum 'owner'|'admin'|'member', joined_at, PK compuesta)
  - Trigger: al crear user en auth.users → insert profile + crear org personal + insert member as owner
- [ ] `pnpm dlx supabase db push` (o aplicar via SQL editor)

### 1.3 RLS policies (parte 1)

- [ ] Crear `supabase/migrations/0002_rls_base.sql`:
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para todas
  - `profiles`: select/update own
  - `organizations`: select si es member; update si owner/admin
  - `organization_members`: select si compartes org

### 1.4 UI de auth

- [ ] `app/(auth)/login/page.tsx` — formulario email + password (Server Action)
- [ ] `app/(auth)/signup/page.tsx`
- [ ] `app/(auth)/layout.tsx` — layout centrado
- [ ] Server Actions en `app/(auth)/actions.ts`: `login`, `signup`, `logout`
- [ ] Toast de errores con `sonner`

### 1.5 Layout dashboard + workspace switcher

- [ ] `app/(dashboard)/layout.tsx` — sidebar + topbar
- [ ] `components/workspace/WorkspaceSwitcher.tsx` (dropdown con orgs del user)
- [ ] Helper `lib/auth/require-org.ts`: lee cookie `currentOrgId`, valida membership, devuelve `{ user, org }` o redirect
- [ ] `/w/[workspaceId]/page.tsx` — placeholder dashboard
- [ ] Test manual: signup → login → ver workspace personal

**Commit**: `feat(auth): supabase auth + multi-tenant orgs with RLS`

---

## FASE 2 — Schema de documentos + storage (40 min)

### 2.1 Migración pgvector + tablas RAG

- [ ] `supabase/migrations/0003_pgvector.sql`:
  - `CREATE EXTENSION IF NOT EXISTS vector;`
  - Tabla `documents` (campos en ARCHITECTURE.md §4)
  - Tabla `document_chunks` con `embedding vector(1536)`, `content_tsv tsvector`
  - Trigger para mantener `content_tsv` (update on insert/update of content)

### 2.2 Índices

- [ ] `supabase/migrations/0004_indexes.sql`:
  - `CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);`
  - `CREATE INDEX ON document_chunks USING gin (content_tsv);`
  - `CREATE INDEX ON document_chunks (org_id, document_id);`
  - `CREATE INDEX ON documents (org_id, status);`

### 2.3 RLS sobre RAG tables

- [ ] `supabase/migrations/0005_rls_rag.sql`:
  - `documents`: select/insert/update/delete si user es member del `org_id`
  - `document_chunks`: select si user es member del `org_id`
  - Service role bypassea RLS (usado por Inngest worker)

### 2.4 Supabase Storage setup

- [ ] En el dashboard Supabase → Storage → crear bucket `documents` (private)
- [ ] `supabase/migrations/0006_storage_policies.sql` — políticas sobre `storage.objects` para el bucket `documents`:
  - SELECT/INSERT/UPDATE/DELETE permitido si `(storage.foldername(name))[1]::uuid` está en los `org_id` del user (vía `organization_members`)
  - Esto garantiza que el path `{org_id}/{doc_id}/{filename}` solo es accesible para members de ese org
- [ ] Verificar que el bucket NO tiene "Public bucket" activado
- [ ] `lib/storage/supabase.ts`:
  - `getSignedUploadUrl(path, opts)` — usa `supabase.storage.from('documents').createSignedUploadUrl(path)`
  - `getSignedDownloadUrl(path, expiresIn=300)` — `createSignedUrl(path, expiresIn)`
  - `downloadObject(path)` — server-side con service role key, para el worker Inngest
  - `deleteObject(path)`
- [ ] `lib/storage/keys.ts`: `documentKey(orgId, docId, filename)` → `${orgId}/${docId}/${slugify(filename)}`

**Commit**: `feat(db): documents + chunks schema with pgvector and Supabase Storage`

---

## FASE 3 — Ingesta de documentos (110 min)

### 3.1 UI de upload

- [ ] `pnpm add react-dropzone`
- [ ] `components/documents/UploadZone.tsx` — drag & drop, multi-file, valida tipo (`.pdf`) y tamaño (max 25MB)
- [ ] `app/(dashboard)/w/[workspaceId]/documents/page.tsx` — lista + zona de upload
- [ ] `components/documents/DocumentList.tsx` — server component, renderiza tabla con status
- [ ] `components/documents/StatusBadge.tsx` — colores por status

### 3.2 Server Actions de upload

- [ ] `app/(dashboard)/w/[workspaceId]/documents/actions.ts`:
  - `createUploadSession(filename, mime, size)`:
    1. valida org membership
    2. INSERT documents (status='uploading')
    3. genera signed upload URL de Supabase Storage para `documents/{org_id}/{doc_id}/{filename}`
    4. return `{ documentId, uploadUrl, token, path }`
  - `confirmUpload(documentId)`: marca `status='queued'`, dispara evento Inngest `document/uploaded`

### 3.3 Inngest setup

- [ ] Instalar: `pnpm add inngest`
- [ ] `lib/inngest/client.ts` — cliente Inngest
- [ ] `app/api/inngest/route.ts` — handler con `serve({ client, functions: [...] })`
- [ ] Función `ingest.document` triggered por `document/uploaded` con steps:
  1. `step.run("fetch-from-storage", ...)` — descarga objeto de Supabase Storage (service role)
  2. `step.run("parse-pdf", ...)` — extrae texto + page map
  3. `step.run("chunk", ...)` — split en chunks
  4. `step.run("embed-batch-N", ...)` — embeddings batch (uno por batch para retry granular)
  5. `step.run("upsert-chunks", ...)` — insert en DB
  6. `step.run("mark-ready", ...)` — update documents.status, emit usage_events

### 3.4 Parser PDF

- [ ] Instalar: `pnpm add unpdf`
- [ ] `lib/ingestion/parser.ts`: `parsePdf(buffer): Promise<{ pages: { number, text }[] }>`
- [ ] Test unit con PDF de muestra (`tests/fixtures/sample.pdf`)

### 3.5 Chunker

- [ ] Instalar: `pnpm add langchain @langchain/textsplitters`
- [ ] `lib/ingestion/chunker.ts`:
  - usa `RecursiveCharacterTextSplitter` (chunkSize 800, overlap 120)
  - input: `pages`, output: `Chunk[]` con `{ content, pageNumber, index, tokenCount }`
  - usa `tiktoken` para `tokenCount` exacto (`pnpm add tiktoken`)

### 3.6 Embedder

- [ ] Instalar: `pnpm add openai`
- [ ] `lib/llm/openai.ts` — cliente
- [ ] `lib/ingestion/embedder.ts`:
  - `embedBatch(texts: string[]): Promise<number[][]>`
  - batch size 100, concurrency 3 con `p-limit`
  - retry con exponential backoff (3 intentos)

### 3.7 Pipeline integrado

- [ ] `lib/ingestion/pipeline.ts` — orquesta parser → chunker → embedder → DB upsert
- [ ] Insert batch (chunks con embedding) usando `postgres-js` o supabase admin client
- [ ] Tracking en `usage_events` (tokens consumidos)

### 3.8 Realtime status

- [ ] En cliente: `supabase.channel('documents').on('postgres_changes', ...)` sobre filas del org
- [ ] Actualiza UI sin polling

### 3.9 Test manual end-to-end

- [ ] Sube un PDF real, verifica:
  - aparece en lista con status 'queued'
  - cambia a 'processing' → 'ready' (≤ 30s para PDF de 10 pgs)
  - chunks visibles en DB con embeddings no-null

**Commit**: `feat(ingestion): pdf upload + async parse/chunk/embed pipeline`

---

## FASE 4 — RAG query pipeline (110 min)

### 4.1 Retriever

- [ ] `lib/rag/retriever.ts`:
  - `vectorSearch(orgId, queryEmbedding, k=20)` — SQL con `ORDER BY embedding <=> $1 LIMIT k`
  - `fulltextSearch(orgId, query, k=20)` — SQL con `ts_rank(content_tsv, plainto_tsquery('english', $1))`
  - `hybridSearch(orgId, query)`:
    1. embed query
    2. ejecuta ambos en paralelo
    3. fusiona con RRF (k=60): `score = sum(1 / (60 + rank))`
    4. dedup por chunk_id, top 10

### 4.2 Tests del retriever

- [ ] `tests/unit/rrf.test.ts` — RRF con casos sintéticos
- [ ] `tests/integration/retriever.test.ts` — con DB seedeada (10 docs, 100 chunks)

### 4.3 Prompt + context builder

- [ ] `lib/rag/prompt.ts`:
  - System prompt cacheable (Anthropic prompt caching) con instrucciones de cita estricta
  - `buildContext(chunks)`: numera `[1] ... [n]` con header `Source: {filename}, page {n}`
- [ ] System prompt incluye: usar SOLO el contexto, citar como `[n]`, decir "no sé" si falta info

### 4.4 LLM client (OpenAI)

- [ ] Instalar: `pnpm add ai @ai-sdk/openai openai`
- [ ] `lib/llm/openai.ts` — clientes para chat (`gpt-4o-mini`) y embeddings (`text-embedding-3-small`)
- [ ] System prompt diseñado para superar 1024 tokens estables → OpenAI lo cachea automáticamente

### 4.5 RAG pipeline endpoint

- [ ] `app/api/chat/route.ts` (POST, streaming):
  1. require-org
  2. rate limit (Upstash, key = `${orgId}:chat`, 30 req/min)
  3. extrae messages (último = pregunta)
  4. hybridSearch
  5. build prompt
  6. `streamText({ model: openai(env.OPENAI_CHAT_MODEL), system, messages, ... })` del Vercel AI SDK
  7. en `onFinish`: persistir message, citations, usage_events (tokens in/out + costo estimado en cents)

### 4.6 Citations parser

- [ ] `lib/rag/citations.ts`:
  - extrae `[1]`, `[2]` del texto generado
  - mapea a chunks usados → metadata (docId, page, filename)
  - test unit con casos: cita única, múltiples, sin citas

### 4.7 UI de chat

- [ ] `app/(dashboard)/w/[workspaceId]/chat/page.tsx` — nuevo chat
- [ ] `components/chat/ChatWindow.tsx` — usa `useChat` del Vercel AI SDK con `api: '/api/chat'`
- [ ] `components/chat/MessageList.tsx` — render markdown (`react-markdown` + `remark-gfm`)
- [ ] `components/chat/MessageInput.tsx` — textarea + enviar (Enter, Shift+Enter newline)
- [ ] `components/chat/CitationCard.tsx` — popover/dialog que muestra el chunk fuente

### 4.8 Persistencia de conversaciones

- [ ] Migración `0006_conversations.sql`: tablas `conversations`, `messages` (en ARCHITECTURE §4)
- [ ] RLS sobre ambas
- [ ] Server action `createConversation()` al primer mensaje
- [ ] `app/(dashboard)/w/[workspaceId]/chat/[convId]/page.tsx` — carga histórico

### 4.9 Test manual

- [ ] Sube doc, espera ready, pregunta algo del contenido
- [ ] Verifica streaming, citas funcionan, click abre chunk

**Commit**: `feat(rag): hybrid retrieval + streaming chat with citations`

---

## FASE 5 — Document management UI (40 min)

### 5.1 Lista mejorada

- [ ] Filtros: status, fecha
- [ ] Búsqueda por filename
- [ ] Paginación (20 por página)
- [ ] Ordenar por: fecha, nombre, tamaño

### 5.2 Detalle de documento

- [ ] `app/(dashboard)/w/[workspaceId]/documents/[docId]/page.tsx`
- [ ] Muestra: filename, páginas, chunks count, fecha procesado, tamaño
- [ ] Acción: descargar original (signed download URL de Supabase Storage)
- [ ] Acción: re-procesar (re-trigger evento Inngest)
- [ ] Acción: eliminar (cascade chunks, eliminar object de Supabase Storage)

### 5.3 Eliminación segura

- [ ] Server action con confirmación (dialog)
- [ ] Soft delete o hard delete? → hard para MVP
- [ ] Limpia Supabase Storage object, DB cascade

**Commit**: `feat(documents): detail page + delete + reprocess`

---

## FASE 6 — Conversation history (35 min)

### 6.1 Sidebar de conversaciones

- [ ] `components/chat/ConversationSidebar.tsx`
- [ ] Server component lista las últimas 50 del user
- [ ] Botón "New chat" → `/w/[workspaceId]/chat`
- [ ] Click → `/w/[workspaceId]/chat/[convId]`

### 6.2 Acciones

- [ ] Renombrar (inline edit o dialog)
- [ ] Eliminar (con confirm)
- [ ] Auto-título: al primer mensaje, generar título corto con `gpt-4o-mini` (max_tokens=20, costo ~$0.0001 por título)

**Commit**: `feat(chat): conversation sidebar + history`

---

## FASE 7 — Testing (75 min)

### 7.1 Unit tests

- [ ] `tests/unit/chunker.test.ts` — varios tamaños, edge cases (texto vacío, 1 char)
- [ ] `tests/unit/citations.test.ts` — parser
- [ ] `tests/unit/rrf.test.ts` — fusion
- [ ] `tests/unit/keys.test.ts` — tenantKey scoping
- [ ] `tests/unit/prompt.test.ts` — context builder con N chunks

### 7.2 Integration tests

- [ ] Setup: script que crea schema en DB de test (`supabase start` local), seed
- [ ] `tests/integration/ingestion.test.ts` — ingiere PDF fixture, verifica chunks insertados
- [ ] `tests/integration/retriever.test.ts` — query devuelve chunks correctos
- [ ] `tests/integration/rls.test.ts` — usuario A no ve docs de org B

### 7.3 E2E con Playwright

- [ ] `tests/e2e/auth.spec.ts` — signup, login, logout
- [ ] `tests/e2e/upload-and-chat.spec.ts`:
  1. login
  2. upload `tests/fixtures/sample.pdf`
  3. wait status=ready (timeout 60s)
  4. envía pregunta cuya respuesta esté en el doc
  5. verifica respuesta no vacía + al menos 1 cita

### 7.4 Eval LLM

- [ ] `tests/eval/golden-set.json`: 20 preguntas con respuestas esperadas + chunks esperados
- [ ] `tests/eval/run-eval.ts`:
  - corre cada pregunta
  - métricas: groundedness (cita está en respuesta), citation_recall (chunk esperado en top-5), answer_similarity (cosine vs respuesta esperada)
  - imprime tabla y promedio
- [ ] Script `pnpm eval`

### 7.5 CI

- [ ] `.github/workflows/ci.yml`:
  - jobs: lint, typecheck, test (unit+integration), build
  - Playwright como job separado (con servicio de Postgres en GitHub)

**Commit**: `test: unit + integration + e2e + eval pipeline`

---

## FASE 8 — Observability + performance (40 min)

### 8.1 Logging

- [ ] Instalar: `pnpm add pino pino-pretty`
- [ ] `lib/observability/logger.ts` — pino con `level` env-driven, transport pretty en dev
- [ ] Logs estructurados en: server actions, route handlers, Inngest functions
- [ ] Incluir `org_id`, `user_id`, `request_id` en todos los logs

### 8.2 Usage + cost tracking

- [ ] Helper `lib/llm/usage.ts`:
  - `recordUsage({ orgId, userId, kind, model, tokensIn, tokensOut })`
  - Calcula `cost_cents` con tabla local de precios:
    - `gpt-4o-mini`: $0.15/1M in, $0.60/1M out
    - `text-embedding-3-small`: $0.02/1M
  - Insert en `usage_events`
- [ ] Llamar en cada operación LLM (chat onFinish, embedder)
- [ ] Vista admin simple en `/w/[workspaceId]/settings` mostrando: tokens este mes + costo estimado

### 8.3 Rate limiting

- [ ] Instalar: `pnpm add @upstash/ratelimit @upstash/redis`
- [ ] `lib/ratelimit/index.ts` — sliding window: 30/min para chat, 10/hora para upload
- [ ] Aplicar en `/api/chat` y en server action de upload
- [ ] Devolver `429` con `Retry-After` cuando rate-limit excedido

### 8.4 Performance tweaks

- [ ] Verificar `SET hnsw.ef_search = 40` antes de queries vectoriales (ejecutar como parte del query)
- [ ] Connection pooling: usar Supabase pooler URL (pgbouncer transaction mode) en `SUPABASE_DB_URL` server-side
- [ ] System prompt estable ≥1024 tokens → cacheado automáticamente por OpenAI
- [ ] `next.config.ts`: revisar `experimental` features estables
- [ ] Imágenes con `next/image`

**Commit**: `feat(obs): logging + usage tracking + rate limiting`

---

## FASE 9 — Deploy + polish (60 min)

### 9.1 Deployment

- [ ] Push a GitHub (repo nuevo, público)
- [ ] Crear proyecto en Vercel, conectar repo
- [ ] Configurar todas las env vars en Vercel (production environment)
- [ ] Configurar Inngest app apuntando a `https://<tu-app>.vercel.app/api/inngest`
- [ ] En Supabase → Authentication → URL configuration: agregar dominio de Vercel a "Site URL" y "Redirect URLs"
- [ ] Deploy
- [ ] Smoke test: signup → upload → chat en producción

### 9.2 README profesional

- [ ] Hero: descripción + screenshot/GIF
- [ ] Stack badges
- [ ] Features lista
- [ ] Architecture diagram (link a ARCHITECTURE.md o imagen)
- [ ] Quickstart local: clone, env vars, `pnpm dev`
- [ ] Deployment guide
- [ ] Roadmap
- [ ] License

### 9.3 Demo

- [ ] Grabar GIF/video corto (30-60s) del flujo completo
- [ ] Subir a `docs/demo.gif`, embebido en README

### 9.4 Polish UX

- [ ] Loading states (skeletons en lista de docs y chat)
- [ ] Empty states (sin docs, sin chats)
- [ ] Error boundaries (`error.tsx` por route)
- [ ] 404 page
- [ ] Favicon + metadata (`metadata` export en root layout)
- [ ] Dark mode toggle (ya viene con shadcn)

### 9.5 Tag de release

- [ ] `git tag v0.1.0` + push tags
- [ ] Crear GitHub Release con notas

**Commit**: `chore: deploy v0.1.0 + readme + demo`

---

## Checklist final (antes de cerrar el día)

- [ ] App desplegada y accesible públicamente
- [ ] README claro con screenshots
- [ ] Tests pasando en CI
- [ ] Eval LLM con score documentado en README
- [ ] No hay secrets en el repo
- [ ] RLS verificado manualmente (crear 2 cuentas, no se ven docs entre sí)
- [ ] Cost tracking funcionando
- [ ] Repo público, descripción + topics: `rag`, `ai`, `nextjs`, `langchain`, `pgvector`, `multi-tenant`

---

## Si vas con prisa: orden de sacrificio

Si te quedas sin tiempo, **NO** sacrifiques en este orden (de más a menos crítico):

1. Auth + RLS multi-tenant ← núcleo del proyecto
2. Ingestion pipeline funcionando con 1 PDF
3. RAG con citas (aunque sin re-rank)
4. UI básica funcional
5. Tests unit (al menos chunker + citations + retriever)
6. Deploy
7. README con arquitectura

**Sí puedes sacrificar (en orden)**: rerank Cohere, conversation history, document re-process, dark mode polish, eval LLM completo (haz uno mini de 5 preguntas), CI completo (corre tests local).

---

## Notas

- Si algo bloquea más de 20 min, anótalo en `BLOCKERS.md` y sigue. Resuélvelo al final.
- Commits frecuentes, mensajes claros tipo conventional commits.
- No optimices prematuramente. MVP funcional > código perfecto.
- Cuando termines la fase, marca todos los checkboxes y haz commit.
