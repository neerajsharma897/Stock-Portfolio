-- Export & restore
-- 1. The GitHub backup workflow downloads an export through /api/backup, which reads
--    with the secret key (service_role), so it also needs broker accounts.
-- 2. restore_family_data replaces all family data with a backup in one transaction:
--    if anything fails, nothing is changed. Stocks are matched by exchange and
--    Angel One token, because instrument ids differ between databases.

grant select on public.broker_accounts to service_role;

create or replace function public.restore_family_data(backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing_stocks integer;
begin
  if not public.is_owner() then
    raise exception 'Only the app owner can restore data.' using errcode = '42501';
  end if;

  if backup ->> 'app' is distinct from 'family-portfolio'
     or backup ->> 'version' is distinct from '1' then
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

  -- Replace everything, children first. "where true" keeps Supabase's safe-delete guard happy.
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
    'transactions', (select count(*) from public.transactions)
  );
end;
$$;

revoke execute on function public.restore_family_data(jsonb) from public, anon;
grant execute on function public.restore_family_data(jsonb) to authenticated;
