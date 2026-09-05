-- ============================================================================
-- UsedCarsNZ · approve_draft(): close the fails-open authorisation gate
-- ----------------------------------------------------------------------------
-- T2 FINDING #1, recorded as a known hole in 20260707100400_ai_drafts_harden.sql
-- and tripwired (it.fails) in tests/db-invariants/ai-drafts-approval.test.ts.
--
-- The bug: for a DEALER-lane draft, ai_drafts.seller_user_id is always NULL
-- (it is populated only for private-seller listings). The guard read:
--
--   if not ( is_dealer_member(dealer_id)          -- false for a stranger
--            or seller_user_id = auth.uid()       -- NULL = uuid  ->  NULL
--            or is_admin() )                      -- false for a stranger
--
-- In SQL three-valued logic `false OR NULL OR false` is NULL, `NOT NULL` is
-- NULL, and plpgsql treats a NULL IF condition as false — so the RAISE was
-- skipped and the gate never fired. Because the function is SECURITY DEFINER,
-- the UPDATE beneath it then bypassed RLS and succeeded.
--
-- Practical exposure was limited: an attacker still needs the draft UUID, and
-- RLS on ai_drafts stops an unrelated user enumerating drafts. But the layer
-- built to be the authorisation boundary was contributing nothing, leaving the
-- human-approval guarantee — the core trust claim of the AI-reply feature —
-- resting entirely on ID secrecy.
--
-- The fix: coalesce the only term that can be NULL. is_dealer_member() and
-- is_admin() both return exists(...), which is never NULL, so this single
-- coalesce makes the whole predicate two-valued.
-- ============================================================================

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
    or coalesce(v_draft.seller_user_id = (select auth.uid()), false)
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
  'The only sanctioned path from ai_drafts.status=pending to approved. Authorizes against dealer_id/seller_user_id (NULL-safe), then atomically sets status/approved_by/approved_at AND appends the draft_approved lead_event.';

-- Unchanged from the original migration; restated so this file is complete on
-- its own. create or replace preserves existing grants, so these are no-ops on
-- an already-migrated database.
revoke all     on function public.approve_draft(uuid) from public;
grant  execute on function public.approve_draft(uuid) to authenticated;
