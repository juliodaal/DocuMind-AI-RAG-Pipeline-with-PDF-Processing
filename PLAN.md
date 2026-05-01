# DocuMind AI — Plan de ejecución (1 día)

> Plan granular por fases. Tiempo estimado total: **9–10 horas**. Marca cada checkbox conforme avanzas.

**Antes de empezar — pre-requisitos** (15 min):

- [x] Cuenta Supabase (proyecto nuevo free tier; Storage habilitado por defecto)
- [x] Cuenta OpenAI (API key — usaremos `gpt-4o-mini` y `text-embedding-3-small`, cuesta céntimos)
- [x] Cuenta Inngest (free tier — 50k step runs/mes)
- [x] Cuenta Upstash (Redis free tier — 10k req/día)
- [x] Node 22.16.0 + pnpm 10.11.0 instalados
- [ ] Cuenta Vercel conectada a GitHub (free hobby tier) — pendiente para Fase 9
- [x] Git configurado localmente

---

## FASE 0 — Setup del proyecto ✅ COMPLETADA

> Commit: `0500af0 chore: project scaffold (Fase 0)`. Verificado con `pnpm typecheck` y `pnpm build`.

### 0.1 Inicializar repo ✅

- [x] Next.js 15 (16.2.4) + React 19.2.4 + Tailwind v4 + TypeScript 5 con `pnpm create next-app@latest`
- [x] Creado en `/tmp` con nombre válido (`documind-ai-init`) y movido a `D:\code\SaaS\DocuMind AI\` por restricción de naming de npm (espacios y mayúsculas)
- [x] Branch `main` con `git init -b main`
- [x] `.gitignore` extendido: env files, coverage, playwright-report, test-results, .vscode, .idea, logs

### 0.2 Tooling de calidad ✅

- [x] Vitest 4.1.5 + @vitest/ui + @vitejs/plugin-react + Testing Library (react/jest-dom/user-event) + jsdom
- [x] Playwright 1.59 + Chromium browser
- [x] Prettier 3.8.3 + prettier-plugin-tailwindcss + eslint-config-prettier
- [x] Husky 9.1.7 + lint-staged 16.4.0 (pre-commit hook activo)
- [x] tsx 4.21 + Zod 4.4.1
- [x] `vitest.config.ts` con jsdom + alias `@/*` + setup file
- [x] `playwright.config.ts` con baseURL, retain-on-failure traces/screenshots/videos
- [x] `.prettierrc.json` + `.prettierignore`
- [x] `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `forceConsistentCasingInFileNames`, target ES2022
- [x] Husky pre-commit hook ejecuta `pnpm exec lint-staged`
- [x] Scripts en `package.json`: `dev`, `build`, `lint`, `lint:fix`, `typecheck`, `format`, `format:check`, `test`, `test:watch`, `test:ui`, `test:e2e`, `test:e2e:ui`, `eval`, `prepare`

### 0.3 shadcn/ui ✅

- [x] `shadcn@latest init --defaults` (preset: base-nova, Tailwind v4 detectado)
- [x] 15 componentes agregados: button, input, textarea, card, dialog, dropdown-menu, sonner, avatar, badge, skeleton, scroll-area, label, alert, tooltip, separator
- [x] `lib/utils.ts` con `cn()` helper (clsx + tailwind-merge)

### 0.4 Variables de entorno ✅

- [x] `.env.example` con todas las claves documentadas
- [x] `.env.local` con valores reales (en .gitignore)
- [x] `lib/env.ts` con validación Zod (server schema + client schema separados, `isServer` detection)
- [x] `scripts/check-env.ts` para verificar parsing — todas las 11 keys cargan OK
- Variables validadas:
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
  - OpenAI: `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL` (default `gpt-4o-mini`), `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
  - Inngest: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (opcionales en dev)
  - Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (opcionales)

### 0.5 Estructura de carpetas ✅

- [x] `app/api/{chat,inngest,upload}/`
- [x] `components/{chat,documents,workspace,ui}/` (15 componentes shadcn)
- [x] `lib/{auth,db/queries,storage,ingestion,rag,llm,ratelimit,observability,inngest}/`
- [x] `supabase/migrations/`
- [x] `tests/{unit,integration,e2e,eval,fixtures}/` con `tests/setup.ts`
- [x] `.github/workflows/`
- [x] `scripts/` (utility scripts)
- [x] `README.md` profesional con badges, stack, quickstart, scripts
- [x] `.nvmrc` con Node 20

### Verificaciones de Fase 0 ✅

- [x] `pnpm typecheck` → 0 errores
- [x] `pnpm build` → 4 rutas estáticas generadas, sin warnings críticos
- [x] Pre-commit hook verificado: prettier reformateó automáticamente al commit
- [x] `pnpm exec tsx scripts/check-env.ts` → todas las env vars parseadas correctamente

---

## FASE 1 — Auth + Multi-tenancy ✅ COMPLETADA

> Migraciones aplicadas, trigger de signup verificado E2E (programmatically), middleware redirige correctamente.

### 1.1 Supabase setup ✅

- [x] Email auth habilitado por defecto en Supabase (gestión: dashboard → Authentication → Providers)
- [x] Instalado `@supabase/supabase-js` + `@supabase/ssr` + `supabase` CLI (devDep) + `@next/env` (devDep)
- [x] `lib/auth/server.ts` — `createClient()` server-side con cookies (`@supabase/ssr` `createServerClient`)
- [x] `lib/auth/client.ts` — `createClient()` browser-side
- [x] `lib/auth/admin.ts` — service-role client (bypass RLS, server-only, `persistSession: false`)
- [x] `lib/auth/middleware.ts` — refresca sesión en cada request + redirect a `/login` si no auth + redirect a `/dashboard` si auth en login/signup
- [x] `middleware.ts` (root) — matcher excluye assets estáticos
- [x] `lib/auth/require-org.ts` — `requireOrg(workspaceId)`, `requireUser()`, `listUserOrgs(userId)`

### 1.2 Migraciones — schema base ✅

- [x] `supabase/migrations/0001_init.sql`:
  - `profiles` (id ref auth.users, email, full_name, avatar_url, created_at) + index en email
  - `organizations` (id, name, slug unique, owner_id ref profiles, plan enum default 'free', created_at) + index en owner_id
  - `organization_members` (org_id, user_id, role enum, joined_at, PK compuesta) + index en user_id
  - Trigger `on_auth_user_created` → función `handle_new_user()` (security definer):
    - Crea profile usando `raw_user_meta_data.full_name` o local-part del email como fallback
    - Crea org personal con slug único (genera `-{md5}` random suffix si colisiona, hasta 5 reintentos)
    - Inserta membership como owner
    - Todo atómico dentro del trigger
- [ ] **Pendiente: aplicar a la DB** vía Supabase CLI (requiere PAT del usuario)

### 1.3 RLS policies (parte 1) ✅

- [x] `supabase/migrations/0002_rls_base.sql`:
  - Helpers SQL `is_org_member(org)` y `org_role(org)` con `security definer + stable` para evitar recursión
  - `profiles`: select/update own (id = auth.uid())
  - `organizations`: select si es member, update si role in (owner, admin)
  - `organization_members`: select si compartes org, insert/update/delete si role in (owner, admin)
  - GRANT EXECUTE de los helpers a `authenticated`

### 1.4 UI de auth ✅

- [x] `app/(auth)/layout.tsx` — layout centrado con logo
- [x] `app/(auth)/login/page.tsx` — passes `next` searchParam
- [x] `app/(auth)/signup/page.tsx`
- [x] `app/(auth)/actions.ts` — `loginAction`, `signupAction`, `logoutAction` (Server Actions con Zod validation, `useActionState` compatible)
- [x] `components/auth/AuthForm.tsx` — form client component con `useActionState` + `useFormStatus`, validation errors inline, alert para errores de servidor
- [x] `components/ui/sonner` — Toaster montado en root layout

### 1.5 Layout dashboard + workspace switcher ✅

- [x] `app/(dashboard)/layout.tsx` — gate con `requireUser()` + carga `listUserOrgs()`, redirige a `/login` si no hay orgs (edge case)
- [x] `components/workspace/DashboardShell.tsx` — header con logo + workspace switcher + nav (Overview, Documents, Chat) + user menu con sign out
- [x] WorkspaceSwitcher embedded — dropdown listando orgs con role badge
- [x] `app/(dashboard)/dashboard/page.tsx` — auto-redirect a primer workspace del user
- [x] `app/(dashboard)/w/[workspaceId]/page.tsx` — placeholder con cards de Documents + Chat
- [x] `app/page.tsx` — landing pública con CTA a signup/login
- [x] Metadata: title template `%s · DocuMind AI`

### 1.6 Verificaciones técnicas ✅

- [x] `pnpm typecheck` → 0 errores
- [x] `pnpm build` → todas las rutas compilan (`/`, `/login`, `/signup`, `/dashboard`, `/w/[workspaceId]`) + middleware activo

### 1.7 Aplicación a DB y verificación E2E ✅

- [x] `pnpm dlx supabase link --project-ref <ref> --password <db-pwd>` con SUPABASE_ACCESS_TOKEN (PAT)
- [x] `pnpm dlx supabase db push` aplicó 0001 + 0002 + 0003 sin errores
- [x] Migración correctiva 0003 — `organizations.owner_id ON DELETE CASCADE` (descubierto via test E2E que RESTRICT bloqueaba la limpieza de users)
- [x] `scripts/check-db.ts` — confirma que tablas `profiles`, `organizations`, `organization_members` existen y los helpers RPC `is_org_member` están expuestos
- [x] `scripts/check-signup-trigger.ts` — crea user vía admin API → verifica que profile, org y membership se crean automáticamente → CASCADE delete limpia todo. PASSED
- [x] `scripts/cleanup-test-data.ts` — utilitario para limpiar orphan test users
- [x] Smoke tests del dev server:
  - `GET /` → 200 (landing pública)
  - `GET /login` → 200
  - `GET /signup` → 200
  - `GET /dashboard` (sin sesión) → 307 redirect a `/login` ✅ middleware funcionando
- [x] Commit: `feat(auth): supabase auth + multi-tenant orgs with RLS`

---

## FASE 2 — Schema de documentos + storage (40 min)

## FASE 2 — Schema de documentos + Storage ✅ COMPLETADA

> 4 migraciones aplicadas, pgvector + Storage round-trip verificados E2E.

### 2.1 Migración pgvector + tablas RAG ✅

- [x] `supabase/migrations/0004_documents.sql`:
  - `create extension if not exists vector;`
  - `documents` table: id, org_id (CASCADE), uploader_id (SET NULL), filename, mime_type, storage_path, size_bytes, sha256, status (CHECK enum), error, page_count, created_at, processed_at
  - `document_chunks` table: id, document_id (CASCADE), org_id (CASCADE), chunk_index, content, **content_tsv tsvector GENERATED ALWAYS AS** (no trigger needed), embedding vector(1536), page_number, token_count, metadata jsonb, created_at; UNIQUE (document_id, chunk_index)
  - `usage_events` table: id, org_id, user_id, kind (CHECK), model, tokens_in, tokens_out, cost_cents (numeric 10,4), metadata jsonb, created_at — para per-tenant LLM cost tracking

### 2.2 Índices ✅

- [x] `supabase/migrations/0005_indexes.sql`:
  - `documents`: btree (org_id, status) + (org_id, created_at desc) + (uploader_id)
  - `document_chunks`: HNSW vector_cosine_ops + GIN content_tsv + btree (org_id, document_id) + btree (document_id, chunk_index)
  - `usage_events`: btree (org_id, created_at desc) + (org_id, kind)

### 2.3 RLS sobre RAG tables ✅

- [x] `supabase/migrations/0006_rls_documents.sql`:
  - `documents`: SELECT/INSERT/UPDATE si member; DELETE si owner/admin OR uploader; INSERT requires `uploader_id = auth.uid()`
  - `document_chunks`: SELECT si member only; INSERT/UPDATE/DELETE solo via service role (Inngest worker)
  - `usage_events`: SELECT si owner/admin only; INSERT solo via service role

### 2.4 Supabase Storage setup ✅

- [x] `supabase/migrations/0007_storage.sql`:
  - Bucket `documents` creado: private, max 25MB, allowed_mime_types=['application/pdf']
  - Policies sobre `storage.objects` que validan `(string_to_array(name, '/'))[1]::uuid` contra `is_org_member()`
  - Path layout: `{org_id}/{document_id}/{slugified-filename}`
- [x] `lib/storage/keys.ts`:
  - `STORAGE_BUCKET = "documents"`, `MAX_FILE_BYTES = 25MB`, `ALLOWED_MIME_TYPES = ["application/pdf"]`
  - `slugifyFilename()` — lowercase, strip diacritics, replace non-alphanum, preserve extension
  - `documentKey(orgId, docId, filename)` y `parseDocumentKey()`
  - `validateUpload()` — defense-in-depth para client-side
- [x] `lib/storage/supabase.ts`:
  - `getSignedUploadUrl(path)` — para PUT directo del browser
  - `getSignedDownloadUrl(path, expiresInSec=300)` — descarga temporal
  - `downloadObject(path)` — server-side blob (Inngest worker)
  - `deleteObject(path)`

### 2.5 Database types + query helpers ✅

- [x] `lib/db/types.ts` — types hand-rolled mirror del schema (Profile, Organization, Document, DocumentChunk, UsageEvent, etc.)
- [x] `lib/db/queries/documents.ts`:
  - `createUploadSession()` — insert document row + sign upload URL
  - `markQueued()`, `updateDocumentStatus()` — usados por Inngest worker
  - `listDocumentsForOrg()`, `getDocument()` — RLS-aware reads via user session

### 2.6 Verificaciones técnicas ✅

- [x] `pnpm typecheck` → 0 errores
- [x] `pnpm build` → todas las rutas compilan
- [x] `scripts/check-vector.ts` — crea user → org → document → chunk con embedding 1536-dim → verifica content_tsv generado → query vector ORDER BY distance → cleanup PASSED
- [x] `scripts/check-storage.ts` — bucket privado validado → signed upload URL → PUT → download (bytes match) → delete → PASSED

### 2.7 Commit

- [ ] Commit: `feat(db): documents + chunks schema with pgvector and Supabase Storage`

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
