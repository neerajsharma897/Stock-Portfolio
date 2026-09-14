-- Stage 6: Market holidays
-- Days NSE and BSE are closed on a weekday. Live prices aren't fetched on these
-- days. Maintained by hand in Settings from the exchanges' yearly holiday list.

create table public.market_holidays (
  holiday_date date primary key,
  description text not null check (char_length(description) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.market_holidays enable row level security;

revoke all on public.market_holidays from anon, authenticated;
grant select, insert, update, delete on public.market_holidays to authenticated;

create policy "Owner has full access"
  on public.market_holidays for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
