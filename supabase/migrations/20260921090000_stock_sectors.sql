-- Stock sectors for the Stocks page's sector breakdown.
-- stock_sectors: one row per stock symbol (the same symbol on NSE and BSE), ~750 rows.
--   'nse' rows come from NSE's Nifty Total Market list (industry per stock) and are
--   refreshed weekly by the stock list job; 'manual' rows are set in the app for stocks
--   outside that list and are never overwritten.

create table public.stock_sectors (
  symbol text primary key check (char_length(symbol) between 1 and 40),
  sector text not null check (char_length(sector) between 1 and 60),
  source text not null default 'manual' check (source in ('nse', 'manual')),
  updated_at timestamptz not null default now()
);

create trigger stock_sectors_set_updated_at
  before update on public.stock_sectors
  for each row execute function public.set_updated_at();

alter table public.stock_sectors enable row level security;

revoke all on public.stock_sectors from anon, authenticated;
grant select, insert, update, delete on public.stock_sectors to authenticated;

create policy "Owner has full access"
  on public.stock_sectors for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- The weekly stock list job uses the secret key.
grant select, insert, update on public.stock_sectors to service_role;
