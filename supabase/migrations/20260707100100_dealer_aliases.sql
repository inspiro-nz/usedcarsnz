-- ============================================================================
-- UsedCarsNZ · WP-1.1 · Migration 10 · dealer_aliases
-- ----------------------------------------------------------------------------
-- Maps an inbound email local-part (the "lead-{slug}" alias a dealer publishes
-- as their TradeMe reply-to / generic contact address) to the owning dealer,
-- so an inbound email lead (enquiries.source = 'email_trademe' |
-- 'email_other') can be routed without trusting anything in the email itself.
--
-- Provisioning is ADMIN-ONLY by design: alias->dealer_id is a routing security
-- boundary (get it wrong and one dealer's leads land on another dealer's
-- desk), so unlike `dealers` there is no self-service insert path here at all,
-- not even a pending/approved state — a dealer never writes their own row.
-- ============================================================================

create table public.dealer_aliases (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references public.dealers (id) on delete cascade,
  alias       text not null,
  source_hint public.dealer_alias_source not null default 'generic',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.dealer_aliases is
  'Inbound-email alias -> dealer_id routing table. Admin-provisioned only (routing security boundary); dealers read their own rows but never write them.';
comment on column public.dealer_aliases.alias is
  'The lead-{slug} local part of the inbound address, e.g. "lead-addington-autos" for lead-addington-autos@usedcarsnz.co.nz.';

create unique index dealer_aliases_alias_key  on public.dealer_aliases (alias);
create index        dealer_aliases_dealer_idx on public.dealer_aliases (dealer_id);

alter table public.dealer_aliases enable row level security;

create policy dealer_aliases_select on public.dealer_aliases
  for select to authenticated
  using (public.is_dealer_member(dealer_id) or public.is_admin());

create policy dealer_aliases_insert on public.dealer_aliases
  for insert to authenticated
  with check (public.is_admin());

create policy dealer_aliases_update on public.dealer_aliases
  for update to authenticated
  using      (public.is_admin())
  with check (public.is_admin());

create policy dealer_aliases_delete on public.dealer_aliases
  for delete to authenticated
  using (public.is_admin());

-- New table: the blanket `grant all ... to service_role` in migration 07 only
-- covered tables that existed at the time it ran, so grants are repeated here.
grant select, insert, update, delete on public.dealer_aliases to authenticated;
grant all on public.dealer_aliases to service_role;
