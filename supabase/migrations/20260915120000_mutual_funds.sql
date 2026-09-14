-- Stage 8: Mutual funds, entered by hand
-- mf_schemes:      every fund from AMFI's NAVAll.txt with its latest and previous NAV.
--                  Keyed by AMFI scheme code, which is the same in every database.
-- mf_transactions: opening balances, purchases, SIP instalments and redemptions.
-- Also: a nightly NAV job (job name 'mf-nav') and restore support for fund entries.

create type public.mf_plan as enum ('direct', 'regular');
create type public.mf_option as enum ('growth', 'idcw');
create type public.mf_transaction_type as enum ('opening_balance', 'purchase', 'sip', 'redemption');

-- Funds -------------------------------------------------------------------------

create table public.mf_schemes (
  amfi_code integer primary key,
  name text not null,
  amc text not null,
  category text,
  scheme_type text,
  plan public.mf_plan,
  option_type public.mf_option,
  option_label text,
  isin_growth text,
  isin_reinvest text,
  nav numeric(20, 8) check (nav > 0),
  nav_date date,
  previous_nav numeric(20, 8) check (previous_nav > 0),
  previous_nav_date date,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.mf_schemes.category is 'AMFI category, e.g. "Equity Scheme - Flexi Cap Fund".';
comment on column public.mf_schemes.plan is 'Direct or Regular; null when AMFI doesn''t say.';
comment on column public.mf_schemes.option_label is 'AMFI''s wording, e.g. "Monthly IDCW Payout".';
comment on column public.mf_schemes.previous_nav is 'NAV from the previous NAV date, for today''s change.';
comment on column public.mf_schemes.is_active is 'False once the fund disappears from AMFI''s file. Never deleted.';

create trigger mf_schemes_set_updated_at
  before update on public.mf_schemes
  for each row execute function public.set_updated_at();

-- Fund entries ---------------------------------------------------------------

create table public.mf_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  broker_account_id uuid not null,
  amfi_code integer not null references public.mf_schemes (amfi_code) on delete restrict,
  folio_number text check (char_length(folio_number) between 1 and 30),
  type public.mf_transaction_type not null,
  units numeric(20, 4) not null check (units > 0),
  nav numeric(18, 4) not null check (nav > 0),
  charges numeric(14, 2) not null default 0 check (charges >= 0),
  trade_date date not null,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mf_transactions_broker_account_id_member_id_fkey
    foreign key (broker_account_id, member_id)
    references public.broker_accounts (id, member_id) on delete restrict
);

comment on column public.mf_transactions.nav is 'NAV the units were bought or redeemed at.';
comment on column public.mf_transactions.charges is 'Stamp duty and any other charges for the whole entry.';

create index mf_transactions_member_id_trade_date_idx on public.mf_transactions (member_id, trade_date);
create index mf_transactions_position_idx on public.mf_transactions (broker_account_id, amfi_code);
create index mf_transactions_amfi_code_idx on public.mf_transactions (amfi_code);

create trigger mf_transactions_set_updated_at
  before update on public.mf_transactions
  for each row execute function public.set_updated_at();

-- Access ------------------------------------------------------------------------

alter table public.mf_schemes enable row level security;
alter table public.mf_transactions enable row level security;

revoke all on public.mf_schemes, public.mf_transactions from anon, authenticated;
grant select, insert, update on public.mf_schemes to authenticated;
grant select, insert, update, delete on public.mf_transactions to authenticated;

create policy "Owner can read funds"
  on public.mf_schemes for select
  to authenticated
  using ((select public.is_owner()));

create policy "Owner can add funds"
  on public.mf_schemes for insert
  to authenticated
  with check ((select public.is_owner()));

create policy "Owner can update funds"
  on public.mf_schemes for update
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.mf_transactions for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- Scheduled jobs and the GitHub backup use the secret key (service_role).
grant select, insert, update on public.mf_schemes to service_role;
grant select on public.mf_transactions to service_role;

-- The nightly NAV update is a new job name.
alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check check (job in ('daily-snapshot', 'stock-list', 'mf-nav'));

-- Restore: backup version 2 adds fund entries; version 1 files still restore. ------

create or replace function public.restore_family_data(backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing_stocks integer;
  missing_funds integer;
begin
  if not public.is_owner() then
    raise exception 'Only the app owner can restore data.' using errcode = '42501';
  end if;

  if backup ->> 'app' is distinct from 'family-portfolio'
     or coalesce(backup ->> 'version', '') not in ('1', '2') then
    raise exception 'This isn''t a Family Portfolio backup, or it''s from an unsupported version.';
  end if;

  select count(*) into missing_stocks
  from (
    select item ->> 'exchange' as exchange, item ->> 'token' as token
    from jsonb_array_elements(coalesce(backup -> 'transactions', '[]'::jsonb)) as item
    union
    select item ->> 'exchange', item ->> 'token'
    from jsonb_array_elements(coalesce(backup -> 'instrumentPrices', '[]'::jsonb)) as item
    union
    select item ->> 'exchange', item ->> 'token'
    from jsonb_array_elements(coalesce(backup -> 'eodPrices', '[]'::jsonb)) as item
  ) as refs
  where not exists (
    select 1 from public.instruments as i
    where i.exchange::text = refs.exchange and i.token = refs.token
  );

  if missing_stocks > 0 then
    raise exception '% stocks in the backup aren''t in the stock list. Update the stock list, then try again.', missing_stocks;
  end if;

  select count(*) into missing_funds
  from (
    select distinct (item ->> 'amfi_code')::integer as amfi_code
    from jsonb_array_elements(coalesce(backup -> 'mfTransactions', '[]'::jsonb)) as item
  ) as refs
  where not exists (
    select 1 from public.mf_schemes as s where s.amfi_code = refs.amfi_code
  );

  if missing_funds > 0 then
    raise exception '% funds in the backup aren''t in the fund list. Update the fund list, then try again.', missing_funds;
  end if;

  -- Replace everything, children first. "where true" keeps Supabase's safe-delete guard happy.
  delete from public.mf_transactions where true;
  delete from public.transactions where true;
  delete from public.portfolio_snapshots where true;
  delete from public.eod_prices where true;
  delete from public.instrument_prices where true;
  delete from public.broker_accounts where true;
  delete from public.members where true;
  delete from public.market_holidays where true;

  insert into public.members (id, name, relation, color, pan_last4, notes, archived_at, created_at, updated_at)
  select id, name, relation, color, pan_last4, notes, archived_at, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'members', '[]'::jsonb)) as m (
    id uuid, name text, relation public.member_relation, color text, pan_last4 text,
    notes text, archived_at timestamptz, created_at timestamptz, updated_at timestamptz
  );

  insert into public.broker_accounts (id, member_id, broker, label, client_id_last4, notes, created_at, updated_at)
  select id, member_id, broker, label, client_id_last4, notes, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'brokerAccounts', '[]'::jsonb)) as a (
    id uuid, member_id uuid, broker public.broker, label text, client_id_last4 text,
    notes text, created_at timestamptz, updated_at timestamptz
  );

  insert into public.transactions (
    id, member_id, broker_account_id, instrument_id, type, quantity, price, charges,
    trade_date, notes, created_at, updated_at
  )
  select t.id, t.member_id, t.broker_account_id, i.id, t.type, t.quantity, t.price, t.charges,
         t.trade_date, t.notes, t.created_at, t.updated_at
  from jsonb_to_recordset(coalesce(backup -> 'transactions', '[]'::jsonb)) as t (
    id uuid, member_id uuid, broker_account_id uuid, exchange text, token text,
    type public.transaction_type, quantity numeric, price numeric, charges numeric,
    trade_date date, notes text, created_at timestamptz, updated_at timestamptz
  )
  join public.instruments as i on i.exchange::text = t.exchange and i.token = t.token;

  insert into public.mf_transactions (
    id, member_id, broker_account_id, amfi_code, folio_number, type, units, nav, charges,
    trade_date, notes, created_at, updated_at
  )
  select id, member_id, broker_account_id, amfi_code, folio_number, type, units, nav, charges,
         trade_date, notes, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'mfTransactions', '[]'::jsonb)) as f (
    id uuid, member_id uuid, broker_account_id uuid, amfi_code integer, folio_number text,
    type public.mf_transaction_type, units numeric, nav numeric, charges numeric,
    trade_date date, notes text, created_at timestamptz, updated_at timestamptz
  );

  insert into public.instrument_prices (instrument_id, last_price, previous_close, source, priced_at, updated_at)
  select i.id, p.last_price, p.previous_close, p.source, p.priced_at, p.updated_at
  from jsonb_to_recordset(coalesce(backup -> 'instrumentPrices', '[]'::jsonb)) as p (
    exchange text, token text, last_price numeric, previous_close numeric,
    source public.price_source, priced_at timestamptz, updated_at timestamptz
  )
  join public.instruments as i on i.exchange::text = p.exchange and i.token = p.token;

  insert into public.eod_prices (instrument_id, price_date, close_price, created_at)
  select i.id, e.price_date, e.close_price, e.created_at
  from jsonb_to_recordset(coalesce(backup -> 'eodPrices', '[]'::jsonb)) as e (
    exchange text, token text, price_date date, close_price numeric, created_at timestamptz
  )
  join public.instruments as i on i.exchange::text = e.exchange and i.token = e.token;

  insert into public.portfolio_snapshots (
    member_id, snapshot_date, holding_count, priced_count, invested, current_value,
    unrealized_pnl, realized_pnl, created_at
  )
  select member_id, snapshot_date, holding_count, priced_count, invested, current_value,
         unrealized_pnl, realized_pnl, created_at
  from jsonb_to_recordset(coalesce(backup -> 'portfolioSnapshots', '[]'::jsonb)) as s (
    member_id uuid, snapshot_date date, holding_count integer, priced_count integer,
    invested numeric, current_value numeric, unrealized_pnl numeric, realized_pnl numeric,
    created_at timestamptz
  );

  insert into public.market_holidays (holiday_date, description, created_at)
  select holiday_date, description, created_at
  from jsonb_to_recordset(coalesce(backup -> 'marketHolidays', '[]'::jsonb)) as h (
    holiday_date date, description text, created_at timestamptz
  );

  return jsonb_build_object(
    'members', (select count(*) from public.members),
    'transactions', (select count(*) from public.transactions),
    'mfTransactions', (select count(*) from public.mf_transactions)
  );
end;
$$;

revoke execute on function public.restore_family_data(jsonb) from public, anon;
grant execute on function public.restore_family_data(jsonb) to authenticated;
