-- ============================================================================
-- UsedCarsNZ · WP-1.1 · Migration 11 · messages (buyer/AI/dealer thread)
-- ----------------------------------------------------------------------------
-- The chat thread for a lead. Distinct from lead_events (which is the
-- immutable AUDIT log of what happened) and from ai_drafts (the pending/
-- approved staging area for a dealer reply) — messages is the actual
-- conversation content the buyer sees.
--
-- No INSERT/UPDATE/DELETE policy exists for anon/authenticated: every message
-- is written by the service_role backend, which is what makes "dealer free
-- text lands here only via the approved-draft send path" (this session's
-- compliance invariant) a DB-enforced fact rather than an app-code convention
-- — a client can never insert a sender='dealer' row directly, approved or not.
-- ============================================================================

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid not null references public.enquiries (id) on delete restrict,
  sender      public.message_sender not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
comment on table public.messages is
  'Buyer/AI/dealer chat thread for a lead. Written only by the service_role backend (no client INSERT policy) — dealer text reaches here only via the approved-draft send path.';

create index messages_enquiry_created_idx on public.messages (enquiry_id, created_at);

alter table public.messages enable row level security;

-- Visible to the dealer (member), the private seller, the signed-in buyer, or
-- admin — the same party set enquiries_select already trusts, joined through
-- enquiry_id since messages carries no denormalised dealer_id of its own.
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.enquiries e
      where e.id = messages.enquiry_id
        and (
          public.is_dealer_member(e.dealer_id)
          or e.seller_user_id = (select auth.uid())
          or e.buyer_user_id  = (select auth.uid())
        )
    )
    or public.is_admin()
  );

grant select on public.messages to authenticated;
grant all    on public.messages to service_role;
