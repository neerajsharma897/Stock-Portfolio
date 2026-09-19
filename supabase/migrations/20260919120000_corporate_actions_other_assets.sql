-- Stage 12a: Splits, bonuses and other assets
-- corporate_actions:  stock splits and bonus issues, applied to holdings on the ex-date.
-- fixed_deposits:     bank FDs, valued with compound interest to today.
-- other_assets:       gold, PPF, EPF, NPS, bonds, property and anything else valued by hand.
-- ipo_applications:   IPO bids and whether shares were allotted (not counted in totals).
-- Also: backup version 5 in restore.

-- Splits and bonuses -------------------------------------------------------------

create type public.corporate_action_kind as enum ('split', 'bonus');

create table public.corporate_actions (
  id uuid primary key default gen_random_uuid(),
  instrument_id bigint not null references public.instruments (id) on delete restrict,
  kind public.corporate_action_kind not null,
  ex_date date not null,
  ratio_from integer not null check (ratio_from between 1 and 1000),
  ratio_to integer not null check (ratio_to between 1 and 1000),
  notes text check (char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instrument_id, kind, ex_date),
  check (kind = 'bonus' or ratio_from <> ratio_to)
);

comment on column public.corporate_actions.ratio_from is
  'Split: old shares that become ratio_to new shares. Bonus: shares held for every ratio_to bonus shares.';
comment on column public.corporate_actions.ex_date is
  'Holdings are adjusted at the start of this day; trades on or after it are at the new price.';

create index corporate_actions_instrument_id_idx on public.corporate_actions (instrument_id);

create trigger corporate_actions_set_updated_at
  before update on public.corporate_actions
  for each row execute function public.set_updated_at();

-- Fixed deposits ---------------------------------------------------------------------

create type public.fd_interest as enum ('quarterly', 'monthly', 'half_yearly', 'yearly', 'payout');

create table public.fixed_deposits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  bank text not null check (char_length(bank) between 1 and 60),
  principal numeric(14, 2) not null check (principal > 0),
  rate_pct numeric(6, 3) not null check (rate_pct > 0 and rate_pct < 50),
  interest public.fd_interest not null default 'quarterly',
  start_date date not null,
  maturity_date date not null,
  closed_on date,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (maturity_date > start_date),
  check (closed_on is null or closed_on >= start_date)
);

comment on column public.fixed_deposits.interest is
  'How interest is compounded; payout FDs pay interest out, so their value stays the principal.';
comment on column public.fixed_deposits.closed_on is
  'Set once the FD is paid out; closed FDs leave the totals.';

create index fixed_deposits_member_id_idx on public.fixed_deposits (member_id);

create trigger fixed_deposits_set_updated_at
  before update on public.fixed_deposits
  for each row execute function public.set_updated_at();

-- Other assets ------------------------------------------------------------------------

create type public.other_asset_kind as enum (
  'gold', 'silver', 'ppf', 'epf', 'nps', 'bond', 'real_estate', 'other'
);

create table public.other_assets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  kind public.other_asset_kind not null,
  name text not null check (char_length(name) between 1 and 80),
  invested numeric(14, 2) not null check (invested >= 0),
  current_value numeric(14, 2) not null check (current_value >= 0),
  value_as_of date not null,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index other_assets_member_id_idx on public.other_assets (member_id);

create trigger other_assets_set_updated_at
  before update on public.other_assets
  for each row execute function public.set_updated_at();

-- IPO applications ---------------------------------------------------------------------

create type public.ipo_status as enum ('applied', 'allotted', 'not_allotted', 'withdrawn');

create table public.ipo_applications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  company text not null check (char_length(company) between 1 and 80),
  applied_on date not null,
  shares_applied integer not null check (shares_applied > 0),
  price numeric(12, 2) not null check (price > 0),
  status public.ipo_status not null default 'applied',
  shares_allotted integer check (shares_allotted >= 0),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'allotted' or shares_allotted > 0)
);

comment on column public.ipo_applications.price is 'Price per share bid, usually the top of the price band.';

create index ipo_applications_member_id_idx on public.ipo_applications (member_id);

create trigger ipo_applications_set_updated_at
  before update on public.ipo_applications
  for each row execute function public.set_updated_at();

-- Access ------------------------------------------------------------------------

alter table public.corporate_actions enable row level security;
alter table public.fixed_deposits enable row level security;
alter table public.other_assets enable row level security;
alter table public.ipo_applications enable row level security;

revoke all on
  public.corporate_actions, public.fixed_deposits, public.other_assets, public.ipo_applications
from anon, authenticated;
grant select, insert, update, delete on
  public.corporate_actions, public.fixed_deposits, public.other_assets, public.ipo_applications
to authenticated;

create policy "Owner has full access"
  on public.corporate_actions for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.fixed_deposits for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.other_assets for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.ipo_applications for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- Scheduled jobs (daily snapshot, news) and the GitHub backup read with the secret key.
grant select on
  public.corporate_actions, public.fixed_deposits, public.other_assets, public.ipo_applications
to service_role;

-- Restore: backup version 5 adds splits and bonuses, fixed deposits, other assets
-- and IPO applications. Older versions still restore. -----------------------------------

create or replace function public.restore_family_data(backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing_stocks integer;
  missing_funds integer;
  missing_coins integer;
  unlisted_watchlist uuid;
begin
  if not public.is_owner() then
    raise exception 'Only the app owner can restore data.' using errcode = '42501';
  end if;

  if backup ->> 'app' is distinct from 'family-portfolio'
     or coalesce(backup ->> 'version', '') not in ('1', '2', '3', '4', '5') then
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
    union
    select item ->> 'exchange', item ->> 'token'
    from jsonb_array_elements(coalesce(backup -> 'watchlist', '[]'::jsonb)) as item
    union
    select item ->> 'exchange', item ->> 'token'
    from jsonb_array_elements(coalesce(backup -> 'newsSearches', '[]'::jsonb)) as item
    union
    select item ->> 'exchange', item ->> 'token'
    from jsonb_array_elements(coalesce(backup -> 'corporateActions', '[]'::jsonb)) as item
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

  select count(*) into missing_coins
  from (
    select distinct item ->> 'market' as market
    from jsonb_array_elements(coalesce(backup -> 'cryptoTransactions', '[]'::jsonb)) as item
  ) as refs
  where not exists (
    select 1 from public.crypto_assets as c where c.market = refs.market
  );

  if missing_coins > 0 then
    raise exception '% coins in the backup aren''t in the coin list. Update the coin list, then try again.', missing_coins;
  end if;

  -- Replace everything, children first. "where true" keeps Supabase's safe-delete guard happy.
  delete from public.crypto_transactions where true;
  delete from public.mf_transactions where true;
  delete from public.transactions where true;
  delete from public.fixed_deposits where true;
  delete from public.other_assets where true;
  delete from public.ipo_applications where true;
  delete from public.corporate_actions where true;
  delete from public.portfolio_snapshots where true;
  delete from public.eod_prices where true;
  delete from public.instrument_prices where true;
  delete from public.watchlist_items where true;
  delete from public.watchlists where true;
  delete from public.news_feeds where true;
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

  insert into public.crypto_transactions (
    id, member_id, broker_account_id, market, type, quantity, price, charges,
    trade_date, notes, created_at, updated_at
  )
  select id, member_id, broker_account_id, market, type, quantity, price, charges,
         trade_date, notes, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'cryptoTransactions', '[]'::jsonb)) as c (
    id uuid, member_id uuid, broker_account_id uuid, market text,
    type public.transaction_type, quantity numeric, price numeric, charges numeric,
    trade_date date, notes text, created_at timestamptz, updated_at timestamptz
  );

  insert into public.fixed_deposits (
    id, member_id, bank, principal, rate_pct, interest, start_date, maturity_date,
    closed_on, notes, created_at, updated_at
  )
  select id, member_id, bank, principal, rate_pct, interest, start_date, maturity_date,
         closed_on, notes, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'fixedDeposits', '[]'::jsonb)) as d (
    id uuid, member_id uuid, bank text, principal numeric, rate_pct numeric,
    interest public.fd_interest, start_date date, maturity_date date, closed_on date,
    notes text, created_at timestamptz, updated_at timestamptz
  );

  insert into public.other_assets (
    id, member_id, kind, name, invested, current_value, value_as_of, notes, created_at, updated_at
  )
  select id, member_id, kind, name, invested, current_value, value_as_of, notes, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'otherAssets', '[]'::jsonb)) as o (
    id uuid, member_id uuid, kind public.other_asset_kind, name text, invested numeric,
    current_value numeric, value_as_of date, notes text, created_at timestamptz,
    updated_at timestamptz
  );

  insert into public.ipo_applications (
    id, member_id, company, applied_on, shares_applied, price, status, shares_allotted,
    notes, created_at, updated_at
  )
  select id, member_id, company, applied_on, shares_applied, price, status, shares_allotted,
         notes, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'ipoApplications', '[]'::jsonb)) as p (
    id uuid, member_id uuid, company text, applied_on date, shares_applied integer,
    price numeric, status public.ipo_status, shares_allotted integer, notes text,
    created_at timestamptz, updated_at timestamptz
  );

  insert into public.corporate_actions (
    id, instrument_id, kind, ex_date, ratio_from, ratio_to, notes, created_at, updated_at
  )
  select a.id, i.id, a.kind, a.ex_date, a.ratio_from, a.ratio_to, a.notes, a.created_at, a.updated_at
  from jsonb_to_recordset(coalesce(backup -> 'corporateActions', '[]'::jsonb)) as a (
    id uuid, exchange text, token text, kind public.corporate_action_kind, ex_date date,
    ratio_from integer, ratio_to integer, notes text, created_at timestamptz,
    updated_at timestamptz
  )
  join public.instruments as i on i.exchange::text = a.exchange and i.token = a.token;

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

  insert into public.watchlists (id, name, position, created_at, updated_at)
  select id, name, position, created_at, updated_at
  from jsonb_to_recordset(coalesce(backup -> 'watchlists', '[]'::jsonb)) as l (
    id uuid, name text, position integer, created_at timestamptz, updated_at timestamptz
  );

  -- Version 3 had one watchlist, so its stocks have no list id.
  if exists (
    select 1 from jsonb_array_elements(coalesce(backup -> 'watchlist', '[]'::jsonb)) as item
    where item ->> 'watchlist_id' is null
  ) then
    insert into public.watchlists (name, position)
    values ('Watchlist 1', 0)
    returning id into unlisted_watchlist;
  end if;

  insert into public.watchlist_items (watchlist_id, instrument_id, note, created_at, updated_at)
  select coalesce(w.watchlist_id, unlisted_watchlist), i.id, w.note, w.created_at, w.updated_at
  from jsonb_to_recordset(coalesce(backup -> 'watchlist', '[]'::jsonb)) as w (
    watchlist_id uuid, exchange text, token text, note text,
    created_at timestamptz, updated_at timestamptz
  )
  join public.instruments as i on i.exchange::text = w.exchange and i.token = w.token;

  insert into public.news_feeds (instrument_id, search_name)
  select i.id, n.search_name
  from jsonb_to_recordset(coalesce(backup -> 'newsSearches', '[]'::jsonb)) as n (
    exchange text, token text, search_name text
  )
  join public.instruments as i on i.exchange::text = n.exchange and i.token = n.token;

  return jsonb_build_object(
    'members', (select count(*) from public.members),
    'transactions', (select count(*) from public.transactions),
    'mfTransactions', (select count(*) from public.mf_transactions),
    'cryptoTransactions', (select count(*) from public.crypto_transactions),
    'fixedDeposits', (select count(*) from public.fixed_deposits),
    'otherAssets', (select count(*) from public.other_assets)
  );
end;
$$;

revoke execute on function public.restore_family_data(jsonb) from public, anon;
grant execute on function public.restore_family_data(jsonb) to authenticated;
