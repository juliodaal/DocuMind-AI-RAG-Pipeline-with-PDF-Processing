-- Supabase Storage: private bucket "documents" + RLS-style policies.
-- Path layout: {org_id}/{document_id}/{slugified-filename}
-- Policies validate that the first path segment is an org the user belongs to.

-- ============================================================================
-- Bucket
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,                                  -- private
  26214400,                               -- 25 MB max per object
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- Storage policies on storage.objects
-- We use the public.is_org_member helper (security definer + stable).
-- The first folder of `name` is interpreted as the org_id.
-- ============================================================================

drop policy if exists "documents_objects_select_member" on storage.objects;
create policy "documents_objects_select_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and array_length(string_to_array(name, '/'), 1) >= 1
    and public.is_org_member((string_to_array(name, '/'))[1]::uuid)
  );

drop policy if exists "documents_objects_insert_member" on storage.objects;
create policy "documents_objects_insert_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and array_length(string_to_array(name, '/'), 1) >= 1
    and public.is_org_member((string_to_array(name, '/'))[1]::uuid)
  );

drop policy if exists "documents_objects_update_member" on storage.objects;
create policy "documents_objects_update_member"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and array_length(string_to_array(name, '/'), 1) >= 1
    and public.is_org_member((string_to_array(name, '/'))[1]::uuid)
  );

drop policy if exists "documents_objects_delete_member" on storage.objects;
create policy "documents_objects_delete_member"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and array_length(string_to_array(name, '/'), 1) >= 1
    and public.is_org_member((string_to_array(name, '/'))[1]::uuid)
  );
