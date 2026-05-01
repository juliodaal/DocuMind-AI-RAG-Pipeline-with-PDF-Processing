-- Fix: organizations.owner_id should CASCADE on profile deletion.
-- Rationale: when a user is deleted (account deletion or admin cleanup), their owned
-- personal organization and all its data should be removed. RESTRICT made user deletion
-- impossible without manual cleanup.

alter table public.organizations
  drop constraint if exists organizations_owner_id_fkey;

alter table public.organizations
  add constraint organizations_owner_id_fkey
    foreign key (owner_id) references public.profiles(id)
    on delete cascade;
