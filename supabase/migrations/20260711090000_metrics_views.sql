-- ============================================================================
-- UsedCarsNZ · WP-6 · Migration 19 · Conversion-metrics read layer (views)
-- ----------------------------------------------------------------------------
-- The published metric IS the product (Strategy v5.3 §3, §9.2). EVERY number on
-- the dashboard and the public page is derived here, EXCLUSIVELY from the
-- immutable lead_events log. If a number cannot be derived from lead_events it
-- does not exist. listings / enquiries are joined ONLY as dimensions (a market-
-- entry timestamp, a listing count) — never as a source of a conversion fact.
--
-- ADDITIVE ONLY. Creates views + grants; touches no prior migration, no table.
--
-- EVENT VOCABULARY (confirmed against the shipped code, not assumed):
--   enquiry_received  — funnel entry, auto-logged by enquiry_log_received() (system)
--   ack_sent          — the synchronous templated first-touch (lib/enquiries/
--                       first-touch.ts, lib/email/outbox.ts). THIS is the sub-60s
--                       first response the product claims — NOT ai_first_response_sent
--                       (a later AI-chat event). §9.2 first-response = enquiry_received
--                       -> first ack_sent.
--   viewing_booked    — the appointment (lib/leads.ts bookViewing). The enum also
--                       carries 'appointment_booked' (a never-emitted successor
--                       name); both are unioned below so the view is correct
--                       whichever is written, but live data is 'viewing_booked'.
--   marked_sold       — the conversion (lib/leads.ts markSold). Also sets
--                       listings.sold_at, but the LOG is the source of truth for
--                       WHEN the sale happened; listings.created_at is the only
--                       dimension we borrow (market entry).
--
-- NULL listing_id: inbound-email-lane leads (§5.3) have listing_id = NULL on both
-- enquiries and lead_events (their vehicle lives off-platform, e.g. Trade Me).
-- They ARE real leads for their dealer, so they COUNT in first-response and
-- funnel metrics, but they have no listing, so they are EXCLUDED from every
-- per-listing / time-on-market denominator (never counted as "listing NULL").
--
-- RLS MODEL:
--   * Dealer-scoped views are security_invoker = on: they execute with the
--     querying role's privileges, so lead_events' RLS (is_dealer_member OR
--     is_admin) scopes each dealer to their OWN events and lets an admin read
--     all. No dealer_id predicate is needed for isolation — RLS is the gate.
--   * The public view is security_invoker = off (runs as the owner, reads across
--     all dealers) and returns ONLY aggregates — never a lead_id or dealer_id —
--     so anon can read the platform metric without any raw-row exposure.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- metrics_lead_facts — one row per lead, the atomic unit every dealer metric
-- rolls up from. Pure lead_events (dealer_id/listing_id are the denormalised
-- copies the log already carries). security_invoker = on so RLS scopes it.
-- ---------------------------------------------------------------------------
create view public.metrics_lead_facts
with (security_invoker = on) as
select
  le.lead_id,
  -- dealer_id / listing_id are constant per lead (denormalised onto every event);
  -- array_agg(...)[1] pulls that single value (there is no max(uuid)). NULL when
  -- the lead has none (private-seller lead has no dealer; email lead has no listing).
  (array_agg(le.dealer_id)  filter (where le.dealer_id  is not null))[1] as dealer_id,
  (array_agg(le.listing_id) filter (where le.listing_id is not null))[1] as listing_id,
  min(le.occurred_at) filter (where le.event_type = 'enquiry_received')                       as enquiry_at,
  min(le.occurred_at) filter (where le.event_type = 'ack_sent')                               as first_ack_at,
  min(le.occurred_at) filter (where le.event_type in ('viewing_booked','appointment_booked')) as appointment_at,
  min(le.occurred_at) filter (where le.event_type = 'marked_sold')                            as sold_at,
  case
    when min(le.occurred_at) filter (where le.event_type = 'enquiry_received') is not null
     and min(le.occurred_at) filter (where le.event_type = 'ack_sent') is not null
     and min(le.occurred_at) filter (where le.event_type = 'ack_sent')
       >= min(le.occurred_at) filter (where le.event_type = 'enquiry_received')
    then extract(epoch from (
      min(le.occurred_at) filter (where le.event_type = 'ack_sent')
      - min(le.occurred_at) filter (where le.event_type = 'enquiry_received')
    ))
  end as first_response_seconds
from public.lead_events le
group by le.lead_id;

comment on view public.metrics_lead_facts is
  '§9.2 per-lead fact row derived ONLY from lead_events. first_response_seconds = enquiry_received -> first ack_sent. security_invoker=on: RLS scopes rows to the dealer (or all, for admin).';


-- ---------------------------------------------------------------------------
-- metrics_dealer — the per-dealer headline instrument (the four §9.2 cards).
--   median / p90 first-response : median & 90th-percentile of enquiry_received
--                                 -> first ack_sent, in seconds.
--   enquiry -> appointment rate : leads with a viewing_booked / total leads.
--   appointment -> sold rate    : leads with marked_sold / leads with an
--                                 appointment (given an appointment).
-- security_invoker = on: a dealer sees their own row; an admin sees every row
-- (the API's admin aggregate is just `select * from metrics_dealer`).
-- ---------------------------------------------------------------------------
create view public.metrics_dealer
with (security_invoker = on) as
select
  dealer_id,
  count(*) filter (where enquiry_at   is not null)                          as enquiries,
  count(*) filter (where first_ack_at is not null)                          as first_responses,
  percentile_cont(0.5) within group (order by first_response_seconds)       as median_first_response_seconds,
  percentile_cont(0.9) within group (order by first_response_seconds)       as p90_first_response_seconds,
  count(*) filter (where appointment_at is not null)                        as appointments,
  count(*) filter (where sold_at        is not null)                        as sold,
  round(
    count(*) filter (where appointment_at is not null)::numeric
    / nullif(count(*) filter (where enquiry_at is not null), 0), 4)         as enquiry_to_appointment_rate,
  round(
    count(*) filter (where sold_at is not null)::numeric
    / nullif(count(*) filter (where appointment_at is not null), 0), 4)     as appointment_to_sold_rate
from public.metrics_lead_facts
where dealer_id is not null
group by dealer_id;

comment on view public.metrics_dealer is
  '§9.2 per-dealer headline: median/p90 first-response (enquiry_received->ack_sent), enquiry->appointment rate, appointment->sold rate. Derived only from lead_events; RLS-scoped per dealer.';


-- ---------------------------------------------------------------------------
-- metrics_first_response_30d_dealer — the 30-day first-response distribution
-- strip. Six buckets over the last 30 days of first responses, by ack time:
--   b0 <60s · b1 1–5m · b2 5–30m · b3 30–60m · b4 1–4h · b5 >4h
-- One row per dealer (RLS-scoped), so the dashboard renders the strip without a
-- second data source.
-- ---------------------------------------------------------------------------
create view public.metrics_first_response_30d_dealer
with (security_invoker = on) as
select
  dealer_id,
  count(*) filter (where first_response_seconds <  60)                                    as b0_under_1m,
  count(*) filter (where first_response_seconds >=   60 and first_response_seconds <  300) as b1_1_5m,
  count(*) filter (where first_response_seconds >=  300 and first_response_seconds < 1800) as b2_5_30m,
  count(*) filter (where first_response_seconds >= 1800 and first_response_seconds < 3600) as b3_30_60m,
  count(*) filter (where first_response_seconds >= 3600 and first_response_seconds < 14400) as b4_1_4h,
  count(*) filter (where first_response_seconds >= 14400)                                  as b5_over_4h,
  count(*) filter (where first_response_seconds is not null)                              as total
from public.metrics_lead_facts
where dealer_id is not null
  and first_ack_at >= now() - interval '30 days'
group by dealer_id;

comment on view public.metrics_first_response_30d_dealer is
  '§9.2 first-response distribution over the trailing 30 days, six latency buckets. One row per dealer; drives the dashboard strip.';


-- ---------------------------------------------------------------------------
-- metrics_time_on_market_dealer — median time-on-market for SOLD listings.
-- Listing-scoped: market entry = listings.created_at (dimension), sale moment =
-- first marked_sold event for that listing (log = source of truth). Email-lane
-- leads have listing_id = NULL and cannot join a listing, so they are EXCLUDED
-- from this denominator — proven, not assumed (the WHERE + JOIN both drop them).
-- ---------------------------------------------------------------------------
create view public.metrics_time_on_market_dealer
with (security_invoker = on) as
select
  l.dealer_id,
  count(*)                                                                     as sold_listings,
  percentile_cont(0.5) within group (
    order by extract(epoch from (s.sold_at - l.created_at)) / 86400.0)         as median_days_on_market
from public.listings l
join (
  select listing_id, min(occurred_at) as sold_at
  from public.lead_events
  where event_type = 'marked_sold' and listing_id is not null   -- exclude email-lane (null-listing) leads
  group by listing_id
) s on s.listing_id = l.id
where l.dealer_id is not null
group by l.dealer_id;

comment on view public.metrics_time_on_market_dealer is
  '§9.2 median days-on-market for sold listings: listings.created_at -> first marked_sold event. Listing-scoped; null-listing email leads are excluded from the denominator.';


-- ---------------------------------------------------------------------------
-- metrics_enquiries_per_listing_dealer — the v5.1 §12.2 audience kill-criterion
-- number, surfaced from day one. Per dealer per month: enquiries on the dealer's
-- listings / the dealer's listing count. Numerator EXCLUDES email-lane (null-
-- listing) leads so the "per listing" ratio stays honest; denominator is the
-- dealer's own listings.
-- ---------------------------------------------------------------------------
create view public.metrics_enquiries_per_listing_dealer
with (security_invoker = on) as
select
  ev.dealer_id,
  ev.month,
  ev.enquiries,
  ld.listings,
  round(ev.enquiries::numeric / nullif(ld.listings, 0), 3) as enquiries_per_listing
from (
  select dealer_id, date_trunc('month', occurred_at)::date as month, count(*) as enquiries
  from public.lead_events
  where event_type = 'enquiry_received'
    and listing_id is not null          -- exclude email-lane leads from the per-listing numerator
    and dealer_id is not null
  group by dealer_id, date_trunc('month', occurred_at)
) ev
join (
  select dealer_id, count(*) as listings
  from public.listings
  where dealer_id is not null
  group by dealer_id
) ld on ld.dealer_id = ev.dealer_id;

comment on view public.metrics_enquiries_per_listing_dealer is
  'v5.1 §12.2 kill-criterion: enquiries per listing per month, per dealer. Numerator excludes null-listing email leads; denominator is the dealer''s listings.';


-- ---------------------------------------------------------------------------
-- metrics_platform — the PUBLIC, aggregate-only platform metric (§9.2, §3).
-- security_invoker = off: runs as the view owner, so it reads across all
-- dealers' lead_events regardless of RLS, but exposes ONLY aggregates (no
-- lead_id, no dealer_id) — anon can read the published number with zero raw-row
-- exposure. The minimum-N discipline (publish no claim the log can't
-- substantiate) is applied by the read layer using first_responses; the counts
-- are exposed here so that decision is made honestly and in one place.
-- ---------------------------------------------------------------------------
create view public.metrics_platform
with (security_invoker = off) as
with facts as (
  select
    le.lead_id,
    (array_agg(le.listing_id) filter (where le.listing_id is not null))[1] as listing_id,
    min(le.occurred_at) filter (where le.event_type = 'enquiry_received')                       as enquiry_at,
    min(le.occurred_at) filter (where le.event_type = 'ack_sent')                               as first_ack_at,
    min(le.occurred_at) filter (where le.event_type in ('viewing_booked','appointment_booked')) as appointment_at,
    min(le.occurred_at) filter (where le.event_type = 'marked_sold')                            as sold_at,
    case
      when min(le.occurred_at) filter (where le.event_type = 'enquiry_received') is not null
       and min(le.occurred_at) filter (where le.event_type = 'ack_sent') is not null
       and min(le.occurred_at) filter (where le.event_type = 'ack_sent')
         >= min(le.occurred_at) filter (where le.event_type = 'enquiry_received')
      then extract(epoch from (
        min(le.occurred_at) filter (where le.event_type = 'ack_sent')
        - min(le.occurred_at) filter (where le.event_type = 'enquiry_received')))
    end as first_response_seconds
  from public.lead_events le
  group by le.lead_id
),
tom as (
  select percentile_cont(0.5) within group (
           order by extract(epoch from (s.sold_at - l.created_at)) / 86400.0) as median_days_on_market,
         count(*) as sold_listings
  from public.listings l
  join (
    select listing_id, min(occurred_at) as sold_at
    from public.lead_events
    where event_type = 'marked_sold' and listing_id is not null
    group by listing_id
  ) s on s.listing_id = l.id
),
epl as (
  select round(
           count(*) filter (where event_type = 'enquiry_received' and listing_id is not null)::numeric
           / nullif((select count(*) from public.listings), 0), 3) as enquiries_per_listing
  from public.lead_events
)
select
  count(*) filter (where facts.enquiry_at   is not null)                    as enquiries,
  count(*) filter (where facts.first_ack_at is not null)                    as first_responses,
  percentile_cont(0.5) within group (order by facts.first_response_seconds) as median_first_response_seconds,
  percentile_cont(0.9) within group (order by facts.first_response_seconds) as p90_first_response_seconds,
  count(*) filter (where facts.appointment_at is not null)                  as appointments,
  count(*) filter (where facts.sold_at        is not null)                  as sold,
  round(
    count(*) filter (where facts.appointment_at is not null)::numeric
    / nullif(count(*) filter (where facts.enquiry_at is not null), 0), 4)   as enquiry_to_appointment_rate,
  round(
    count(*) filter (where facts.sold_at is not null)::numeric
    / nullif(count(*) filter (where facts.appointment_at is not null), 0), 4) as appointment_to_sold_rate,
  (select median_days_on_market from tom)                                   as median_days_on_market,
  (select sold_listings         from tom)                                   as sold_listings,
  (select enquiries_per_listing from epl)                                   as enquiries_per_listing
from facts;

comment on view public.metrics_platform is
  '§9.2 PUBLIC platform aggregate — the published proof metric. Aggregate-only (no raw rows), security_invoker=off so anon reads across all dealers. The read layer applies the minimum-N threshold before publishing.';


-- ============================================================================
-- GRANTS — the dealer-scoped views ride lead_events'' RLS via security_invoker
-- (a dealer sees only their own rows; an admin, all). service_role is the
-- trusted backend (scripts/admin tooling) and reads them directly. The API's
-- per-dealer scoping uses the authenticated client, so RLS is still the gate in
-- request paths. The platform view is aggregate-only and safe for anon.
-- ============================================================================
grant select on public.metrics_lead_facts                     to authenticated, service_role;
grant select on public.metrics_dealer                         to authenticated, service_role;
grant select on public.metrics_first_response_30d_dealer      to authenticated, service_role;
grant select on public.metrics_time_on_market_dealer          to authenticated, service_role;
grant select on public.metrics_enquiries_per_listing_dealer   to authenticated, service_role;
grant select on public.metrics_platform                       to anon, authenticated, service_role;
