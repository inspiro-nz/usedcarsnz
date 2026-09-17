-- UsedCarsNZ seed data — DEV / DEMO ONLY. NEVER run against production.
--
-- Applied automatically by `supabase start` / `supabase db reset` for LOCAL
-- (config.toml [db.seed]). Dev/Demo seeding is explicit via
-- scripts/seed-remote.sh (which refuses production); production is NEVER seeded.
--
-- Minimal fixture: one active dealer listing so the marketplace index shows a
-- card and the Playwright detail spec (e2e/marketplace.spec.ts) can open a
-- listing page instead of skipping. Fixed UUIDs + ON CONFLICT keep it re-runnable.
--
-- Runs as the DB owner, so the anon/authenticated privilege guards
-- (guard_dealer_row / guard_user_row) don't apply — we set status='approved'
-- and verified=true directly, which a client could never do.

-- 1) Auth user to own the dealer. Inserting into auth.users fires the
--    on_auth_user_created trigger, which creates the public.users profile.
--    The token/change columns must be '' not NULL: GoTrue scans them as Go
--    strings, and a NULL anywhere in auth.users makes every /admin/users list
--    call 500 with "Database error finding users" — which breaks
--    scripts/ensure-e2e-user.ts's repair path (it lists users when the E2E
--    user already exists).
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000a1',
  'authenticated', 'authenticated', 'seed-dealer@example.com', now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Seed Dealer"}', now(), now(),
  '', '', '', '', '', '', '', ''
)
on conflict (id) do nothing;

-- 2) Approved, verified dealer owned by that user.
insert into public.dealers (
  id, owner_user_id, business_name, contact_name, email, phone,
  suburb, city, region, status, verified
)
values (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000a1',
  'Seed Motors', 'Sam Seed', 'sales@seedmotors.example', '09 555 0100',
  'Mount Eden', 'Auckland', 'Auckland', 'approved', true
)
on conflict (id) do nothing;

-- 3) One active dealer listing (in_trade + cin_link satisfy the §7 compliance
--    CHECK). title auto-generates from year/make/model via set_listing_title.
insert into public.listings (
  id, seller_type, dealer_id, make, model, year, variant,
  body_type, fuel, transmission, odometer_km, colour, drive, seats,
  price_nzd, is_poa, suburb, city, region, description,
  in_trade, cin_link, status
)
values (
  '00000000-0000-0000-0000-0000000000c1',
  'dealer', '00000000-0000-0000-0000-0000000000d1',
  'Toyota', 'Corolla', 2019, 'GX Hatch',
  'hatch', 'petrol', 'automatic', 68000, 'Silver', 'fwd', 5,
  21990, false, 'Mount Eden', 'Auckland', 'Auckland',
  'Tidy one-owner Corolla hatch. Full service history, new WOF, great first car.',
  true, 'https://example.com/cin/seed-corolla', 'active'
)
on conflict (id) do nothing;
