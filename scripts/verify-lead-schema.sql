-- ============================================================================
-- scripts/verify-lead-schema.sql
-- ----------------------------------------------------------------------------
-- LOCAL / FRESH-DB ONLY (mirrors supabase/seed/seed.sql's warning). Run
-- immediately after `supabase db reset` and never against dev/demo/production
-- — it inserts fixture auth/dealer/listing/enquiry rows and issues statements
-- it EXPECTS to be rejected.
--
-- Asserts the four invariants that live entirely in Postgres and can't be
-- exercised by the vitest unit tests in lib/leads/events.test.ts:
--   1. lead_events rejects UPDATE and DELETE (prevent_mutation trigger,
--      20260621090500_functions_triggers.sql).
--   2. ai_drafts CHECK blocks status='approved' without approved_by/approved_at
--      (20260707100400_ai_drafts_harden.sql).
--   3. enquiries_external_message_id_key dedupes inbound-email leads
--      (20260707100300_enquiries_extend.sql).
--   4. approve_draft() atomically flips ai_drafts.status to 'approved' AND
--      appends the draft_approved lead_event (20260707100400_ai_drafts_harden.sql).
--
-- Connect as the `postgres` role (what `supabase db reset` itself uses) — this
-- script is not exercising RLS, only triggers/constraints/functions that apply
-- regardless of role. Prints "NOTICE: PASS: ..." for each assertion that
-- holds; any FAIL raises an uncaught exception so the script exits nonzero.
--
-- Usage:
--   supabase db reset
--   psql "$(supabase status -o env | sed -n 's/^DB_URL="\(.*\)"$/\1/p')" \
--     -v ON_ERROR_STOP=1 -f scripts/verify-lead-schema.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- ---------- fixtures: one auth user (dealer owner), dealer, listing, enquiry, draft ----------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'verify-owner@usedcarsnz.test',
  extensions.crypt('verify-lead-schema', extensions.gen_salt('bf')),
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);
-- on_auth_user_created (20260621090700) has now materialised public.users as 'buyer';
-- promote to 'dealer' directly (this superuser session isn't gated by guard_user_row).
update public.users set role = 'dealer' where id = '10000000-0000-0000-0000-000000000001';

insert into public.dealers (id, owner_user_id, business_name, status, verified)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Verify Motors', 'approved', true);

insert into public.listings (id, seller_type, dealer_id, make, model, year, in_trade, cin_link, status)
values ('30000000-0000-0000-0000-000000000001', 'dealer', '20000000-0000-0000-0000-000000000001', 'Toyota', 'Aqua', 2016, true, 'https://example.test/cin', 'active');

insert into public.enquiries (id, listing_id, buyer_name, buyer_email)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Verify Buyer', 'buyer@example.test');
-- enquiries_denorm/enquiries_logged (triggers) have set dealer_id and appended enquiry_received.

insert into public.ai_drafts (id, enquiry_id, draft_text)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Draft text for verification');


-- ============================================================================
-- 1) lead_events: UPDATE and DELETE must both be rejected
-- ============================================================================
do $$
declare
  v_event_id uuid;
  v_caught   boolean := false;
begin
  select id into v_event_id from public.lead_events
    where lead_id = '40000000-0000-0000-0000-000000000001' limit 1;
  if v_event_id is null then
    raise exception 'FAIL: fixture enquiry has no lead_events row (enquiry_log_received trigger did not fire)';
  end if;

  begin
    update public.lead_events set payload = '{"tampered":true}'::jsonb where id = v_event_id;
  exception when others then
    v_caught := true;
    raise notice 'PASS: UPDATE on lead_events was rejected (%)', sqlerrm;
  end;
  if not v_caught then
    raise exception 'FAIL: UPDATE on lead_events succeeded — immutability trigger did not fire';
  end if;

  v_caught := false;
  begin
    delete from public.lead_events where id = v_event_id;
  exception when others then
    v_caught := true;
    raise notice 'PASS: DELETE on lead_events was rejected (%)', sqlerrm;
  end;
  if not v_caught then
    raise exception 'FAIL: DELETE on lead_events succeeded — immutability trigger did not fire';
  end if;
end;
$$;


-- ============================================================================
-- 2) ai_drafts: CHECK constraint blocks approved without an approver
-- ============================================================================
do $$
declare
  v_caught boolean := false;
begin
  begin
    update public.ai_drafts
      set status = 'approved'      -- approved_by / approved_at left NULL on purpose
      where id = '50000000-0000-0000-0000-000000000001';
  exception when others then
    v_caught := true;
    raise notice 'PASS: ai_drafts CHECK rejected approved without approver (%)', sqlerrm;
  end;
  if not v_caught then
    raise exception 'FAIL: ai_drafts allowed status=approved with approved_by/approved_at NULL';
  end if;
end;
$$;


-- ============================================================================
-- 3) enquiries: external_message_id dedupe index
-- ============================================================================
do $$
declare
  v_caught boolean := false;
begin
  insert into public.enquiries (id, listing_id, buyer_name, buyer_email, source, external_message_id)
  values ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
          'Verify Buyer 2', 'buyer2@example.test', 'email_trademe', 'msg-dedupe-test-1');

  begin
    insert into public.enquiries (id, listing_id, buyer_name, buyer_email, source, external_message_id)
    values ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
            'Verify Buyer 3', 'buyer3@example.test', 'email_trademe', 'msg-dedupe-test-1');
  exception when unique_violation then
    v_caught := true;
    raise notice 'PASS: duplicate external_message_id rejected (%)', sqlerrm;
  end;
  if not v_caught then
    raise exception 'FAIL: enquiries allowed two rows with the same external_message_id';
  end if;
end;
$$;


-- ============================================================================
-- 4) approve_draft(): atomic status flip + draft_approved lead_event
-- ============================================================================
do $$
declare
  v_events_before int;
  v_events_after  int;
  v_status        public.ai_draft_status;
  v_approved_by   uuid;
  v_approved_at   timestamptz;
begin
  select count(*) into v_events_before
    from public.lead_events where lead_id = '40000000-0000-0000-0000-000000000001';

  -- approve_draft() authorizes via auth.uid() (is_dealer_member/is_admin); as
  -- the postgres superuser session auth.uid() would otherwise be NULL, so
  -- impersonate the fixture dealer owner the same way Supabase's own RLS
  -- testing helpers do, via the request.jwt.claims GUC auth.uid() reads.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '10000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
    true
  );

  perform public.approve_draft('50000000-0000-0000-0000-000000000001');

  select status, approved_by, approved_at
    into v_status, v_approved_by, v_approved_at
    from public.ai_drafts where id = '50000000-0000-0000-0000-000000000001';

  if v_status <> 'approved' or v_approved_by is null or v_approved_at is null then
    raise exception 'FAIL: approve_draft() did not set status/approved_by/approved_at (status=%, approved_by=%, approved_at=%)',
      v_status, v_approved_by, v_approved_at;
  end if;
  raise notice 'PASS: approve_draft() set status=approved with approver recorded';

  select count(*) into v_events_after
    from public.lead_events where lead_id = '40000000-0000-0000-0000-000000000001';

  if not exists (
    select 1 from public.lead_events
    where lead_id = '40000000-0000-0000-0000-000000000001'
      and event_type = 'draft_approved'
      and payload ->> 'draft_id' = '50000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FAIL: approve_draft() did not append a draft_approved lead_event';
  end if;
  if v_events_after <= v_events_before then
    raise exception 'FAIL: lead_events count did not increase after approve_draft() (before=%, after=%)',
      v_events_before, v_events_after;
  end if;
  raise notice 'PASS: approve_draft() atomically appended the draft_approved lead_event (% -> % events)',
    v_events_before, v_events_after;
end;
$$;

do $$ begin raise notice 'ALL CHECKS PASSED'; end; $$;
