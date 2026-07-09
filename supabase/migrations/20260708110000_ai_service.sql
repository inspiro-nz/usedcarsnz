-- ============================================================================
-- UsedCarsNZ · WP-2 · Migration 14 · Bounded AI layer (strategy §7, §7.3)
-- ----------------------------------------------------------------------------
-- Additive only. `message_sender`/`public.messages` already exist as of
-- 20260707100000_lead_engine_enums.sql / 20260707100200_messages.sql — this
-- file must not redeclare them. Adds:
--   (a) dealers.approved_facts   — the ONLY generic facts Lane 1 may auto-send
--       (hours, address, viewing process). Free-text vehicle facts never live
--       here; they stay dealer-authored in Lane 2 drafts.
--   (b) messages.meta jsonb      — per-turn AI metadata (needs_dealer,
--       dealer_question, next_topic, guard_blocked, provider, model,
--       prompt_version). Lane 2's generate-draft.ts reads m.meta.dealer_question
--       to route buyer questions into the dealer draft, so this column is a
--       genuine cross-lane dependency, not vestigial.
--   (c) message_sender: add 'system' — the buyer thread UI (thread-chat.tsx)
--       already renders a sender === 'system' branch.
--   (d) ai_draft_status: add 'generation_failed' — generate-draft.ts's
--       safe-path fallback writes this status when structured generation
--       fails.
--   (e) AI generation provenance columns on ai_drafts.
-- ============================================================================

-- ---------- (a) dealer-approved generic facts ----------
alter table public.dealers
  add column if not exists approved_facts jsonb not null default '{}'::jsonb;
comment on column public.dealers.approved_facts is
  'Generic, dealer-curated facts Lane 1 may auto-send verbatim (hours, address, viewing_process). Shape: {hours?, address?, viewing_process?}. NEVER vehicle-specific — those are Lane 2 only (§7).';

-- ---------- (b) per-turn AI metadata on messages ----------
alter table public.messages
  add column if not exists meta jsonb not null default '{}'::jsonb;
comment on column public.messages.meta is
  'Per-turn AI metadata: {needs_dealer?, dealer_question?, next_topic?, guard_blocked?, prompt_version?, model?, provider?}. Never used for access control — display + Lane 2 routing only (generate-draft.ts reads dealer_question).';

-- ---------- (c) message_sender: add 'system' ----------
alter type public.message_sender add value if not exists 'system';

-- ---------- (d) ai_draft_status: add 'generation_failed' ----------
alter type public.ai_draft_status add value if not exists 'generation_failed';

-- ---------- (e) AI generation provenance on ai_drafts ----------
-- Existing 'pending' status already means "AI drafted, awaiting human
-- approval" (see migration 05 comment) — that IS the §7 draft state, so
-- generateDraft() writes status='pending', not a new redundant value.
alter table public.ai_drafts add column if not exists provider       text;
alter table public.ai_drafts add column if not exists model_id       text;
alter table public.ai_drafts add column if not exists prompt_version text;
comment on column public.ai_drafts.provider is 'AI adapter that produced draft_text: workers-ai | anthropic. NULL for template-only drafts (safe-path fallback).';
comment on column public.ai_drafts.prompt_version is 'Version tag of lib/ai/prompts/draft.v*.ts used to generate this draft.';
