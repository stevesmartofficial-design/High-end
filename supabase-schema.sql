-- Run this once in Supabase SQL Editor.
-- The Vercel backend function uses the service role key, so no public RLS policy is required.

create table if not exists public.pm_dashboard_state (
  id text primary key,
  records jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pm_dashboard_state enable row level security;

comment on table public.pm_dashboard_state is 'Single-row JSON store for the PM dashboard records.';