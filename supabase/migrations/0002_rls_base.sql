-- DocuMind AI — RLS policies for base tables
-- profiles: users see/edit their own profile only
-- organizations: members can see; owners/admins can update
-- organization_members: visible to fellow members of the same org

-- ============================================================================
-- Helper: returns true if the auth.uid() is a member of the given org
-- SECURITY DEFINER + STABLE so it can be used in RLS without recursion.
-- ============================================================================
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org and user_id = auth.uid()
  );
$$;

create or replace function public.org_role(target_org uuid)
returns public.org_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.organization_members
  where org_id = target_org and user_id = auth.uid();
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.org_role(uuid) to authenticated;

-- ============================================================================
-- profiles
-- ============================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- profiles_insert: handled by trigger as security definer; no client insert allowed.

-- ============================================================================
-- organizations
-- ============================================================================
alter table public.organizations enable row level security;

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

drop policy if exists "organizations_update_admin" on public.organizations;
create policy "organizations_update_admin"
  on public.organizations for update
  to authenticated
  using (public.org_role(id) in ('owner', 'admin'))
  with check (public.org_role(id) in ('owner', 'admin'));

-- organizations_insert: only via trigger or service role (no client insert)
-- organizations_delete: only via service role for now

-- ============================================================================
-- organization_members
-- ============================================================================
alter table public.organization_members enable row level security;

drop policy if exists "members_select_same_org" on public.organization_members;
create policy "members_select_same_org"
  on public.organization_members for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "members_insert_admin" on public.organization_members;
create policy "members_insert_admin"
  on public.organization_members for insert
  to authenticated
  with check (public.org_role(org_id) in ('owner', 'admin'));

drop policy if exists "members_delete_admin" on public.organization_members;
create policy "members_delete_admin"
  on public.organization_members for delete
  to authenticated
  using (public.org_role(org_id) in ('owner', 'admin'));

drop policy if exists "members_update_admin" on public.organization_members;
create policy "members_update_admin"
  on public.organization_members for update
  to authenticated
  using (public.org_role(org_id) in ('owner', 'admin'))
  with check (public.org_role(org_id) in ('owner', 'admin'));
