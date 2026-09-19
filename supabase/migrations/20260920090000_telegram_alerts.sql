-- Stage 9: Telegram alerts (launch set)
-- telegram_settings: one row: the linked Telegram chat, quiet hours and which alerts are on.
-- alert_rules:       price alerts per stock: above or below a price, a big daily move,
--                    or a new 52-week high or low. Each fires at most once a day.
-- alert_events:      every alert sent (or held back), shown on the Alerts page; kept 90 days.
-- Also: 52-week high and low on instrument_prices, and the 'alerts' job name.

create table public.telegram_settings (
  singleton boolean primary key default true check (singleton),
  chat_id bigint,
  chat_name text,
  link_code text,
  link_code_expires_at timestamptz,
  daily_summary boolean not null default true,
  system_alerts boolean not null default true,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  summary_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.telegram_settings.link_code is
  'One-time code sent to the bot as "/start <code>" to link the chat; cleared once linked.';
comment on column public.telegram_settings.quiet_start is
  'No messages from this time (India) until quiet_end. Equal times mean no quiet hours.';

insert into public.telegram_settings (singleton) values (true);

create trigger telegram_settings_set_updated_at
  before update on public.telegram_settings
  for each row execute function public.set_updated_at();

create type public.alert_kind as enum ('price_above', 'price_below', 'day_move', 'high_52w', 'low_52w');

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  instrument_id bigint not null references public.instruments (id) on delete cascade,
  kind public.alert_kind not null,
  threshold numeric(18, 4) check (threshold > 0),
  note text check (char_length(note) <= 200),
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind in ('high_52w', 'low_52w') or threshold is not null)
);

comment on column public.alert_rules.threshold is
  'Price in rupees for price_above and price_below; percent for day_move.';

create index alert_rules_instrument_id_idx on public.alert_rules (instrument_id);

create trigger alert_rules_set_updated_at
  before update on public.alert_rules
  for each row execute function public.set_updated_at();

create table public.alert_events (
  id bigint generated always as identity primary key,
  rule_id uuid references public.alert_rules (id) on delete set null,
  kind text not null check (kind in ('price', 'summary', 'system', 'test')),
  message text not null,
  delivered boolean not null,
  error text,
  sent_at timestamptz not null default now()
);

create index alert_events_sent_at_idx on public.alert_events (sent_at desc);

alter table public.instrument_prices
  add column week52_high numeric(18, 4) check (week52_high > 0),
  add column week52_low numeric(18, 4) check (week52_low > 0);

-- Access ------------------------------------------------------------------------

alter table public.telegram_settings enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;

revoke all on public.telegram_settings, public.alert_rules, public.alert_events from anon, authenticated;
grant select, update on public.telegram_settings to authenticated;
grant select, insert, update, delete on public.alert_rules to authenticated;
grant select, insert on public.alert_events to authenticated;
grant usage, select on sequence public.alert_events_id_seq to authenticated;

create policy "Owner has full access"
  on public.telegram_settings for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.alert_rules for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.alert_events for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- The alerts job and the daily job use the secret key.
grant select, update on public.telegram_settings to service_role;
grant select, update on public.alert_rules to service_role;
grant select, insert, delete on public.alert_events to service_role;
grant usage, select on sequence public.alert_events_id_seq to service_role;
grant delete on public.job_runs to service_role;

alter table public.job_runs drop constraint job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check
  check (job in ('daily-snapshot', 'stock-list', 'mf-nav', 'news', 'coin-list', 'alerts'));
