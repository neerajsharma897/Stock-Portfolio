-- Stage 10: Crypto, watchlist and news
-- crypto_assets:        coins traded against the rupee on CoinDCX (e.g. BTCINR), with the
--                       latest price from CoinDCX's public ticker.
-- crypto_transactions:  opening balances, buys and sells of coins per member and account.
-- watchlist_items:      stocks to follow without holding them.
-- news_feeds:           per stock, the name searched on Google News and when it was checked.
-- news_articles:        headlines from Google News, linked to stocks by news_article_stocks.
-- Also: scheduled jobs 'news' and 'coin-list', and backup version 3 in restore.

-- Coins -------------------------------------------------------------------------

create table public.crypto_assets (
  market text primary key check (char_length(market) between 4 and 30),
  symbol text not null,
  name text not null,
  last_price numeric(28, 10) check (last_price > 0),
  change_24h_pct numeric(14, 4),
  priced_at timestamptz,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.crypto_assets.market is 'CoinDCX market, e.g. BTCINR.';
comment on column public.crypto_assets.symbol is 'Coin symbol, e.g. BTC.';
comment on column public.crypto_assets.last_price is 'Latest price of one coin in rupees.';
comment on column public.crypto_assets.change_24h_pct is 'Price change over the last 24 hours, in percent.';
comment on column public.crypto_assets.priced_at is 'When CoinDCX reported the latest price.';
comment on column public.crypto_assets.is_active is 'False once CoinDCX stops listing the INR market. Never deleted.';

create index crypto_assets_symbol_search_idx
  on public.crypto_assets (lower(symbol) text_pattern_ops);

create trigger crypto_assets_set_updated_at
  before update on public.crypto_assets
  for each row execute function public.set_updated_at();

-- Coin entries ----------------------------------------------------------------------

create table public.crypto_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  broker_account_id uuid not null,
  market text not null references public.crypto_assets (market) on delete restrict,
  type public.transaction_type not null,
  quantity numeric(28, 8) not null check (quantity > 0),
  price numeric(28, 10) not null check (price > 0),
  charges numeric(14, 2) not null default 0 check (charges >= 0),
  trade_date date not null,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_transactions_broker_account_id_member_id_fkey
    foreign key (broker_account_id, member_id)
    references public.broker_accounts (id, member_id) on delete restrict
);

comment on column public.crypto_transactions.price is 'Rupees per coin. For an opening balance, the average buy price.';
comment on column public.crypto_transactions.charges is 'Exchange fees for the whole trade. TDS is tax, not a charge.';

create index crypto_transactions_member_id_trade_date_idx on public.crypto_transactions (member_id, trade_date);
create index crypto_transactions_position_idx on public.crypto_transactions (broker_account_id, market);
create index crypto_transactions_market_idx on public.crypto_transactions (market);

create trigger crypto_transactions_set_updated_at
  before update on public.crypto_transactions
  for each row execute function public.set_updated_at();

-- Watchlist -----------------------------------------------------------------------

create table public.watchlist_items (
  instrument_id bigint primary key references public.instruments (id) on delete cascade,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger watchlist_items_set_updated_at
  before update on public.watchlist_items
  for each row execute function public.set_updated_at();

-- News ------------------------------------------------------------------------------

create table public.news_feeds (
  instrument_id bigint primary key references public.instruments (id) on delete cascade,
  search_name text check (char_length(search_name) between 2 and 60),
  checked_at timestamptz,
  error text,
  updated_at timestamptz not null default now()
);

comment on column public.news_feeds.search_name is 'Name searched on Google News, e.g. "Reliance Industries". Null searches the symbol.';
comment on column public.news_feeds.checked_at is 'When Google News was last searched for this stock.';

create trigger news_feeds_set_updated_at
  before update on public.news_feeds
  for each row execute function public.set_updated_at();

create table public.news_articles (
  id bigint generated always as identity primary key,
  url text not null unique,
  title text not null,
  source text,
  published_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on column public.news_articles.url is 'Google News link, which opens the original article.';

create index news_articles_published_at_idx on public.news_articles (published_at desc);

create table public.news_article_stocks (
  article_id bigint not null references public.news_articles (id) on delete cascade,
  instrument_id bigint not null references public.instruments (id) on delete cascade,
  primary key (article_id, instrument_id)
);

create index news_article_stocks_instrument_id_idx on public.news_article_stocks (instrument_id);

-- Access ------------------------------------------------------------------------

alter table public.crypto_assets enable row level security;
alter table public.crypto_transactions enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.news_feeds enable row level security;
alter table public.news_articles enable row level security;
alter table public.news_article_stocks enable row level security;

revoke all on
  public.crypto_assets, public.crypto_transactions, public.watchlist_items,
  public.news_feeds, public.news_articles, public.news_article_stocks
from anon, authenticated;

grant select, insert, update on public.crypto_assets to authenticated;
grant select, insert, update, delete on
  public.crypto_transactions, public.watchlist_items,
  public.news_feeds, public.news_articles, public.news_article_stocks
to authenticated;
grant usage, select on sequence public.news_articles_id_seq to authenticated;

create policy "Owner can read coins"
  on public.crypto_assets for select
  to authenticated
  using ((select public.is_owner()));

create policy "Owner can add coins"
  on public.crypto_assets for insert
  to authenticated
  with check ((select public.is_owner()));

create policy "Owner can update coins"
  on public.crypto_assets for update
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.crypto_transactions for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.watchlist_items for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.news_feeds for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.news_articles for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.news_article_stocks for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- Scheduled jobs and the GitHub backup use the secret key (service_role).
grant select, insert, update on public.crypto_assets to service_role;
grant select on public.crypto_transactions, public.watchlist_items to service_role;
grant select, insert, update, delete on
  public.news_feeds, public.news_articles, public.news_article_stocks
to service_role;
grant usage, select on sequence public.news_articles_id_seq to service_role;

-- Two new job names: the morning news check and the weekly coin list update.
alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check
  check (job in ('daily-snapshot', 'stock-list', 'mf-nav', 'news', 'coin-list'));

-- Restore: backup version 3 adds crypto entries, the watchlist and news search names.
-- Versions 1 and 2 still restore. ----------------------------------------------------

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
begin
  if not public.is_owner() then
    raise exception 'Only the app owner can restore data.' using errcode = '42501';
  end if;

  if backup ->> 'app' is distinct from 'family-portfolio'
     or coalesce(backup ->> 'version', '') not in ('1', '2', '3') then
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

  insert into public.watchlist_items (instrument_id, note, created_at, updated_at)
  select i.id, w.note, w.created_at, w.updated_at
  from jsonb_to_recordset(coalesce(backup -> 'watchlist', '[]'::jsonb)) as w (
    exchange text, token text, note text, created_at timestamptz, updated_at timestamptz
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
    'cryptoTransactions', (select count(*) from public.crypto_transactions)
  );
end;
$$;

revoke execute on function public.restore_family_data(jsonb) from public, anon;
grant execute on function public.restore_family_data(jsonb) to authenticated;
