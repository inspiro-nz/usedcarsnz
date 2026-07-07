-- ============================================================================
-- UsedCarsNZ · WP-1.1 · Migration 13 · ai_drafts: approval state machine
-- ----------------------------------------------------------------------------
-- ai_drafts and its broad `ai_drafts_update` RLS policy already exist
-- (20260621090400_leads.sql / 20260621090600_rls.sql) and are left in place —
-- a dealer may still edit `edited_text` directly. What was missing (this
-- session's compliance-envelope invariant, strategy §7): status/approved_by/
-- approved_at must change ONLY via a single atomic, audited path, never by a
-- bare column UPDATE, so "draft approved" and "the approval was logged" can
-- never drift apart.
--
-- Two mechanisms, belt and braces:
--   1. A CHECK constraint makes 'approved' without an approver impossible even
--      for the service_role backend or a future direct SQL statement.
--   2. Revoking table-level UPDATE from `authenticated` and re-granting it
--      column-scoped (edited_text only) means the ONLY way an authenticated
--      client can move status -> 'approved' is approve_draft(), which updates
--      the row AND appends the draft_approved lead_event in one statement.
-- ============================================================================

alter table public.ai_drafts
  add constraint ai_drafts_approved_requires_approver
  check (status <> 'approved' or (approved_by is not null and approved_at is not null));

-- Column-scoped UPDATE: authenticated may still edit their own draft text
-- directly (existing ai_drafts_update RLS policy still gates the row), but
-- status/approved_by/approved_at are no longer reachable via a bare UPDATE.
revoke update on public.ai_drafts from authenticated;
grant  update (edited_text) on public.ai_drafts to authenticated;

-- The sanctioned approval path. SECURITY DEFINER so it can call
-- log_lead_event() the same way enquiry_log_received() already does
-- (migration 06) — the nested call runs as this function's owner, which is
-- who log_lead_event's EXECUTE grant actually needs to trust, not the caller.
create or replace function public.approve_draft(p_draft_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_draft record;
begin
  select id, enquiry_id, dealer_id, seller_user_id, status
    into v_draft
    from public.ai_drafts
    where id = p_draft_id
    for update;

  if not found then
    raise exception 'approve_draft: unknown draft %', p_draft_id;
  end if;

  if not (
    public.is_dealer_member(v_draft.dealer_id)
    or v_draft.seller_user_id = (select auth.uid())
    or public.is_admin()
  ) then
    raise exception 'approve_draft: not authorized for draft %', p_draft_id
      using errcode = 'insufficient_privilege';
  end if;

  if v_draft.status <> 'pending' then
    raise exception 'approve_draft: draft % is % (must be pending)', p_draft_id, v_draft.status;
  end if;

  update public.ai_drafts
    set status      = 'approved',
        approved_by = (select auth.uid()),
        approved_at = now()
    where id = p_draft_id;

  perform public.log_lead_event(
    v_draft.enquiry_id,
    'draft_approved',
    'human',
    jsonb_build_object('draft_id', p_draft_id)
  );
end;
$$;
comment on function public.approve_draft(uuid) is
  'The only sanctioned path from ai_drafts.status=pending to approved. Authorizes against dealer_id/seller_user_id, then atomically sets status/approved_by/approved_at AND appends the draft_approved lead_event.';

revoke all     on function public.approve_draft(uuid) from public;
grant  execute on function public.approve_draft(uuid) to authenticated;
