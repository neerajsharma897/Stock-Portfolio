-- Stage 10b: Several watchlists
-- watchlists:      up to 10 named lists, e.g. "Banks" or "To buy".
-- watchlist_items: each stock now belongs to a list; the same stock can be on several.
-- Stocks already on the watchlist move into a first list named "Watchlist 1".
-- Charts need no tables: price history is fetched from Angel One when a chart opens.
-- Also: backup version 4 in restore.

create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.watchlists.position is 'Order of the lists on the Watchlist page, lowest first.';

create trigger watchlists_set_updated_at
  before update on public.watchlists
  for each row execute function public.set_updated_at();

-- At most 10 lists (the app says so before this is reached).
create function public.limit_watchlists()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.watchlists) >= 10 then
    raise exception 'You can have up to 10 watchlists.';
  end if;
  return new;
end;
$$;

create trigger watchlists_limit
  before insert on public.watchlists
  for each row execute function public.limit_watchlists();

-- Move existing watchlist stocks into a first list ---------------------------------

insert into public.watchlists (name, position)
select 'Watchlist 1', 0
where exists (select 1 from public.watchlist_items);

alter table public.watchlist_items
  add column watchlist_id uuid references public.watchlists (id) on delete cascade;

update public.watchlist_items
set watchlist_id = (select id from public.watchlists where name = 'Watchlist 1')
where true;

alter table public.watchlist_items alter column watchlist_id set not null;
alter table public.watchlist_items drop constraint watchlist_items_pkey;
alter table public.watchlist_items add primary key (watchlist_id, instrument_id);

create index watchlist_items_instrument_id_idx on public.watchlist_items (instrument_id);

-- Access ------------------------------------------------------------------------

alter table public.watchlists enable row level security;

revoke all on public.watchlists from anon, authenticated;
grant select, insert, update, delete on public.watchlists to authenticated;

create policy "Owner has full access"
  on public.watchlists for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- The GitHub backup reads with the secret key (service_role).
grant select on public.watchlists to service_role;

-- Restore: backup version 4 adds named watchlists. A version 3 backup's single
-- watchlist comes back as "Watchlist 1"; older versions still restore. ----------------

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
     or coalesce(backup ->> 'version', '') not in ('1', '2', '3', '4') then
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
    'watchlists', (select count(*) from public.watchlists)
  );
end;
$$;

revoke execute on function public.restore_family_data(jsonb) from public, anon;
grant execute on function public.restore_family_data(jsonb) to authenticated;
