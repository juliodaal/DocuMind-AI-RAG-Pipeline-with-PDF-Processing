-- DocuMind AI — Documents and chunks
-- - pgvector extension
-- - documents: file metadata + ingestion status
-- - document_chunks: text chunks with vector embedding + full-text vector

create extension if not exists vector;

-- ============================================================================
-- documents: one row per uploaded file
-- ============================================================================
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  uploader_id   uuid references public.profiles(id) on delete set null,
  filename      text not null,
  mime_type     text not null,
  storage_path  text not null,           -- path within the storage bucket: {org_id}/{doc_id}/{slug}
  size_bytes    bigint not null check (size_bytes >= 0),
  sha256        text,                    -- nullable until computed by worker
  status        text not null default 'uploading'
                  check (status in ('uploading', 'queued', 'processing', 'ready', 'failed')),
  error         text,                    -- last error message when status='failed'
  page_count    integer,                 -- nullable until parsed
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

comment on column public.documents.storage_path is
  'Path inside the Supabase Storage bucket. Format: {org_id}/{doc_id}/{slugified-filename}.';
comment on column public.documents.status is
  'Ingestion lifecycle: uploading → queued → processing → ready (or failed).';

-- ============================================================================
-- document_chunks: chunks with embedding + tsvector
-- content_tsv is a stored generated column (kept in sync automatically by Postgres)
-- ============================================================================
create table if not exists public.document_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  chunk_index   integer not null,
  content       text not null,
  content_tsv   tsvector generated always as (to_tsvector('english', content)) stored,
  embedding     vector(1536),                  -- nullable until embedded
  page_number   integer,
  token_count   integer not null check (token_count >= 0),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (document_id, chunk_index)
);

comment on column public.document_chunks.embedding is
  'OpenAI text-embedding-3-small (1536 dims). Cosine similarity (<=>).';
comment on column public.document_chunks.content_tsv is
  'Generated tsvector for hybrid search BM25 leg.';

-- ============================================================================
-- usage_events: per-tenant tracking of LLM tokens + cost (cents).
-- Inserted by ingestion worker and chat endpoint.
-- ============================================================================
create table if not exists public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  kind          text not null check (kind in ('embedding', 'chat', 'rerank', 'auto_title')),
  model         text not null,
  tokens_in     integer not null default 0 check (tokens_in >= 0),
  tokens_out    integer not null default 0 check (tokens_out >= 0),
  cost_cents    numeric(10, 4) not null default 0 check (cost_cents >= 0),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.usage_events is
  'Per-tenant ledger of LLM API usage. cost_cents uses 4 decimals to capture sub-cent operations.';
