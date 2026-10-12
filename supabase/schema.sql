-- Startup Funding Pulse — run once in Supabase SQL Editor (safe to re-run).

-- 1. Aarav's editable config: exactly one row (id = 1).
create table if not exists public.app_config (
  id              int primary key default 1 check (id = 1),
  target_sectors  text[] not null default '{}',
  target_stages   text[] not null default '{}',
  watchlist       text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

insert into public.app_config (id, target_sectors, target_stages, watchlist)
values (
  1,
  array['Fintech', 'Climate', 'SaaS', 'AI'],
  array['Seed', 'Series A'],
  array['Zepto', 'Ather Energy', 'Groww', 'Razorpay', 'Sarvam AI']
)
on conflict (id) do nothing;

-- 2. Cached weekly digests (latest row is served to the page).
create table if not exists public.digests (
  id            bigserial primary key,
  week_start    date not null,
  week_end      date not null,
  generated_at  timestamptz not null default now(),
  payload       jsonb not null
);

create index if not exists digests_generated_at_idx
  on public.digests (generated_at desc);

-- 3. Lock both tables down. The app only talks to them from the server
--    using the service-role key, so the public anon key gets no access.
alter table public.app_config enable row level security;
alter table public.digests    enable row level security;
