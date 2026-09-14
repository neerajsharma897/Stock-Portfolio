-- Stage 1: Foundation
-- The app has exactly one user, the owner. The first account created in
-- Supabase Auth becomes the owner, and RLS policies in later stages call
-- public.is_owner() so nobody else can read or change any data.

-- Keeps updated_at current. Reused by every table with an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.app_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default 'Owner',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_owner is
  'Exactly one row: the only user allowed to use the app.';

create trigger app_owner_set_updated_at
  before update on public.app_owner
  for each row execute function public.set_updated_at();

-- True when the signed-in user is the owner. Used by RLS policies on every table.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_owner where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

alter table public.app_owner enable row level security;

-- Supabase grants every privilege on new tables to anon and authenticated by default.
-- Narrow that: signed-out visitors get nothing, and the owner can only change name and timezone.
revoke all on public.app_owner from anon, authenticated;
grant select on public.app_owner to authenticated;
grant update (display_name, timezone) on public.app_owner to authenticated;

create policy "Owner can read own row"
  on public.app_owner for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Owner can update own row"
  on public.app_owner for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No insert or delete policies: the row is only created by the trigger below.

create or replace function public.claim_first_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_owner (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (singleton) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_claim_owner
  after insert on auth.users
  for each row execute function public.claim_first_owner();

-- If the account already existed before this migration ran, make the oldest one the owner.
insert into public.app_owner (user_id, display_name)
select id, split_part(email, '@', 1)
from auth.users
order by created_at
limit 1
on conflict (singleton) do nothing;
