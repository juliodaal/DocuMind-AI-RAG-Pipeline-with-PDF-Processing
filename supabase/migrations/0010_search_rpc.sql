-- DocuMind AI — Hybrid search RPC functions
-- vector_search: cosine similarity via HNSW index
-- fulltext_search: BM25-like ranking via GIN tsvector index
-- Both filter by org_id (defense-in-depth) and only return chunks from
-- documents that finished ingestion (status='ready').

create or replace function public.vector_search(
  query_embedding vector(1536),
  match_org_id uuid,
  match_count int default 20
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_filename text,
  chunk_index int,
  content text,
  page_number int,
  similarity float
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.filename as document_filename,
    c.chunk_index,
    c.content,
    c.page_number,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  inner join public.documents d on d.id = c.document_id
  where c.org_id = match_org_id
    and d.status = 'ready'
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.fulltext_search(
  query_text text,
  match_org_id uuid,
  match_count int default 20
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_filename text,
  chunk_index int,
  content text,
  page_number int,
  rank float
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.filename as document_filename,
    c.chunk_index,
    c.content,
    c.page_number,
    ts_rank(c.content_tsv, websearch_to_tsquery('english', query_text)) as rank
  from public.document_chunks c
  inner join public.documents d on d.id = c.document_id
  where c.org_id = match_org_id
    and d.status = 'ready'
    and c.content_tsv @@ websearch_to_tsquery('english', query_text)
  order by rank desc
  limit match_count;
$$;

-- These RPCs run as the calling user. RLS on document_chunks/documents already
-- restricts to org members, but we also enforce match_org_id in the WHERE for
-- predicate pushdown and clearer intent.

grant execute on function public.vector_search(vector, uuid, int) to authenticated, service_role;
grant execute on function public.fulltext_search(text, uuid, int) to authenticated, service_role;
