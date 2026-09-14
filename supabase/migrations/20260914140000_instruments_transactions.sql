-- Stages 3 & 4: Stock list, transactions and holdings
-- instruments:  NSE/BSE shares, SME shares, Sovereign Gold Bonds and indices from
--               Angel One's public instrument file (Settings → Update stock list).
-- transactions: opening balances, buys and sells per member, broker account and stock.
--               Holdings are calculated in the app (lib/portfolio) from these rows.

create type public.exchange as enum ('NSE', 'BSE');
create type public.instrument_kind as enum ('equity', 'sgb', 'index');
create type public.transaction_type as enum ('opening_balance', 'buy', 'sell');

-- Instruments ------------------------------------------------------------------

create table public.instruments (
  id bigint generated always as identity primary key,
  exchange public.exchange not null,
  token text not null,
  trading_symbol text not null,
  symbol text not null,
  name text not null,
  series text,
  kind public.instrument_kind not null,
  tick_size numeric(10, 4) not null default 0.01 check (tick_size >= 0),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exchange, token)
);

comment on column public.instruments.token is 'Angel One symbol token, used later to fetch prices.';
comment on column public.instruments.trading_symbol is 'Symbol as listed in the instrument file, e.g. RELIANCE-EQ.';
comment on column public.instruments.symbol is 'Symbol without the NSE series suffix, e.g. RELIANCE.';
comment on column public.instruments.series is 'NSE series such as EQ, BE, SM or GB. Null on BSE and for indices.';
comment on column public.instruments.last_seen_at is 'When the latest stock list update last included this entry.';
comment on column public.instruments.is_active is 'False once the entry disappears from the instrument file. Never deleted, so old transactions keep working.';

create index instruments_symbol_search_idx
  on public.instruments (lower(symbol) text_pattern_ops);

create trigger instruments_set_updated_at
  before update on public.instruments
  for each row execute function public.set_updated_at();

-- Transactions ---------------------------------------------------------------------

-- Lets transactions require that their broker account belongs to the same member.
alter table public.broker_accounts
  add constraint broker_accounts_id_member_id_key unique (id, member_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  broker_account_id uuid not null,
  instrument_id bigint not null references public.instruments (id) on delete restrict,
  type public.transaction_type not null,
  quantity numeric(20, 8) not null check (quantity > 0),
  price numeric(18, 4) not null check (price > 0),
  charges numeric(14, 2) not null default 0 check (charges >= 0),
  trade_date date not null,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_broker_account_id_member_id_fkey
    foreign key (broker_account_id, member_id)
    references public.broker_accounts (id, member_id) on delete restrict
);

comment on column public.transactions.price is 'Per share. For an opening balance, the average buy price from the broker app.';
comment on column public.transactions.charges is 'Brokerage, STT and other charges for the whole trade.';

create index transactions_member_id_trade_date_idx on public.transactions (member_id, trade_date);
create index transactions_position_idx on public.transactions (broker_account_id, instrument_id);
create index transactions_instrument_id_idx on public.transactions (instrument_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- Access: owner only -----------------------------------------------------------

alter table public.instruments enable row level security;
alter table public.transactions enable row level security;

revoke all on public.instruments, public.transactions from anon, authenticated;
grant select, insert, update on public.instruments to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

create policy "Owner can read instruments"
  on public.instruments for select
  to authenticated
  using ((select public.is_owner()));

create policy "Owner can add instruments"
  on public.instruments for insert
  to authenticated
  with check ((select public.is_owner()));

create policy "Owner can update instruments"
  on public.instruments for update
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.transactions for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
