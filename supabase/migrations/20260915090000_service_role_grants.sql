-- Stage 7 fix: let scheduled jobs use the tables
-- Scheduled jobs connect with the Supabase secret key, which uses the service_role
-- role. It bypasses row level security but still needs table privileges, and this
-- project doesn't grant them to service_role automatically. Without these grants
-- every job fails with "permission denied for table ...".
-- Future migrations that add tables used by jobs must grant them here too.

grant usage on schema public to service_role;

-- Read by the jobs.
grant select on
  public.members,
  public.transactions,
  public.market_holidays
to service_role;

-- Read and written by the jobs (upserts need select, insert and update).
grant select, insert, update on
  public.instruments,
  public.instrument_prices,
  public.job_runs,
  public.eod_prices,
  public.portfolio_snapshots
to service_role;

-- Identity columns (instruments.id, job_runs.id).
grant usage, select on all sequences in schema public to service_role;
