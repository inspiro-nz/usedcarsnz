-- ============================================================================
-- UsedCarsNZ · Revoke the default privileges Supabase grants to anon/authenticated
-- ----------------------------------------------------------------------------
-- ROOT CAUSE
-- Supabase ships ALTER DEFAULT PRIVILEGES that grant every new object in the
-- `public` schema to the `anon` and `authenticated` roles EXPLICITLY. Earlier
-- migrations tried to lock objects down with
--
--     revoke all on function ... from public;
--     grant execute on function ... to service_role;
--
-- but `REVOKE ... FROM PUBLIC` only drops the PUBLIC pseudo-role grant. It does
-- not touch an explicit per-role grant, so anon/authenticated kept EXECUTE and
-- the intended "service_role only" was never actually in force. Same story for
-- the tables and views that documented themselves as service-role-only: they
-- relied on "RLS enabled, no policies", which returns zero rows rather than
-- refusing outright, so the grant was never the barrier it was assumed to be.
--
-- PROVEN IMPACT (local stack, publishable key only, no account):
--   POST /rest/v1/rpc/log_lead_event  ->  HTTP 200, row written.
-- log_lead_event is SECURITY DEFINER, so RLS does not constrain it. Any
-- anonymous visitor could append forged rows — including `ack_sent`, the event
-- behind the published median-first-response metric — to `lead_events`. That
-- table is deliberately immutable (prevent_mutation blocks UPDATE/DELETE for
-- every role including the owner), so a forged row could never be cleaned up.
-- A permanent, unauthenticated poison of the headline trust metric.
--
-- Not exploitable, but wrong for the same reason: purge_inbound_email_raw was
-- also anon-callable (its DELETE happens to be stopped by Supabase's separate
-- storage-table guard), and approve_draft was granted to anon as well as
-- authenticated.
--
-- These revokes restore what each original migration said it was doing. The
-- tests in tests/db-invariants/rls-deny-matrix.test.ts and
-- lead-events-immutability.test.ts assert this posture and were red until now.
-- ============================================================================

-- ── Functions ───────────────────────────────────────────────────────────────

-- The sole sanctioned append path into the immutable audit log. Backend only.
revoke all on function public.log_lead_event(uuid, public.lead_event_type, public.lead_actor, jsonb, timestamptz)
  from anon, authenticated;

-- Retention job. Backend/cron only.
revoke all on function public.purge_inbound_email_raw(interval)
  from anon, authenticated;

-- Dealers approve their own drafts from the app, so `authenticated` keeps
-- EXECUTE; an anonymous caller has no business here. (The function's own guard
-- also refuses anon now that 20260904090000 made the predicate NULL-safe — this
-- is the grant-level half of the same fix.)
revoke all on function public.approve_draft(uuid) from anon;

-- ── Tables documented as service-role-only ──────────────────────────────────

revoke all on table public.email_outbox   from anon, authenticated;
revoke all on table public.keepalive_ping from anon, authenticated;

-- ── Dealer-scoped metrics views ─────────────────────────────────────────────
-- These are security_invoker views over lead_events, so RLS already scopes rows
-- per dealer; anon was never intended to reach them at all. metrics_platform is
-- deliberately NOT revoked — it is the aggregate-only public proof metric.

revoke all on public.metrics_lead_facts                 from anon;
revoke all on public.metrics_dealer                     from anon;
revoke all on public.metrics_first_response_30d_dealer  from anon;
revoke all on public.metrics_time_on_market_dealer      from anon;
revoke all on public.metrics_enquiries_per_listing_dealer from anon;

-- ── Anon write surface ──────────────────────────────────────────────────────
-- The no-account enquiry funnel needs INSERT (and SELECT, so PostgREST can
-- return the inserted row). It must never be able to mutate an existing lead.
-- Without this, an anon UPDATE matched zero rows under RLS and returned success
-- rather than an error — a silent no-op that looked like a permitted write.

revoke update, delete, truncate on table public.enquiries from anon;
