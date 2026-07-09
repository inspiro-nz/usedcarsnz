-- ============================================================================
-- UsedCarsNZ · WP-1.2 · Migration 13 · email_outbox (ack-send safe path)
-- ----------------------------------------------------------------------------
-- POST /api/enquiries always returns success to the buyer once the enquiry row
-- exists — the sub-60s SLA is about the buyer being told "we've got this", not
-- about Resend's uptime. If the immediate send fails, the templated ack is
-- parked here instead of being dropped, and a Cron-Trigger-ready sweep
-- (lib/email/outbox.ts; wiring the actual cron trigger is a later session)
-- retries it. lead_events.ack_sent is only emitted once a row here actually
-- sends — see lib/email/outbox.ts and app/api/enquiries/route.ts.
-- ============================================================================

create table public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid references public.enquiries (id) on delete cascade,
  "to"        text not null,
  reply_to    text,
  subject     text not null,
  body_text   text not null,
  body_html   text,
  attempts    integer not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
comment on table public.email_outbox is
  'Resend-failure safe path for the templated enquiry ack (§ compliance envelope). A row with sent_at IS NULL is due for the sweep in lib/email/outbox.ts.';
comment on column public.email_outbox.enquiry_id is
  'The enquiry this ack belongs to, so the sweep can emit ack_sent with the right lead_id once it succeeds. Nullable so the table stays reusable for non-enquiry transactional email later.';

create index email_outbox_pending_idx on public.email_outbox (created_at) where sent_at is null;

alter table public.email_outbox enable row level security;

-- No client access at all — every row is written and swept by the
-- service_role backend only (same posture as public.messages).
grant all on public.email_outbox to service_role;
