-- Stage 2: Members & broker accounts
-- Family members whose investments are tracked, and the broker or exchange
-- accounts each one holds. Only the owner can read or change them.

create type public.member_relation as enum (
  'self', 'spouse', 'son', 'daughter', 'father', 'mother', 'brother', 'sister', 'other'
);

create type public.broker as enum (
  'angelone', 'zerodha', 'groww', 'upstox', 'fivepaisa', 'coindcx', 'other'
);

-- Members --------------------------------------------------------------------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  relation public.member_relation not null default 'other',
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  pan_last4 text check (pan_last4 ~ '^[0-9]{3}[A-Z]$'),
  notes text check (char_length(notes) <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.members.relation is 'Relation to the owner (Dad).';
comment on column public.members.pan_last4 is 'Last 4 characters of the PAN only, e.g. 234F. Never store the full PAN.';
comment on column public.members.archived_at is 'Set when archived. Archived members are hidden but keep their history.';

-- Active members can't share a name (ignoring case), and only one can be "self".
create unique index members_active_name_key
  on public.members (lower(name)) where archived_at is null;
create unique index members_one_self_key
  on public.members (relation) where relation = 'self' and archived_at is null;

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- Broker accounts ------------------------------------------------------------

create table public.broker_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  broker public.broker not null,
  label text check (char_length(label) between 1 and 40),
  client_id_last4 text check (client_id_last4 ~ '^[A-Z0-9]{1,4}$'),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.broker_accounts.label is 'Tells two accounts at the same broker apart, e.g. "Joint".';
comment on column public.broker_accounts.client_id_last4 is 'Last 4 characters of the client ID only.';

create index broker_accounts_member_id_idx on public.broker_accounts (member_id);

-- One account per broker per member, unless they have different labels.
create unique index broker_accounts_member_broker_label_key
  on public.broker_accounts (member_id, broker, coalesce(lower(label), ''));

create trigger broker_accounts_set_updated_at
  before update on public.broker_accounts
  for each row execute function public.set_updated_at();

-- Access: owner only -----------------------------------------------------------

alter table public.members enable row level security;
alter table public.broker_accounts enable row level security;

revoke all on public.members, public.broker_accounts from anon, authenticated;
grant select, insert, update, delete on public.members, public.broker_accounts to authenticated;

create policy "Owner has full access"
  on public.members for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "Owner has full access"
  on public.broker_accounts for all
  to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
