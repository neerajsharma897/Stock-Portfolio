-- Stage 7: Scheduled jobs and history
-- job_runs:            one row per scheduled job run, shown in Settings.
-- eod_prices:          each trading day's closing price per stock (from Angel One).
-- portfolio_snapshots: each member's invested amount and value at the end of a trading day.
-- Jobs write with the server-only secret key, which bypasses row level security.
-- The owner can only read these tables.

create type public.job_status as enum ('running', 'success', 'skipped', 'failed');

create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null check (job in ('daily-snapshot', 'stock-list')),
  status public.job_status not null default 'running',
  summary text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index job_runs_job_started_at_idx on public.job_runs (job, started_at desc);

create table public.eod_prices (
  instrument_id bigint not null references public.instruments (id) on delete cascade,
  price_date date not null,
  close_price numeric(18, 4) not null check (close_price > 0),
  created_at timestamptz not null default now(),
  primary key (instrument_id, price_date)
);

create table public.portfolio_snapshots (
  member_id uuid not null references public.members (id) on delete cascade,
  snapshot_date date not null,
  holding_count integer not null check (holding_count >= 0),
  priced_count integer not null check (priced_count >= 0),
  invested numeric(18, 2) not null,
  current_value numeric(18, 2) not null,
  unrealized_pnl numeric(18, 2) not null,
  realized_pnl numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  primary key (member_id, snapshot_date)
);

comment on column public.portfolio_snapshots.current_value is
  'Value of the holdings that had a price that day (priced_count of holding_count).';

-- Access: owner can read; only scheduled jobs (secret key) write ------------------

alter table public.job_runs enable row level security;
alter table public.eod_prices enable row level security;
alter table public.portfolio_snapshots enable row level security;

revoke all on public.job_runs, public.eod_prices, public.portfolio_snapshots from anon, authenticated;
grant select on public.job_runs, public.eod_prices, public.portfolio_snapshots to authenticated;

create policy "Owner can read"
  on public.job_runs for select
  to authenticated
  using ((select public.is_owner()));

create policy "Owner can read"
  on public.eod_prices for select
  to authenticated
  using ((select public.is_owner()));

create policy "Owner can read"
  on public.portfolio_snapshots for select
  to authenticated
  using ((select public.is_owner()));
