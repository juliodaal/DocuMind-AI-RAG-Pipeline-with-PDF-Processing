-- DocuMind AI — Conversations and messages
-- Used by the chat surface. Citations are stored as a jsonb array per assistant
-- message, where each citation references a chunk_id + denormalized metadata
-- (filename, page) so the UI can render without a join.

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_org_user_idx
  on public.conversations (org_id, user_id, updated_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  citations       jsonb not null default '[]'::jsonb,
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  model           text,
  latency_ms      integer,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

create index if not exists messages_org_idx
  on public.messages (org_id, created_at desc);

-- ============================================================================
-- Trigger: bump conversations.updated_at on each new message
-- ============================================================================
create or replace function public.bump_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set updated_at = now()
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.conversations enable row level security;

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
  on public.conversations for select
  to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id));

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
  on public.conversations for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_org_member(org_id));

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
  on public.conversations for update
  to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id))
  with check (user_id = auth.uid() and public.is_org_member(org_id));

drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own"
  on public.conversations for delete
  to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id));

alter table public.messages enable row level security;

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
  on public.messages for select
  to authenticated
  using (
    public.is_org_member(org_id)
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- Inserts/updates/deletes happen via service role from /api/chat onFinish.
