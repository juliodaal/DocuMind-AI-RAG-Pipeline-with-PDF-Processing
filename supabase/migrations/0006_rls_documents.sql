-- RLS for documents, document_chunks, usage_events.
-- Service role (used by Inngest worker) bypasses RLS automatically.

-- ============================================================================
-- documents
-- ============================================================================
alter table public.documents enable row level security;

drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member"
  on public.documents for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "documents_insert_member" on public.documents;
create policy "documents_insert_member"
  on public.documents for insert
  to authenticated
  with check (
    public.is_org_member(org_id)
    and uploader_id = auth.uid()
  );

drop policy if exists "documents_update_member" on public.documents;
create policy "documents_update_member"
  on public.documents for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "documents_delete_admin" on public.documents;
create policy "documents_delete_admin"
  on public.documents for delete
  to authenticated
  using (
    public.org_role(org_id) in ('owner', 'admin')
    or uploader_id = auth.uid()
  );

-- ============================================================================
-- document_chunks
-- Only readable by members. Writes happen via service role (Inngest worker).
-- ============================================================================
alter table public.document_chunks enable row level security;

drop policy if exists "chunks_select_member" on public.document_chunks;
create policy "chunks_select_member"
  on public.document_chunks for select
  to authenticated
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated. Service role bypasses RLS.

-- ============================================================================
-- usage_events: read-only for org members (admin/owner only)
-- ============================================================================
alter table public.usage_events enable row level security;

drop policy if exists "usage_select_admin" on public.usage_events;
create policy "usage_select_admin"
  on public.usage_events for select
  to authenticated
  using (public.org_role(org_id) in ('owner', 'admin'));

-- Inserts via service role only.
