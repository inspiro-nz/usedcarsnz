-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 06 · Functions & triggers
-- ----------------------------------------------------------------------------
-- Three groups:
--   (a) RLS helper predicates  — SECURITY DEFINER so they bypass RLS on the
--       tables they read (this is what prevents policy recursion, e.g. a
--       staff_accounts policy that needs to read staff_accounts).
--   (b) Trigger functions      — denormalisation, conveniences, and the
--       privilege guards. The guards are SECURITY INVOKER on purpose: they read
--       current_user to tell a trusted backend (service_role / db owner) apart
--       from an untrusted client (anon / authenticated).
--   (c) The lead_events immutability guard (prevent_mutation) + all triggers.
--
-- All functions set an explicit search_path and schema-qualify every object, per
-- Supabase's function-hardening guidance.
-- ============================================================================


-- ============================================================================
-- (a) RLS HELPER PREDICATES  (SECURITY DEFINER — bypass RLS, break recursion)
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role = 'admin'
  );
$$;
comment on function public.is_admin() is 'True if the current user is a platform admin. SECURITY DEFINER to read users under RLS.';

create or replace function public.is_dealer_member(p_dealer_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_dealer_id is not null and (
    exists (select 1 from public.dealers d
            where d.id = p_dealer_id and d.owner_user_id = (select auth.uid()))
    or exists (select 1 from public.staff_accounts s
               where s.dealer_id = p_dealer_id and s.user_id = (select auth.uid()))
  );
$$;
comment on function public.is_dealer_member(uuid) is 'True if the current user is the owner OR a staff member of the dealer.';

create or replace function public.is_dealer_owner(p_dealer_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_dealer_id is not null and exists (
    select 1 from public.dealers d
    where d.id = p_dealer_id and d.owner_user_id = (select auth.uid())
  );
$$;
comment on function public.is_dealer_owner(uuid) is 'True if the current user is the dealer owner (used to gate staff management).';

create or replace function public.is_listing_owner(p_listing_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing_id and (
      (l.seller_type = 'dealer'  and public.is_dealer_member(l.dealer_id)) or
      (l.seller_type = 'private' and l.seller_user_id = (select auth.uid()))
    )
  );
$$;
comment on function public.is_listing_owner(uuid) is 'True if the current user owns the listing (dealer member or private seller).';


-- ============================================================================
-- (b) TRIGGER FUNCTIONS
-- ============================================================================

-- updated_at maintenance ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- users guard: no self-assigned privilege --------------------------------------
-- SECURITY INVOKER: current_user must reflect the SESSION role. Trusted contexts
-- (service_role backend, db owner) may set/transition roles freely; clients cannot.
create or replace function public.guard_user_row()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.role := 'buyer';                 -- ignore any client-supplied role
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Only an admin may change a user role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

-- dealers guard: no self-approval ----------------------------------------------
create or replace function public.guard_dealer_row()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status      := 'pending';        -- cannot self-approve / self-verify
      new.verified    := false;
      new.approved_by := null;
      new.approved_at := null;
    elsif tg_op = 'UPDATE' then
      if new.status        is distinct from old.status
         or new.verified   is distinct from old.verified
         or new.owner_user_id is distinct from old.owner_user_id then
        raise exception 'Only an admin may change dealer status, verification, or ownership'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- listing title: auto-generate from year/make/model when blank (overridable) ---
create or replace function public.set_listing_title()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.title is null or btrim(new.title) = '' then
    new.title := btrim(
      new.year::text || ' ' || new.make || ' ' || new.model ||
      coalesce(' ' || nullif(btrim(new.variant), ''), '')
    );
  end if;
  return new;
end;
$$;

-- enforce the 20-photos-per-listing cap (§9.3) ---------------------------------
-- SECURITY DEFINER so the count is over ALL photos, not just RLS-visible ones.
create or replace function public.enforce_photo_limit()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  n int;
begin
  select count(*) into n from public.listing_photos where listing_id = new.listing_id;
  if n >= 20 then
    raise exception 'A listing may have at most 20 photos (§9.3)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- enquiries: denormalise dealer_id / seller_user_id authoritatively from listing
create or replace function public.set_enquiry_denorm()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare l record;
begin
  select seller_type, dealer_id, seller_user_id
    into l
    from public.listings
    where id = new.listing_id;
  if not found then
    raise exception 'Enquiry references a non-existent listing';
  end if;
  new.dealer_id      := l.dealer_id;        -- from the listing, never the client
  new.seller_user_id := l.seller_user_id;
  return new;
end;
$$;

-- The ONLY sanctioned append path for lead_events -----------------------------
-- SECURITY DEFINER: inserts into the immutable log regardless of RLS, copying
-- dealer_id / listing_id from the lead (never trusting the caller). EXECUTE is
-- locked to service_role below so clients can never forge events.
create or replace function public.log_lead_event(
  p_lead_id     uuid,
  p_event_type  public.lead_event_type,
  p_actor       public.lead_actor,
  p_payload     jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_dealer_id  uuid;
  v_listing_id uuid;
  v_id         uuid;
begin
  select e.dealer_id, e.listing_id
    into v_dealer_id, v_listing_id
    from public.enquiries e
    where e.id = p_lead_id;
  if not found then
    raise exception 'log_lead_event: unknown lead %', p_lead_id;
  end if;

  insert into public.lead_events
    (lead_id, dealer_id, listing_id, event_type, actor, occurred_at, payload)
  values
    (p_lead_id, v_dealer_id, v_listing_id, p_event_type, p_actor,
     coalesce(p_occurred_at, now()), coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;
comment on function public.log_lead_event(uuid, public.lead_event_type, public.lead_actor, jsonb, timestamptz) is
  'Sanctioned append path for lead_events. dealer_id/listing_id are copied from the lead. EXECUTE granted to service_role only; clients cannot forge events.';

-- enquiries: log the funnel-entry event atomically with the insert ------------
create or replace function public.enquiry_log_received()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.log_lead_event(
    new.id,
    'enquiry_received',
    'system',
    jsonb_build_object('source', 'buyer', 'has_message', (new.message is not null)),
    new.created_at
  );
  return new;
end;
$$;

-- ai_drafts: denormalise dealer_id / seller_user_id from the parent enquiry ----
create or replace function public.set_ai_draft_denorm()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare e record;
begin
  select dealer_id, seller_user_id into e from public.enquiries where id = new.enquiry_id;
  if not found then
    raise exception 'ai_draft references a non-existent enquiry';
  end if;
  new.dealer_id      := e.dealer_id;
  new.seller_user_id := e.seller_user_id;
  return new;
end;
$$;

-- The immutability guard for lead_events --------------------------------------
-- Fires for ALL roles (triggers are not bypassed by BYPASSRLS, and the Supabase
-- service_role/postgres roles are not superusers). Used for row-level UPDATE/DELETE
-- and statement-level TRUNCATE.
create or replace function public.prevent_mutation()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'lead_events is append-only and immutable: % is not permitted. Append a compensating event instead.', tg_op
    using errcode = 'check_violation';
  return null;  -- unreachable
end;
$$;


-- ============================================================================
-- (c) TRIGGERS
-- ============================================================================

-- updated_at
create trigger users_set_updated_at     before update on public.users     for each row execute function public.set_updated_at();
create trigger dealers_set_updated_at   before update on public.dealers   for each row execute function public.set_updated_at();
create trigger listings_set_updated_at  before update on public.listings  for each row execute function public.set_updated_at();
create trigger enquiries_set_updated_at before update on public.enquiries for each row execute function public.set_updated_at();
create trigger ai_drafts_set_updated_at before update on public.ai_drafts for each row execute function public.set_updated_at();

-- privilege guards
create trigger users_guard   before insert or update on public.users   for each row execute function public.guard_user_row();
create trigger dealers_guard before insert or update on public.dealers for each row execute function public.guard_dealer_row();

-- listing conveniences / limits
create trigger listings_set_title    before insert or update on public.listings       for each row execute function public.set_listing_title();
create trigger listing_photos_limit  before insert           on public.listing_photos for each row execute function public.enforce_photo_limit();

-- lead engine: denormalise + auto-log enquiry_received
create trigger enquiries_denorm before insert on public.enquiries for each row execute function public.set_enquiry_denorm();
create trigger enquiries_logged after  insert on public.enquiries for each row execute function public.enquiry_log_received();
create trigger ai_drafts_denorm before insert on public.ai_drafts for each row execute function public.set_ai_draft_denorm();

-- IMMUTABILITY: lead_events rejects UPDATE / DELETE / TRUNCATE for every role.
create trigger lead_events_no_update   before update   on public.lead_events for each row       execute function public.prevent_mutation();
create trigger lead_events_no_delete   before delete   on public.lead_events for each row       execute function public.prevent_mutation();
create trigger lead_events_no_truncate before truncate on public.lead_events for each statement execute function public.prevent_mutation();

-- Lock the append path: only the service_role backend may call it directly.
-- (The enquiry trigger calls it internally as the function owner, so it is unaffected.)
revoke all     on function public.log_lead_event(uuid, public.lead_event_type, public.lead_actor, jsonb, timestamptz) from public;
grant  execute on function public.log_lead_event(uuid, public.lead_event_type, public.lead_actor, jsonb, timestamptz) to   service_role;
