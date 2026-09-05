-- ============================================================================
-- UsedCarsNZ · WP-5 · Migration 18 · inbound raw-MIME retention
-- ----------------------------------------------------------------------------
-- ADDITIVE ONLY. The inbound-email endpoint persists the ORIGINAL raw MIME of
-- every processed lead email to a PRIVATE storage bucket, so a mis-parse can be
-- diagnosed against the source and so we can honour a deletion request. It is
-- retained for 30 days, then purged (§7 data-minimisation).
--
-- SCOPE NOTE (per the Prompt-5 brief): this migration creates the storage
-- bucket and the purge FUNCTION only. Wiring the actual CRON trigger that calls
-- it on a schedule is DEFERRED to Prompt 7 (alongside the email_outbox sweep
-- cron, migration 15). Until then the function exists and can be invoked
-- manually / from a script.
-- ============================================================================

-- Private bucket. `public = false` => no anonymous/authenticated read; the only
-- reader/writer is the service_role backend (which bypasses storage RLS).
insert into storage.buckets (id, name, public)
values ('inbound-email-raw', 'inbound-email-raw', false)
on conflict (id) do nothing;

-- Purge everything older than the 30-day retention window. SECURITY DEFINER so
-- it can delete storage.objects regardless of RLS; EXECUTE locked to
-- service_role (this is a backend/cron maintenance op, never a client call).
--
-- Deleting the storage.objects row is the sanctioned purge for the local stack.
-- Prompt 7, when it wires the cron, must confirm this also reclaims the
-- underlying object on the hosted projects (or switch to a storage-API delete)
-- and add an observability counter.
create or replace function public.purge_inbound_email_raw(p_older_than interval default interval '30 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with gone as (
    delete from storage.objects
    where bucket_id = 'inbound-email-raw'
      and created_at < now() - p_older_than
    returning 1
  )
  select count(*) into v_deleted from gone;
  return v_deleted;
end;
$$;

comment on function public.purge_inbound_email_raw(interval) is
  'Deletes inbound raw-MIME objects older than the retention window (default 30 days). Backend/cron maintenance only; EXECUTE granted to service_role. Cron wiring deferred to Prompt 7.';

revoke all     on function public.purge_inbound_email_raw(interval) from public;
grant  execute on function public.purge_inbound_email_raw(interval) to   service_role;
