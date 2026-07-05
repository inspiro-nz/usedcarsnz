-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 07 · Row-Level Security & grants
-- ----------------------------------------------------------------------------
-- Access model (strategy §8, §9):
--   * Buyers need NO account to browse or enquire.
--   * Public (anon) reads ACTIVE listings + their photos + APPROVED dealers only.
--   * A dealer (owner or staff) reads/writes ONLY its own listings / enquiries /
--     leads / drafts / staff.
--   * A logged-in buyer reads their own enquiries and saved listings.
--   * Admin: full access. service_role (backend) bypasses RLS.
--
-- RLS is the real gate. The GRANTs below only open the door that RLS then guards;
-- they are written explicitly so the migration behaves identically on a bare
-- Postgres as on a Supabase project (which pre-grants similar privileges).
-- ============================================================================

-- ---------------------------------------------------------------- users ------
alter table public.users enable row level security;

create policy users_select on public.users
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy users_insert on public.users
  for insert to authenticated
  with check (id = (select auth.uid()));        -- self profile; guard_user_row forces role = buyer

create policy users_update on public.users
  for update to authenticated
  using      (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());  -- guard blocks role escalation

create policy users_delete on public.users
  for delete to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------- dealers ------
alter table public.dealers enable row level security;

create policy dealers_select on public.dealers
  for select to anon, authenticated
  using (status = 'approved' or public.is_dealer_member(id) or public.is_admin());

create policy dealers_insert on public.dealers
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));  -- guard forces status=pending, verified=false

create policy dealers_update on public.dealers
  for update to authenticated
  using      (public.is_dealer_member(id) or public.is_admin())
  with check (public.is_dealer_member(id) or public.is_admin());  -- guard blocks status/verified/owner

create policy dealers_delete on public.dealers
  for delete to authenticated
  using (public.is_admin());

-- ------------------------------------------------------- staff_accounts ------
alter table public.staff_accounts enable row level security;

create policy staff_select on public.staff_accounts
  for select to authenticated
  using (public.is_dealer_member(dealer_id) or public.is_admin());

create policy staff_insert on public.staff_accounts
  for insert to authenticated
  with check (public.is_dealer_owner(dealer_id) or public.is_admin());

create policy staff_update on public.staff_accounts
  for update to authenticated
  using      (public.is_dealer_owner(dealer_id) or public.is_admin())
  with check (public.is_dealer_owner(dealer_id) or public.is_admin());

create policy staff_delete on public.staff_accounts
  for delete to authenticated
  using (public.is_dealer_owner(dealer_id) or public.is_admin());

-- ------------------------------------------------------------- listings ------
alter table public.listings enable row level security;

create policy listings_select on public.listings
  for select to anon, authenticated
  using (
    status = 'active'
    or public.is_dealer_member(dealer_id)
    or seller_user_id = (select auth.uid())
    or public.is_admin()
  );

create policy listings_insert on public.listings
  for insert to authenticated
  with check (
    (seller_type = 'dealer'  and public.is_dealer_member(dealer_id))
    or (seller_type = 'private' and seller_user_id = (select auth.uid()))
    or public.is_admin()
  );

create policy listings_update on public.listings
  for update to authenticated
  using (
    public.is_dealer_member(dealer_id) or seller_user_id = (select auth.uid()) or public.is_admin()
  )
  with check (
    (seller_type = 'dealer'  and public.is_dealer_member(dealer_id))
    or (seller_type = 'private' and seller_user_id = (select auth.uid()))
    or public.is_admin()
  );

create policy listings_delete on public.listings
  for delete to authenticated
  using (
    public.is_dealer_member(dealer_id) or seller_user_id = (select auth.uid()) or public.is_admin()
  );

-- ------------------------------------------------------- listing_photos ------
alter table public.listing_photos enable row level security;

-- Visible iff the parent listing is visible to the caller (reuses listings RLS).
create policy listing_photos_select on public.listing_photos
  for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy listing_photos_insert on public.listing_photos
  for insert to authenticated
  with check (public.is_listing_owner(listing_id) or public.is_admin());

create policy listing_photos_update on public.listing_photos
  for update to authenticated
  using      (public.is_listing_owner(listing_id) or public.is_admin())
  with check (public.is_listing_owner(listing_id) or public.is_admin());

create policy listing_photos_delete on public.listing_photos
  for delete to authenticated
  using (public.is_listing_owner(listing_id) or public.is_admin());

-- ------------------------------------------------------------ enquiries ------
alter table public.enquiries enable row level security;

-- Buyers need no account: anon + authenticated may INSERT on an ACTIVE listing.
-- dealer_id/seller_user_id are set by set_enquiry_denorm; not part of the check.
create policy enquiries_insert on public.enquiries
  for insert to anon, authenticated
  with check (
    (buyer_user_id is null or buyer_user_id = (select auth.uid()))
    and exists (select 1 from public.listings l where l.id = listing_id and l.status = 'active')
  );

create policy enquiries_select on public.enquiries
  for select to authenticated
  using (
    public.is_dealer_member(dealer_id)
    or seller_user_id = (select auth.uid())
    or buyer_user_id  = (select auth.uid())
    or public.is_admin()
  );

create policy enquiries_update on public.enquiries
  for update to authenticated
  using      (public.is_dealer_member(dealer_id) or seller_user_id = (select auth.uid()) or public.is_admin())
  with check (public.is_dealer_member(dealer_id) or seller_user_id = (select auth.uid()) or public.is_admin());

create policy enquiries_delete on public.enquiries
  for delete to authenticated
  using (public.is_admin());   -- leads are not casually deleted; FK from lead_events also restricts

-- ------------------------------------------------------------- ai_drafts -----
alter table public.ai_drafts enable row level security;

-- Drafts are created by the AI/backend (service_role bypasses RLS). Clients may
-- not INSERT (admin-only via RLS); they SELECT and UPDATE (approve/edit) their own.
create policy ai_drafts_insert on public.ai_drafts
  for insert to authenticated
  with check (public.is_admin());

create policy ai_drafts_select on public.ai_drafts
  for select to authenticated
  using (public.is_dealer_member(dealer_id) or seller_user_id = (select auth.uid()) or public.is_admin());

create policy ai_drafts_update on public.ai_drafts
  for update to authenticated
  using      (public.is_dealer_member(dealer_id) or seller_user_id = (select auth.uid()) or public.is_admin())
  with check (public.is_dealer_member(dealer_id) or seller_user_id = (select auth.uid()) or public.is_admin());

create policy ai_drafts_delete on public.ai_drafts
  for delete to authenticated
  using (public.is_admin());

-- --------------------------------------------------------- saved_listings ----
alter table public.saved_listings enable row level security;

create policy saved_listings_all on public.saved_listings
  for all to authenticated
  using      (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

-- ------------------------------------------------------------ lead_events ----
alter table public.lead_events enable row level security;

-- Dealers read their OWN conversion events; admin reads all.
-- The PUBLIC aggregate metric (§9.2) must be served as aggregate-only output
-- (a SECURITY DEFINER function or a view returning counts/medians, never raw
-- rows) — that belongs to the dashboard work package, not here.
create policy lead_events_select on public.lead_events
  for select to authenticated
  using (public.is_dealer_member(dealer_id) or public.is_admin());

-- No INSERT/UPDATE/DELETE policies for anon/authenticated: writes happen only via
-- the service_role backend (RLS-bypass) or the SECURITY DEFINER triggers /
-- log_lead_event. UPDATE/DELETE/TRUNCATE are additionally blocked for ALL roles
-- by prevent_mutation (migration 06).


-- ============================================================================
-- GRANTS  (least privilege; RLS is the gate)
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;

-- anon: browse public data + create enquiries (no account needed). Nothing else.
grant select on public.listings       to anon;
grant select on public.listing_photos to anon;
grant select on public.dealers        to anon;
grant insert on public.enquiries      to anon;

-- authenticated: full DML surface, gated entirely by the policies above.
grant select, insert, update, delete on
  public.users, public.dealers, public.staff_accounts,
  public.listings, public.listing_photos, public.saved_listings,
  public.enquiries, public.ai_drafts
to authenticated;
grant select on public.lead_events to authenticated;   -- read own events (RLS); never write

-- service_role: full access (bypasses RLS); but lead_events stays append-only
-- even for the backend — remove the privilege as well as relying on the trigger.
grant all on all tables in schema public to service_role;
revoke update, delete, truncate on public.lead_events from service_role;
