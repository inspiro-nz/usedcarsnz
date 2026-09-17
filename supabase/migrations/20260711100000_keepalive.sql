-- ============================================================================
-- UsedCarsNZ · Prompt 7 · demo keep-alive ping table
-- ----------------------------------------------------------------------------
-- The demo Supabase project is on the FREE tier, which pauses a project after
-- 7 days of no activity. A tiny standalone Cloudflare Worker (workers/keepalive)
-- inserts one row here on a daily Cron Trigger; any write resets the 7-day
-- inactivity timer so the demo is never paused mid-pitch.
--
-- This is deliberately trivial and additive: it is NEVER read by the app, and
-- carries no PII. Service-role-only (same posture as public.email_outbox /
-- public.messages) — the keep-alive Worker authenticates with the demo project's
-- secret key. In prod this table simply sits empty and unused.
-- ============================================================================

create table public.keepalive_ping (
  id         bigint generated always as identity primary key,
  pinged_at  timestamptz not null default now(),
  source     text
);
comment on table public.keepalive_ping is
  'Demo-only: one row per daily keep-alive Cron (workers/keepalive) so the free-tier project never pauses. Never read by the app; service-role writes only.';

alter table public.keepalive_ping enable row level security;

-- No client access — no policies means anon/authenticated see nothing; only the
-- service_role (which bypasses RLS) can insert. Belt-and-braces explicit grant.
grant all on public.keepalive_ping to service_role;
