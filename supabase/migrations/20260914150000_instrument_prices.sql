-- Stage 5: Prices for valuing holdings
-- One latest price per stock. Entered by hand until Stage 6 fills it from
-- Angel One. Daily closing prices and portfolio history come with the
-- scheduled jobs in Stage 7.

create type public.price_source as enum ('manual', 'angelone');

create table public.instrument_prices (
  instrument_id bigint primary key references public.instruments (id) on delete cascade,
  last_price numeric(18, 4) not null check (last_price > 0),
  previous_close numeric(18, 4) check (previous_close > 0),
  source public.price_source not null default 'manual',
  priced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.instrument_prices.last_price is 'Latest traded price per share.';
comment on column public.instrument_prices.previous_close is 'Previous trading day''s close, used for today''s change. Null when unknown.';
comment on column public.instrument_prices.priced_at is 'When this price was entered or fetched.';

create trigger instrument_prices_set_updated_at
  before update on public.instrument_prices
  for each row execute function public.set_updated_at();

alter table public.instrument_prices enable row level security;

revoke all on public.instrument_prices from anon, authenticated;
grant select, insert, update, delete on public.instrument_prices to authenticated;

create policy "Owner has full access"
  on public.instrument_prices for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
