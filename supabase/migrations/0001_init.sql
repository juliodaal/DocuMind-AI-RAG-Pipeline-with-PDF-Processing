-- DocuMind AI — Initial schema
-- Tables: profiles, organizations, organization_members
-- Trigger: auto-create profile + personal organization on auth.users INSERT

set search_path = public, extensions;

-- ============================================================================
-- profiles: 1:1 mirror of auth.users with app-level metadata
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

-- ============================================================================
-- organizations: tenants. Each user gets a personal org on signup.
-- ============================================================================
create type public.org_plan as enum ('free', 'pro', 'enterprise');

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  owner_id    uuid not null references public.profiles(id) on delete restrict,
  plan        public.org_plan not null default 'free',
  created_at  timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations (owner_id);

-- ============================================================================
-- organization_members: M:N between users and orgs with role
-- ============================================================================
create type public.org_role as enum ('owner', 'admin', 'member');

create table if not exists public.organization_members (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.org_role not null default 'member',
  joined_at   timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);

-- ============================================================================
-- handle_new_user: signup trigger
-- Creates profile, personal organization, and owner membership atomically.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id   uuid;
  v_full_name text;
  v_slug      text;
  v_base_slug text;
  v_attempt   int := 0;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, v_full_name);

  v_base_slug := lower(regexp_replace(coalesce(v_full_name, 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then v_base_slug := 'workspace'; end if;

  v_slug := v_base_slug;
  loop
    begin
      insert into public.organizations (name, slug, owner_id)
      values (v_full_name || '''s workspace', v_slug, new.id)
      returning id into v_org_id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      v_slug := v_base_slug || '-' || substr(md5(random()::text), 1, 6);
      if v_attempt > 5 then raise; end if;
    end;
  end loop;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user is
  'Creates profile + personal organization + owner membership when a new auth.users row is created.';
