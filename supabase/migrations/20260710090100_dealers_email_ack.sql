-- ============================================================================
-- UsedCarsNZ · WP-5 · Migration 17 · dealers.email_ack_enabled
-- ----------------------------------------------------------------------------
-- ADDITIVE ONLY. The inbound-email lane's templated acknowledgement is
-- per-dealer opt-in (§5.3, §7): a dealer who forwards their Trade Me leads may
-- not want an automated "we're onto it" reply going to buyers who never
-- contacted UsedCarsNZ directly. Defaults to true (opt-out) so the pilot's
-- sub-60s lift is on by default; a dealer can be flipped off individually.
--
-- Applies ONLY to the email lane. The platform form's ack (POST /api/enquiries)
-- is unconditional — a buyer who filled in our form always gets the reply — so
-- that path does not read this column.
--
-- No new grant needed: the blanket dealers grants from migration 07 already
-- cover every column, and this is read server-side (service_role) anyway.
-- ============================================================================

alter table public.dealers
  add column if not exists email_ack_enabled boolean not null default true;

comment on column public.dealers.email_ack_enabled is
  'Inbound-email lane only: when true, an alias-routed email lead gets the templated first-touch ack. Default true (opt-out). The platform-form ack ignores this and always sends.';
