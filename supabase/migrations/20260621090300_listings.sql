-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 04 · Listings, photos, saved listings
-- ----------------------------------------------------------------------------
-- Full listing schema per strategy §9.3. A listing has EXACTLY ONE owner — a
-- dealer OR a private seller — enforced by the seller_type CHECK. Compliance is
-- architectural, not policy (strategy §7): a dealer listing is "in trade" and
-- MUST surface a Consumer Information Notice link, enforced as a CHECK.
-- ============================================================================

create table public.listings (
  id              uuid primary key default gen_random_uuid(),

  -- Ownership: exactly one of dealer_id / seller_user_id, consistent with seller_type.
  seller_type     seller_type not null,
  dealer_id       uuid references public.dealers (id) on delete restrict,  -- restrict: don't orphan leads (§9.5)
  seller_user_id  uuid references public.users (id)   on delete cascade,

  -- Vehicle identity
  make            text not null,
  model           text not null,
  year            int  not null,
  variant         text,

  -- Specification
  body_type       text,                 -- open set (sedan, hatch, ute, SUV, van, ...) -> TEXT by design
  fuel            fuel_type,
  transmission    transmission_type,
  odometer_km     int,
  colour          text,
  engine_size_cc  int,                  -- cc; NULL for EV
  cylinders       int,                  -- NULL for EV
  drive           drive_type,
  seats           int,

  -- History / compliance fields (seller-provided in v1, NZTA-verified in v2, §9.6)
  wof_expiry      date,                 -- Warrant of Fitness expiry
  rego_expiry     date,                 -- registration expiry
  previous_owners int,
  import_origin   text,                 -- 'NZ New', 'Japan Import', ... -> TEXT
  condition       text,

  -- Price
  price_nzd       numeric(12,2),
  is_poa          boolean not null default false,   -- price on application

  -- Location: suburb-approximate for the public; exact address is on the dealer (privacy, §6.2).
  suburb          text,
  city            text,
  region          text,
  latitude        double precision,     -- provisioned for the v2 map; suburb-centroid, NOT exact
  longitude       double precision,

  -- Presentation
  title           text,                 -- auto-generated from year/make/model if blank (set_listing_title); overridable
  description     text,

  -- Compliance flags (strategy §7) — mandatory on dealer listings (see CHECK below)
  in_trade        boolean not null default false,
  cin_link        text,

  -- Lifecycle (strategy §9.3)
  status          listing_status not null default 'draft',
  sold_price      numeric(12,2),
  sold_at         timestamptz,
  expires_at      timestamptz not null default (now() + interval '90 days'),   -- auto-expire after 90 days

  -- Semantic search (strategy §9.4) — column PROVISIONED now; index + embedding deferred.
  embedding       extensions.vector(1536),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Exactly one owner, consistent with seller_type.
  constraint listings_owner_ck check (
    (seller_type = 'dealer'  and dealer_id is not null and seller_user_id is null) or
    (seller_type = 'private' and seller_user_id is not null and dealer_id is null)
  ),
  -- A dealer listing is "in trade" and carries a CIN link (FTA/CGA, §7).
  constraint listings_dealer_compliance_ck check (
    seller_type <> 'dealer' or (in_trade = true and cin_link is not null)
  ),
  -- POA and a numeric price are mutually exclusive (both may be NULL on a draft).
  constraint listings_price_ck check (not (is_poa = true and price_nzd is not null)),
  -- sold_price is only meaningful once the listing is sold.
  constraint listings_sold_price_ck check (sold_price is null or status = 'sold'),
  constraint listings_year_ck check (year between 1900 and 2100),
  constraint listings_nonneg_ck check (
    coalesce(odometer_km, 0)     >= 0 and
    coalesce(engine_size_cc, 0)  >= 0 and
    coalesce(cylinders, 0)       >= 0 and
    coalesce(seats, 0)           >= 0 and
    coalesce(previous_owners, 0) >= 0
  ),
  constraint listings_description_len_ck check (char_length(coalesce(description, '')) <= 2000)
);
comment on table public.listings is
  'Vehicle listings (§9.3). Public reads ACTIVE only; owners read/write their own. The compliance CHECKs encode §7 for dealer listings (in_trade + CIN link).';
comment on column public.listings.embedding is
  'OpenAI text-embedding-3-small (1536-d). Provisioned in WP-1; semantic search and the ANN index are deferred (§9.4).';

create index listings_status_idx         on public.listings (status);
create index listings_dealer_idx         on public.listings (dealer_id);
create index listings_seller_user_idx    on public.listings (seller_user_id);
create index listings_make_model_idx     on public.listings (make, model);
create index listings_price_idx          on public.listings (price_nzd);
create index listings_year_idx           on public.listings (year);
create index listings_active_created_idx on public.listings (created_at desc) where status = 'active';
-- Deferred until semantic search ships and there are rows to tune the graph on:
--   create index listings_embedding_idx on public.listings
--     using hnsw (embedding extensions.vector_cosine_ops);

-- ---------- listing_photos ----------
create table public.listing_photos (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  storage_path  text not null,         -- Supabase Storage object path
  position      int  not null default 0,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);
comment on table public.listing_photos is
  'Up to 20 photos per listing (enforced by enforce_photo_limit); §9.3.';
create index listing_photos_listing_idx on public.listing_photos (listing_id, position);

-- ---------- saved_listings ----------
create table public.saved_listings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id)    on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, listing_id)
);
comment on table public.saved_listings is
  'Buyer-saved listings (§8.3). Private to the owning user.';
create index saved_listings_user_idx on public.saved_listings (user_id);
