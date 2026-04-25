-- MarketMithra / MaddyFlow — Supabase schema.
-- Run in the Supabase SQL editor after creating a new project.
--
-- Design notes:
-- * `judgements` is append-only: we never mutate a user's vote, we insert a
--   new row. The latest row per (user, symbol, as_of) wins in the UI, but
--   the full history is the track-record moat.
-- * `anon_id` supports pre-auth votes from localStorage UUIDs. When a user
--   signs in, a background job can reconcile rows where `user_id IS NULL`
--   and `anon_id` matches their claimed device id.
-- * RLS is ON: anon votes are inserted via the anon key with a permissive
--   insert policy; reads of aggregates go through a SECURITY DEFINER view.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.judgements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anon_id text,
  symbol text not null,
  verdict text not null check (verdict in ('BUY','HOLD','SELL')),
  probability numeric(4,2) not null,
  vote text not null check (vote in ('agree','disagree')),
  as_of timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists judgements_symbol_idx on public.judgements (symbol, created_at desc);
create index if not exists judgements_user_idx on public.judgements (user_id, created_at desc);
create index if not exists judgements_anon_idx on public.judgements (anon_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.judgements enable row level security;

-- Profiles: users read/update their own row.
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles self upsert" on public.profiles;
create policy "profiles self upsert" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

-- Judgements: anyone may insert (we want anonymous votes), but a vote
-- either carries the caller's user_id or no user_id at all.
drop policy if exists "judgements public insert" on public.judgements;
create policy "judgements public insert" on public.judgements
  for insert with check (
    user_id is null or user_id = auth.uid()
  );

-- Judgements: users see their own votes; aggregate reads go via the view.
drop policy if exists "judgements self select" on public.judgements;
create policy "judgements self select" on public.judgements
  for select using (
    auth.uid() is not null and user_id = auth.uid()
  );

-- Public aggregate view — safe to expose; no PII.
create or replace view public.judgement_tally as
select
  symbol,
  verdict,
  count(*) filter (where vote = 'agree')    as agree_count,
  count(*) filter (where vote = 'disagree') as disagree_count,
  count(*)                                   as total
from public.judgements
group by symbol, verdict;

grant select on public.judgement_tally to anon, authenticated;

-- ── Waitlist ──────────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Anyone may join the waitlist; nobody may read others' emails.
drop policy if exists "waitlist public insert" on public.waitlist;
create policy "waitlist public insert" on public.waitlist
  for insert with check (true);

-- ── Pro subscribers ───────────────────────────────────────────────────────────
-- Populated by the Stripe webhook when checkout.session.completed fires.
create table if not exists public.pro_subscribers (
  id uuid primary key default gen_random_uuid(),
  anon_id text,                         -- browser anon id at time of purchase
  email text,                           -- from Stripe customer_details
  stripe_customer_id text unique,       -- for subscription management
  stripe_session_id text unique not null,
  activated_at timestamptz not null default now(),
  cancelled_at timestamptz             -- set by customer.subscription.deleted
);

create index if not exists pro_subscribers_email_idx  on public.pro_subscribers (email);
create index if not exists pro_subscribers_anon_idx   on public.pro_subscribers (anon_id);

alter table public.pro_subscribers enable row level security;

-- Webhook inserts via service_role key (bypasses RLS) — no policy needed.
-- Authenticated users may read their own Pro status row.
drop policy if exists "pro_subscribers self select" on public.pro_subscribers;
create policy "pro_subscribers self select" on public.pro_subscribers
  for select using (
    auth.jwt() ->> 'email' = email
    or auth.uid()::text = anon_id
  );
