-- Stage 12c: Two-step sign-in and an audit log
-- 1. owner_access(): 'owner', 'needs_mfa' or 'not_owner'. Once the owner turns on
--    two-step sign-in (Settings), a session only counts as the owner after the
--    authenticator code is entered (Supabase's aal2), so a stolen password alone
--    can't read or change any data. is_owner(), used by every RLS policy, now uses it.
-- 2. audit_log: every change to family data, kept for a year by the daily job.
--    A restore is logged as one entry instead of one per row.

-- Two-step sign-in ------------------------------------------------------------------

create or replace function public.owner_access()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.app_owner where user_id = (select auth.uid())
    ) then 'not_owner'
    when coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
      and exists (
        select 1 from auth.mfa_factors
        where user_id = (select auth.uid()) and status = 'verified'
      ) then 'needs_mfa'
    else 'owner'
  end;
$$;

revoke execute on function public.owner_access() from public, anon;
grant execute on function public.owner_access() to authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.owner_access() = 'owner';
$$;

-- Audit log ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert', 'update', 'delete', 'restore')),
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Changes to family data. Written by triggers; the daily job deletes entries older than a year.';

create index audit_log_changed_at_idx on public.audit_log (changed_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "Owner can read"
  on public.audit_log for select
  to authenticated
  using ((select public.is_owner()));

-- The daily job prunes old entries with the secret key.
grant select, delete on public.audit_log to service_role;

create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if current_setting('app.skip_audit', true) = 'on' then
    return null;
  end if;
  -- Saving a form without changing anything only touches updated_at.
  if tg_op = 'UPDATE' and (old_row - 'updated_at') = (new_row - 'updated_at') then
    return null;
  end if;

  insert into public.audit_log (table_name, row_id, action, old_data, new_data)
  values (
    tg_table_name,
    coalesce(new_row ->> 'id', old_row ->> 'id', new_row ->> 'instrument_id', old_row ->> 'instrument_id'),
    lower(tg_op),
    old_row,
    new_row
  );
  return null;
end;
$$;

do $$
declare
  audited text;
begin
  foreach audited in array array[
    'members', 'broker_accounts', 'transactions', 'mf_transactions', 'crypto_transactions',
    'fixed_deposits', 'other_assets', 'ipo_applications', 'corporate_actions',
    'watchlists', 'watchlist_items', 'market_holidays'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.record_audit()',
      audited || '_audit', audited
    );
  end loop;
end;
$$;

-- Restore: one audit entry for the whole restore. The rows are restored by
-- restore_family_rows (the previous restore_family_data); change that function
-- in later migrations, not this wrapper.

alter function public.restore_family_data(jsonb) rename to restore_family_rows;
revoke execute on function public.restore_family_rows(jsonb) from public, anon, authenticated;

create function public.restore_family_data(backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform set_config('app.skip_audit', 'on', true);
  result := public.restore_family_rows(backup);
  perform set_config('app.skip_audit', 'off', true);

  insert into public.audit_log (table_name, action, new_data)
  values ('backup', 'restore', result);
  return result;
end;
$$;

revoke execute on function public.restore_family_data(jsonb) from public, anon;
grant execute on function public.restore_family_data(jsonb) to authenticated;
