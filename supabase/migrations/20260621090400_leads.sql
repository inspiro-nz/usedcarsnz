-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 05 · Lead engine
--   enquiries · ai_drafts · lead_events (the immutable source of truth)
-- ----------------------------------------------------------------------------
-- An enquiry IS a lead. lead_events is the APPEND-ONLY, IMMUTABLE source of truth
-- for every conversion metric (strategy §3, §9.2). Immutability is enforced at the
-- DB level in migration 06 (prevent_mutation): INSERT only; UPDATE / DELETE /
-- TRUNCATE are rejected for every role, with NO admin exception — corrections are
-- made by APPENDING a compensating event, never by mutating history.
--
-- dealer_id / listing_id are denormalised onto enquiries, ai_drafts and
-- lead_events (populated server-side from the parent, never trusted from the
-- client) so that RLS and per-dealer aggregation never depend on a join through a
-- mutable table, and the event log is self-describing.
-- ============================================================================

-- ---------- enquiries (the lead) ----------
create table public.enquiries (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings (id) on delete restrict,  -- preserve lead history (§9.5)
  dealer_id       uuid references public.dealers (id) on delete restrict,  -- denormalised from listing (NULL for private)
  seller_user_id  uuid references public.users (id),                       -- denormalised from listing (private seller)
  buyer_user_id   uuid references public.users (id) on delete set null,    -- NULL for anonymous enquiries (§8.3)

  buyer_name      text not null,
  buyer_email     text not null,
  buyer_phone     text,
  message         text,

  -- Latest qualification snapshot (budget, finance need, trade-in, timeline, ...).
  -- The IMMUTABLE record of when qualification happened lives in lead_events.
  qualification   jsonb,
  status          enquiry_status not null default 'new',

  created_at      timestamptz not null default now(),   -- = enquiry_received time
  updated_at      timestamptz not null default now()
);
comment on table public.enquiries is
  'A buyer enquiry = a lead (§9.5). Created by anyone (no account needed). dealer_id / seller_user_id are set server-side from the listing (set_enquiry_denorm), never trusted from the client.';
create index enquiries_dealer_idx  on public.enquiries (dealer_id);
create index enquiries_listing_idx on public.enquiries (listing_id);
create index enquiries_buyer_idx   on public.enquiries (buyer_user_id);
create index enquiries_status_idx  on public.enquiries (status);
create index enquiries_created_idx on public.enquiries (created_at);

-- ---------- ai_drafts (human-approval audit trail, §7) ----------
create table public.ai_drafts (
  id             uuid primary key default gen_random_uuid(),
  enquiry_id     uuid not null references public.enquiries (id) on delete restrict,
  dealer_id      uuid references public.dealers (id) on delete restrict,  -- denormalised from enquiry
  seller_user_id uuid references public.users (id),                       -- denormalised from enquiry
  draft_text     text not null,         -- the AI's proposed reply
  edited_text    text,                  -- the human's edits, if any
  status         ai_draft_status not null default 'pending',
  approved_by    uuid references public.users (id),
  approved_at    timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.ai_drafts is
  'Per §7: the AI DRAFTS a reply; a human approves/edits before sending. This is the working record + approval audit. The immutable history of what happened (draft_created / draft_approved / reply_sent) is in lead_events.';
create index ai_drafts_enquiry_idx on public.ai_drafts (enquiry_id);
create index ai_drafts_dealer_idx  on public.ai_drafts (dealer_id);
create index ai_drafts_status_idx  on public.ai_drafts (status);

-- ---------- lead_events (APPEND-ONLY, IMMUTABLE source of truth) ----------
create table public.lead_events (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.enquiries (id) on delete restrict,  -- the enquiry / lead
  dealer_id    uuid references public.dealers (id)  on delete restrict,            -- denormalised; NULL for private leads
  listing_id   uuid references public.listings (id) on delete restrict,            -- denormalised
  event_type   lead_event_type not null,
  actor        lead_actor      not null,
  occurred_at  timestamptz not null default now(),   -- WHEN the event happened (set honestly by the writer)
  recorded_at  timestamptz not null default now(),   -- WHEN it was written (audit: compare to occurred_at)
  payload      jsonb not null default '{}'::jsonb
);
comment on table public.lead_events is
  'APPEND-ONLY, IMMUTABLE event log — the single source of truth for every conversion metric (§3, §9.2). UPDATE / DELETE / TRUNCATE are rejected at the DB level (prevent_mutation, migration 06). No admin exception: corrections are appended as compensating events, never mutated.';
comment on column public.lead_events.lead_id is
  'FK to enquiries(id). A "lead" and an "enquiry" are the same entity in this model.';
comment on column public.lead_events.occurred_at is
  'Event time, set by the writer. Metric integrity depends on the backend setting this honestly; recorded_at is the tamper-evident write time.';

-- Indexes tuned for the §9.2 dashboard funnel queries.
create index lead_events_lead_idx             on public.lead_events (lead_id);
create index lead_events_dealer_type_time_idx on public.lead_events (dealer_id, event_type, occurred_at);
create index lead_events_type_time_idx        on public.lead_events (event_type, occurred_at);
create index lead_events_listing_idx          on public.lead_events (listing_id);
