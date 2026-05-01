-- Indexes for documents, document_chunks, usage_events
-- HNSW for vector search, GIN for full-text, btree for filters

-- ============================================================================
-- documents
-- ============================================================================
create index if not exists documents_org_status_idx
  on public.documents (org_id, status);

create index if not exists documents_org_created_idx
  on public.documents (org_id, created_at desc);

create index if not exists documents_uploader_idx
  on public.documents (uploader_id);

-- ============================================================================
-- document_chunks
-- ============================================================================

-- Vector similarity (HNSW with cosine distance)
-- m=16, ef_construction=64 are pgvector defaults; tune later if recall suffers.
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Full-text search
create index if not exists document_chunks_content_tsv_gin_idx
  on public.document_chunks
  using gin (content_tsv);

-- Tenant + document filter (used in retriever queries)
create index if not exists document_chunks_org_doc_idx
  on public.document_chunks (org_id, document_id);

-- Listing chunks of a document in order
create index if not exists document_chunks_doc_index_idx
  on public.document_chunks (document_id, chunk_index);

-- ============================================================================
-- usage_events
-- ============================================================================
create index if not exists usage_events_org_created_idx
  on public.usage_events (org_id, created_at desc);

create index if not exists usage_events_org_kind_idx
  on public.usage_events (org_id, kind);
