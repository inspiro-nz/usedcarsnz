-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 03 · Identity & dealer org
-- ----------------------------------------------------------------------------
-- public.users extends Supabase auth.users 1:1 (a row is auto-created on signup
-- by handle_new_user in migration 08). dealers is the business entity;
-- staff_accounts attaches additional sales staff to a dealer (the owner is on
-- dealers.owner_user_id). NZBN verification + manual admin approval gate dealer
-- listings (strategy §9.6, §8.1).
-- ============================================================================

-- ---------- users ----------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        user_role   not null default 'buyer',
  full_name   text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.users is
  'App-side profile, 1:1 with auth.users. role drives access; role transitions are admin/backend-only (enforced by guard_user_row).';

-- ---------- dealers ----------
create table public.dealers (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references public.users (id) on delete restrict,
  business_name  text not null,
  nzbn           text,                 -- NZ Business Number, verified at approval (§9.6)
  contact_name   text,
  email          text,
  phone          text,
  address_line   text,                 -- exact street address lives on the dealer, NOT the listing (privacy, §6.2)
  suburb         text,
  city           text,
  region         text,
  postcode       text,
  logo_url       text,                 -- Supabase Storage path/URL
  status         dealer_status not null default 'pending',
  verified       boolean       not null default false,   -- verified-dealer badge (§9.6)
  approved_by    uuid references public.users (id),
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.dealers is
  'Dealer business entity. status / verified / owner are admin/backend-only (guard_dealer_row); the public can read only APPROVED dealers.';

-- One NZBN maps to at most one dealer (when present).
create unique index dealers_nzbn_key   on public.dealers (nzbn) where nzbn is not null;
create index        dealers_owner_idx  on public.dealers (owner_user_id);
create index        dealers_status_idx on public.dealers (status);

-- ---------- staff_accounts ----------
create table public.staff_accounts (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references public.dealers (id) on delete cascade,
  user_id     uuid not null references public.users (id)   on delete cascade,
  role        staff_role  not null default 'sales',
  created_at  timestamptz not null default now(),
  unique (dealer_id, user_id)
);
comment on table public.staff_accounts is
  'Sales-staff sub-accounts under a dealer (§9.6). Membership grants access to that dealer''s data via is_dealer_member().';
create index staff_accounts_user_idx   on public.staff_accounts (user_id);
create index staff_accounts_dealer_idx on public.staff_accounts (dealer_id);
