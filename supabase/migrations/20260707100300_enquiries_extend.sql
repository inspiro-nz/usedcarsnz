-- ============================================================================
-- UsedCarsNZ · WP-1.1 · Migration 12 · enquiries: source + dedupe + defaults
-- ----------------------------------------------------------------------------
-- Per docs/AUDIT-LEAD-ENGINE.md finding 4, enquiries already exists and is the
-- canonical lead table (buyer_name/buyer_email/buyer_phone/qualification are
-- already there from 20260621090400_leads.sql) — this migration only ADDS the
-- columns needed for email-sourced leads (§ dealer_aliases) that the original
-- form-only design didn't need: which channel the lead came in on, and a
-- dedupe key for inbound email so a re-delivered/forwarded message can't
-- create a second enquiry for the same lead.
-- ============================================================================

alter table public.enquiries
  add column source              public.enquiry_source not null default 'platform_form',
  add column external_message_id text;

comment on column public.enquiries.source is
  'Where the lead originated: the marketplace form, or an inbound email routed via a dealer_aliases entry.';
comment on column public.enquiries.external_message_id is
  'Message-Id (or platform equivalent) of the inbound email that created this enquiry, for dedupe. NULL for platform_form leads.';

-- Dedupe: the same inbound message must never create two enquiries. Partial
-- because platform_form leads have no external_message_id at all.
create unique index enquiries_external_message_id_key
  on public.enquiries (external_message_id)
  where external_message_id is not null;

-- qualification already exists (nullable, no default) from 20260621090400 —
-- new rows get an empty object instead of NULL so callers can merge into it
-- without a null-check; existing NULL rows are untouched (additive default).
alter table public.enquiries
  alter column qualification set default '{}'::jsonb;

create index enquiries_source_idx on public.enquiries (source);
