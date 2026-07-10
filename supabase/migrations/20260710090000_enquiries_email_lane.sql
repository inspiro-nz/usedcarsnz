-- ============================================================================
-- UsedCarsNZ · WP-5 · Migration 16 · enquiries: listing-less email leads
-- ----------------------------------------------------------------------------
-- ADDITIVE ONLY. Does NOT edit any prior migration; relaxes one constraint and
-- rewrites one trigger function via CREATE OR REPLACE.
--
-- WHY: the inbound-email lane (§5.3) creates leads from a dealer's EXISTING
-- Trade Me traffic — cars that live on Trade Me, not on UsedCarsNZ. Such a lead
-- has NO listing on our platform, but enquiries.listing_id was NOT NULL and
-- set_enquiry_denorm() (migration 06) both required the listing to exist AND
-- derived dealer_id from it, overwriting anything the caller supplied. That is
-- exactly right for the platform form (dealer_id must never be client-trusted)
-- but makes an alias-routed email lead impossible to insert.
--
-- Migration 12 added enquiries.source/external_message_id "for email-sourced
-- leads" but never reconciled this. This migration finishes that job:
--   (a) listing_id becomes NULLABLE.
--   (b) set_enquiry_denorm(): when listing_id IS NULL, TRUST the caller's
--       dealer_id (resolved server-side from dealer_aliases by the inbound
--       endpoint — an admin-provisioned routing boundary, never client input);
--       when listing_id IS NOT NULL, behaviour is byte-for-byte unchanged, so
--       the platform form's "dealer_id from the listing, never the client"
--       invariant is fully preserved for every existing code path.
--
-- log_lead_event() already copies a NULL listing_id through unharmed
-- (lead_events.listing_id is nullable), so the immutable log needs no change.
-- ============================================================================

alter table public.enquiries
  alter column listing_id drop not null;

comment on column public.enquiries.listing_id is
  'The listing the enquiry is about. NULL only for inbound-email leads (source = email_*) whose vehicle lives off-platform (e.g. Trade Me); those are routed to a dealer via dealer_aliases instead. Platform-form leads always have a listing.';

-- Rewrite the denorm trigger to handle the listing-less case without weakening
-- the listing-present case. SECURITY DEFINER + empty search_path preserved.
create or replace function public.set_enquiry_denorm()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare l record;
begin
  -- Listing-less inbound-email lead: dealer_id is authoritative from the
  -- inbound endpoint's alias resolution (service-role). It MUST be present —
  -- a lead with neither a listing nor a dealer cannot be routed to anyone.
  if new.listing_id is null then
    if new.dealer_id is null then
      raise exception 'A listing-less enquiry must supply a dealer_id (alias-resolved email lead)';
    end if;
    new.seller_user_id := null;   -- email leads are always dealer leads, never private-seller
    return new;
  end if;

  -- Listing-present lead (platform form): dealer_id/seller_user_id come from
  -- the listing, never the client. Unchanged from migration 06.
  select seller_type, dealer_id, seller_user_id
    into l
    from public.listings
    where id = new.listing_id;
  if not found then
    raise exception 'Enquiry references a non-existent listing';
  end if;
  new.dealer_id      := l.dealer_id;
  new.seller_user_id := l.seller_user_id;
  return new;
end;
$$;
