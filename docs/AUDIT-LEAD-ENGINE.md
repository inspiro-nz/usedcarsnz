# Lead-engine audit (re-audit, supersedes prior version)

**Audited at:** commit `0f44419` (HEAD of `develop`), checked out on `feature/ai-service`, 2026-07-09.
**Method:** direct inspection of every file/migration named below, `git log`/`git diff`/`git rev-list` across all branches, and one read-only `tsc --noEmit` run. No files were modified. The previous `docs/AUDIT-LEAD-ENGINE.md` (references `runFirstTouch`, no `ai_drafts_harden`/`messages`/`dealer_aliases` awareness) is stale and is replaced by this file.

## Executive summary

1. **The working tree right now does not compile.** `feature/ai-service` is mid-`git stash pop` conflict (no `MERGE_HEAD` — this is a stash conflict, not a merge): `lib/env.ts`, `lib/db/types.ts`, `package.json` contain live `<<<<<<< Updated upstream` / `>>>>>>> Stashed changes` markers; `app/(marketplace)/cars/actions.ts` is "deleted by us" in the index but a real file sits on disk. `tsc --noEmit` fails immediately with `TS1185: Merge conflict marker encountered`.
2. **Schema (WP-1/WP-1.1) is genuinely solid and merged to `develop`**: `enquiries`, `ai_drafts` (+ `approve_draft()` RPC + CHECK constraint + column-scoped grants), `lead_events` (+ immutability trigger + REVOKE), `messages`, `dealer_aliases`, `email_outbox` all exist with real RLS.
3. **The `ai_service` migration (`20260708110000`) is broken and was never reconciled against schema merged two days earlier**: it re-`CREATE TYPE`s `message_sender` and re-`CREATE TABLE public.messages`, both of which already exist from `20260707100200_messages.sql`, and re-adds two `lead_event_type` enum values without `IF NOT EXISTS`. Applied in filename order, this migration **fails outright**.
4. **AI qualification chat is built but never wired in.** `lib/ai/provider.ts`, `guard.ts`, `schema.ts`, `structured.ts`, `prompts/qualify.v1.ts`, `generate-draft.ts` are all real, tested implementations. But `app/api/ai/chat/route.ts` imports `handleChatTurn` from `lib/ai/trigger.ts` — and `lib/ai/trigger.ts` on disk is still the one-function `enquiry-intake`-session stub (`triggerQualification` → `console.log`). `handleChatTurn` does not exist anywhere in the codebase except as a name under test in `lib/ai/trigger.test.ts`. **The chat route cannot run.**
5. **Dealer draft generation (Lane 2) is real and does call the AI stack** (`lib/ai/generate-draft.ts` → `provider.ts` → `structured.ts` → `guard`-adjacent schema validation), with a genuine safe-path fallback to the template composer on failure.
6. **The human-approval gate exists at the UI/action layer** (`ApproveDraftForm` → `approveDraftAction` → `lib/leads.ts`'s `approveAndSendDraft`) but **bypasses the DB's sanctioned `approve_draft()` RPC** added by the harden migration — it does a direct service-role `UPDATE`, skips the `'approved'` status entirely (jumps `pending` → `sent`), and no test exercises the gate.
7. **Email ingestion (`workers/email-inbound`) is completely absent** — no directory, no files, nothing. `/api/inbound/email` does not exist.
8. **Metrics/dashboard is partial**: `lib/metrics.ts` + `lib/funnel.ts` exist and are used by the dealer's own page; there is no `/api/metrics` route and no admin-wide dashboard.
9. **Every local feature branch is unmerged relative to `develop` except `feature/ai-service` itself** (which is fast-forwarded to `develop` but carries the broken stash on top). `feature/marketplace-integration`/`feature/landing-wedge-alignment` (8 commits ahead of develop) and `feature/lead-events-schema` (9 ahead) are stale duplicates already folded into `develop` via PR #13 — safe to delete, not "unmerged work" in the risky sense. `origin/main` has no real divergent content from `develop` (its "unique" commits are just merge-of-develop bookkeeping).
10. **Safest next action**: on `feature/ai-service`, resolve the three conflicted files by hand (do not blindly pick one side — `lib/env.ts`'s "Stashed changes" side drops `TURNSTILE_SECRET_KEY`, which is still required), restore/`git add` `app/(marketplace)/cars/actions.ts`, fix `20260708110000_ai_service.sql` to stop redeclaring `message_sender`/`messages`/existing enum values, and write `handleChatTurn` in `lib/ai/trigger.ts` before touching anything else — every AI-chat-dependent file is already waiting on it.

---

## 1. Branch map

Current branch: `feature/ai-service` (mid stash-pop conflict — see §9/§10 below for what that means concretely).

| Branch | Tip | Ahead / Behind `develop` | Merged to `develop`? |
|---|---|---|---|
| `develop` / `origin/develop` | `0f44419` (merge PR #14) | — | — |
| `feature/ai-service` (local only) | `0f44419` | 0 / 0 (commit-identical to develop; divergence is only in the **uncommitted** working tree/index) | Yes, by definition (same tip) |
| `feature/enquiry-intake` / `origin/…` | `da93418` | 1 / 0 | **No** — `develop` merged it via PR #14 (`0f44419`), but the branch ref itself wasn't fast-forwarded/deleted, so `git branch -a` still shows it 1 commit "ahead" of the pre-merge base. Content is in `develop`; safe to delete. |
| `feature/marketplace-integration` / `origin/…` | `f106ef0` | 8 / 0 | Content merged into `develop` via PR #13 (`f248004`); branch ref stale, safe to delete. |
| `feature/landing-wedge-alignment` (local only) | `f106ef0` | 8 / 0 | Same tip as `feature/marketplace-integration` — a duplicate local branch, same status. |
| `feature/lead-events-schema` / `origin/…` | `5d3ddc8` | 9 / 0 | Content merged (via `feature/marketplace-integration` → PR #11 → PR #13); branch ref stale, safe to delete. |
| `origin/main` | `cc1554b` | 6 / 2 | Not a feature branch — production-track branch. Its "2 ahead" commits (`cc1554b`, `94bfe1d`) are both `Merge pull request … from inspiro-nz/develop`, i.e. main merging develop into itself at two past points — no unique content, just merge-commit topology. No action needed. |
| `origin/cloudflare/workers-autoconfig` | `f6f00a2` | 25 / 0 | Old infra-setup branch, pre-dates the lead-engine work entirely (tip is from the original Cloudflare Workers scaffolding, itself already merged in the initial repo history). Stale; safe to delete once confirmed nothing sits on it. |
| `origin/feature/20260704-Backup` | `9219551` | 14 / 0 | Named as a backup snapshot; already an ancestor of `develop`'s current history (`9219551` = PR #5 "SupbaseCreate", visible in `develop`'s own `git log`). No unique unmerged content. |

**Flag — the only branch with real unmerged/at-risk work is the uncommitted state on `feature/ai-service` itself** (see §9), not any named branch. No branch other than that carries content `develop` doesn't already have.

---

## 2. Migrations

In apply order, `supabase/migrations/`:

1. `20260621090000_extensions.sql` (16 lines) — enables `pgcrypto`, `vector` extensions.
2. `20260621090100_enums.sql` (45 lines) — `user_role`, `dealer_status`, `seller_type`, `listing_status`, `fuel_type`, `transmission_type`, `enquiry_status`, `lead_actor`, `lead_event_type` (original 8 values), `ai_draft_status` (original 4 values).
3. `20260621090200_core_identity.sql` (66 lines) — `public.users`, `public.dealers`.
4. `20260621090300_listings.sql` (135 lines) — `public.listings`, `listing_photos`, `saved_listings`.
5. `20260621090400_leads.sql` (90 lines) — **CONFIRMED**: `public.enquiries` (buyer_name/email/phone, message, `qualification jsonb`, `status`), `public.ai_drafts` (draft_text/edited_text/status/approved_by/approved_at/sent_at), `public.lead_events` (append-only, `lead_id`/`dealer_id`/`listing_id`/`event_type`/`actor`/`occurred_at`/`recorded_at`/`payload`).
6. `20260621090500_functions_triggers.sql` (315 lines) — **CONFIRMED**: `prevent_mutation()` + `lead_events_no_update`/`_no_delete`/`_no_truncate` triggers (the immutability guard), `log_lead_event()` RPC with `REVOKE ALL ... FROM PUBLIC`, plus denormalisation triggers (`set_enquiry_denorm`, etc.).
7. `20260621090600_rls.sql` (234 lines) — RLS enable + policies across users/dealers/listings/enquiries/ai_drafts/lead_events.
8. `20260621090700_auth_user_sync.sql` (31 lines) — auth.users → public.users sync trigger.
9. `20260707100000_lead_engine_enums.sql` (46 lines) — additive only, all `IF NOT EXISTS`-guarded: `dealer_alias_source` enum, **`message_sender` enum `('buyer','ai','dealer')`**, `enquiry_source` enum, 6 new `lead_event_type` values (`ack_sent`, `ai_message_sent`, `buyer_message_received`, `qualification_updated`, `appointment_booked`, `lead_closed`).
10. `20260707100100_dealer_aliases.sql` (53 lines) — **CONFIRMED**: `public.dealer_aliases` (alias → dealer_id, admin-provisioned only, no dealer self-insert policy).
11. `20260707100200_messages.sql` (49 lines) — **CONFIRMED**: `public.messages` (`enquiry_id`, `sender message_sender`, `body`, `created_at`) — no client INSERT policy (service-role-only writes).
12. `20260707100300_enquiries_extend.sql` (34 lines) — **CONFIRMED**: adds `enquiries.source` (`enquiry_source`, default `platform_form`) and `enquiries.external_message_id` (text) + unique partial index `enquiries_external_message_id_key` for inbound-email dedupe.
13. `20260707100400_ai_drafts_harden.sql` (84 lines) — **CONFIRMED**: `ai_drafts_approved_requires_approver` CHECK constraint, `REVOKE UPDATE ... FROM authenticated` + column-scoped `GRANT UPDATE (edited_text)`, and `approve_draft(p_draft_id uuid)` SECURITY DEFINER function — the only sanctioned path to `status='approved'`, atomically logging `draft_approved`.
14. `20260708110000_ai_service.sql` (99 lines) — **BROKEN, see finding below.**
15. `20260709090000_email_outbox.sql` (37 lines) — **CONFIRMED**: `public.email_outbox` (ack-send retry queue; `sent_at IS NULL` = pending), service-role-only grants.

### Flagged: `20260708110000_ai_service.sql` duplicates schema from two days earlier

This migration was authored as if `messages`/`message_sender` didn't exist yet, but they were added by migrations 9 and 11 above (2026-07-07), a day before this one's timestamp:

- `create type public.message_sender as enum ('buyer', 'ai', 'dealer', 'system');` — **`message_sender` already exists** (migration 9). This statement fails: `type "message_sender" already exists`. (It also silently tries to widen the enum with `'system'`, which never happens because the statement never runs.)
- `create table public.messages (...)` with a **different shape** (adds `dealer_id`, `meta jsonb`) — **`public.messages` already exists** (migration 11) with a narrower shape (no `dealer_id`, no `meta`). This statement fails: `relation "messages" already exists`.
- `alter type public.lead_event_type add value 'ai_message_sent' after 'ai_first_response_sent';` and `... add value 'qualification_updated' after 'qualification_completed';` — **both values already exist**, added with `IF NOT EXISTS` by migration 9. Without `IF NOT EXISTS` here, these fail: `enum label "ai_message_sent" already exists`.

Applied in filename order against a database that already has migrations 9–11 (i.e. any database that reflects current `develop`), **this migration cannot complete**. The only parts of it that are net-new and non-conflicting are `dealers.approved_facts` (jsonb) and `ai_drafts.provider`/`model_id`/`prompt_version` (text columns) — those alone are salvageable; the rest needs to be deleted or rewritten as an `ALTER TABLE public.messages ADD COLUMN dealer_id ...` / `ADD COLUMN meta ...` against the existing table.

No duplicate **timestamps** exist — all 15 filenames are unique — but #14 is a duplicate/conflicting migration in content, per §10 of the brief.

`lib/db/types.ts`'s unresolved merge conflict (see §9) is a direct symptom of this: one side of the conflict has the original narrow `MessageSender = "buyer" | "ai" | "dealer"` (matching migration 9/11 truth), the other has `"buyer" | "ai" | "dealer" | "system"` (matching the broken migration 14). Neither side has been reconciled with which migration actually ran.

---

## 3. Routes

All files under `app/`:

**Frozen (Founding Dealer landing) — see §9 for integrity check:**
- `app/page.tsx`, `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`
- `app/api/lead/route.ts`

**`app/(marketplace)` route group:**
- `(auth)/`: `actions.ts`, `auth-form.tsx`, `forgot-password/`, `reset-password/`, `sign-in/`, `sign-up/`
- `account/`: `actions.ts`, `delete-account-form.tsx`, `page.tsx`
- `admin/`: `actions.ts`, `page.tsx` — dealer-approval queue, implemented (reads `dealers`, filters `status='pending'`)
- `cars/`: `[make]/[model]/[year]/[id]/page.tsx`, `actions.ts` (⚠ **currently a live merge conflict, "deleted by us" in the index** — see §9), `enquiry-form-client.tsx`, `enquiry-form.tsx`, `page.tsx`
- `dealer/`: `actions.ts`, `leads/[id]/approve-form.tsx` + `page.tsx`, `leads/page.tsx`, `listings/new/new-form.tsx` + `page.tsx`, `listings/page.tsx`, `page.tsx`
- `register-dealer/`: `actions.ts`, `page.tsx`, `register-form.tsx`
- `thread/[id]/`: `page.tsx`, `thread-chat.tsx` (198 lines, untracked — the buyer-facing chat UI that calls `POST /api/ai/chat`)
- `layout.tsx`

**`app/api`:**
- `app/api/enquiries/route.ts` — **CONFIRMED, complete.** Validates via zod, honeypot, rate-limit, Turnstile, inserts `enquiries` with `source: "platform_form"`, sends a **templated** (no LLM) ack synchronously via `buildAckEmail`/`sendEmail`, falls back to `email_outbox` on send failure, emits `ack_sent`, then `ctx.waitUntil(triggerQualification(...))`. Has a test (`route.test.ts`).
- `app/api/ai/chat/route.ts` — **exists but cannot run.** Imports `handleChatTurn` from `@/lib/ai/trigger`, which is not exported by the file on disk (§4, §10). SSE streaming scaffold, rate-limiting, and enquiry-existence check are all correctly implemented around a call that will throw `undefined is not a function` the moment it's invoked.
- `app/auth/callback/route.ts` — Supabase auth callback, unrelated to lead engine.

**Confirmed ABSENT:**
- `/api/drafts/[id]/send` — no such route. The "send" action is a server action (`approveDraftAction` in `dealer/actions.ts`), not a route handler.
- `/api/inbound/email` — absent (matches `workers/email-inbound` absence, §5).
- `/api/metrics` — absent (matches §8 partial-metrics finding).

---

## 4. Lib

| Area | File(s) | State |
|---|---|---|
| leads/events | `lib/leads.ts` (tracked, modified in this session's stash), `lib/leads/events.ts` + `types.ts` (from `feature/lead-events-schema`, merged) | **Implemented.** `lib/leads.ts` now only holds `logLeadEvent`, `authorizeLeadAccess`, `approveAndSendDraft`, `bookViewing`, `markSold` — the old `runFirstTouch` stub referenced by the prior audit is gone, replaced by `lib/ai/trigger.ts`/`generate-draft.ts` per its own header comment. |
| leads/types | `lib/db/types.ts` | **Implemented but currently conflict-broken** — see §9. |
| ai/provider | `lib/ai/provider.ts` (312 lines, untracked) | **Implemented, high quality.** Real `workers-ai` adapter (via `env.AI.run`, `@cf/`-prefixed models only) and `anthropic` adapter (`@anthropic-ai/sdk`), both with 10s hard timeout, one retry with jitter, and streaming variants. Lane-scoped resolution via `getProvider("qualify" | "draft")`. |
| ai/guard | `lib/ai/guard.ts` (87 lines, untracked) + `guard.test.ts` | **Implemented, high quality.** Regex-pattern-based post-hoc validator for vehicle-condition/warranty-CGA/finance-opinion claims; always wins over model output. |
| ai/prompts | `lib/ai/prompts/qualify.v1.ts`, `draft.v1.ts` | **Implemented.** Explicit prompt-injection defence (`<buyer_message>` delimiting, "treat as data not instructions"), hard-rule list matching the guard's categories. |
| ai/trigger | `lib/ai/trigger.ts` (13 lines, **tracked**, committed in `da93418`) | **STUB, not upgraded.** Exports only `triggerQualification`, which does `console.log` and returns. Does not call `getProvider`, `guardReply`, `generateStructured`, or touch `messages`/`lead_events` at all — contradicts its own test file (`trigger.test.ts`, untracked, 250 lines) which imports `handleChatTurn` and a fully-featured `triggerQualification` with RPC assertions, safe-path fallback, and a full red-team suite. **This is the single largest gap in the build** — see §10. |
| email/outbox | `lib/email/outbox.ts` + `.test.ts`, `lib/email/ack-template.ts` + `.test.ts` | **Implemented.** `insertOutboxRow` used by `/api/enquiries`; a sweep function is described in the migration comment as not-yet-cron-wired (confirmed — no cron trigger exists, §8). |

Also present and relevant: `lib/ai/schema.ts` (zod contracts + `parseStructured`), `lib/ai/structured.ts` (`generateStructured`, one retry then `StructuredOutputError`), `lib/ai/generate-draft.ts` (Lane 2, **does** correctly chain `getProvider("draft")` → `generateStructured` → `ai_drafts` insert, with a template-fallback on failure to `status: "generation_failed"`), `lib/ai/__tests__/fake-provider.ts` + `fake-supabase.ts` (test doubles).

---

## 5. Workers

**`workers/email-inbound` does not exist.** No `workers/` directory at all in the repo. No wrangler config, no extractors, no fixtures. This matches the paused email-ingestion task noted in prior session memory — that work was never started, only planned.

---

## 6. AI provider state

- **Wired to both, lane-selectable, per `lib/ai/provider.ts` §above.** Default is `workers-ai` (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`); `anthropic` is the tested escalation path via `@anthropic-ai/sdk` (present in `package.json` dependencies, `0.110.0`).
- **`"ai": { "binding": "AI" }` is present in `wrangler.jsonc`** — but only as an **uncommitted, currently-staged addition** from the stash pop (`git diff HEAD -- wrangler.jsonc` shows it as a pending 3-line addition, not yet part of any commit). If the stash conflict is resolved by discarding "theirs," this binding disappears and every `workers-ai` call throws `"The AI binding is not available..."` at runtime.
- Env vars governing it (per `lib/env.ts`'s **conflicted, unresolved** server schema — "Stashed changes" side, the one that actually declares them): `AI_PROVIDER_QUALIFY`, `AI_PROVIDER_DRAFT` (`"workers-ai" | "anthropic"`, default `workers-ai`), `AI_MODEL_QUALIFY`, `AI_MODEL_DRAFT` (default both `@cf/meta/llama-3.3-70b-instruct-fp8-fast`), `ANTHROPIC_API_KEY`.
- `OPENAI_API_KEY` also exists in the env schema (both conflict sides) and in `.env.example`, but is **dead** — nothing in `lib/ai/*` references OpenAI; `lib/ai/drafts.ts`'s header comment says it was reserved for "an LLM provider can replace draftDealerReply later," which has since been superseded by the workers-ai/anthropic `provider.ts` design. Vestigial, safe to remove once confirmed.
- None of this is in `.env.example` yet (§8).

---

## 7. Tests

**Vitest is present and configured** (`vitest.config.ts`, `vitest.setup.ts`, `"test": "vitest run"` in `package.json`, `vitest: ^4.1.10`).

Test files (11 total):
- `app/api/enquiries/route.test.ts`
- `lib/ai/generate-draft.test.ts`
- `lib/ai/guard.test.ts` — direct unit tests of the pattern-matcher.
- `lib/ai/prompts.test.ts`
- `lib/ai/schema.test.ts`
- `lib/ai/trigger.test.ts` — **the red-team/guard integration suite** (7 scenarios under `describe.each(BOTH_ADAPTERS)`: "new tyres" claim, warranty/CGA claim, compliant finance deferral, non-compliant finance opinion, direct jailbreak attempt, quoted-injection-as-data, qualification-field capture) plus 3 more for `triggerQualification`'s safe-path fallback. **This is a real, well-designed red-team/guard suite** — but it currently cannot pass, because it imports `handleChatTurn` from a file that doesn't export it (§4, §10). Confirmed by the plain fact that `lib/ai/trigger.ts` has exactly one `export` statement (`grep -n "export" lib/ai/trigger.ts`).
- `lib/email/ack-template.test.ts`, `lib/email/outbox.test.ts`
- `lib/leads/events.test.ts`
- `lib/sanitize.test.ts`, `lib/turnstile.test.ts`

**No test asserts the approve-gate directly** (`grep` for `approveAndSendDraft` across every `*.test.ts` returns nothing). The closest thing — DB-level enforcement via the CHECK constraint and column-scoped grant in migration 13 — has no corresponding app-level test either. Given `approveAndSendDraft` doesn't call `approve_draft()` at all (§10), a test asserting "an unsent draft cannot be sent except through approval" doesn't exist and, if written against current code, would only be testing the `status !== 'pending'` guard inside `lib/leads.ts` itself, not the DB invariant.

---

## 8. Env + Wrangler

**Env vars referenced in code**, cross-checked against where each is expected:

| Var | Referenced in | In `.env.example`? | In `wrangler.jsonc` vars? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `lib/env.ts` | Yes | No (Next.js env, not Worker binding) |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_ENV` | `lib/env.ts` | Yes | No |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `lib/env.ts`, `components/PilotFormClient.tsx`, enquiry form | Yes | No |
| `SUPABASE_SECRET_KEY` | `lib/env.ts`, `lib/supabase/service.ts` | Yes (blank) | No |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LEAD_EMAIL` | `app/api/lead/route.ts` (direct `process.env`, by design — frozen route is deliberately not routed through `lib/env.ts`), `lib/email.ts` | Yes | No |
| `TURNSTILE_SECRET_KEY` | `lib/turnstile.ts` (and `app/api/lead/route.ts` directly) | Yes | No |
| `OPENAI_API_KEY` | `lib/env.ts` only (dead, §6) | Yes | No |
| `AI_PROVIDER_QUALIFY`, `AI_PROVIDER_DRAFT`, `AI_MODEL_QUALIFY`, `AI_MODEL_DRAFT`, `ANTHROPIC_API_KEY` | `lib/env.ts` (conflicted, "Stashed changes" side only), `lib/ai/provider.ts` | **No — missing from `.env.example`** | No |
| `SKIP_ENV_VALIDATION` | `lib/env.ts` | Not applicable (dev escape hatch) | No |

- **`.dev.vars` does not exist** — no local Cloudflare Worker secrets file.
- **No cron triggers** in `wrangler.jsonc` (confirmed by reading the full file — only `main`, `name`, `compatibility_date`/`flags`, `assets`, `services`, `images`, `ai` binding (uncommitted, §6), `observability`). The `email_outbox` sweep function's cron wiring is explicitly deferred per its own migration comment ("wiring the actual cron trigger is a later session") — consistent with what's on disk.
- **Supabase link status**: `supabase/config.toml` exists and is a **local-only** dev config ("Dev, demo, and production are separate hosted projects, each linked by its own project ref" — no project ref for a linked remote is committed here, which is correct/expected for a repo). `.env.example`'s Supabase URL (`geappcqiihbgihcsitkj.supabase.co`) indicates the intended prod project is known, but no `supabase link` state is detectable from the repo alone.
- `supabase/seed/seed.sql` exists (referenced by `config.toml`'s `[db.seed]`) alongside `supabase/seed/README.md`, which documents policy (dev/demo only, never prod) — the README says "Demo seed content lands with the schema work package" and is written as if still pending, but `seed.sql` itself now exists as a file; its actual content wasn't graded here beyond confirming it's non-empty on disk — worth a follow-up look before calling "demo seed" fully done.

---

## 9. Frozen-path integrity

| Path | Earliest commit | Diff since then | Verdict |
|---|---|---|---|
| `app/page.tsx` | `e8f54dd` / `f077609` (initial landing MVP) | **No diff.** | **CONFIRMED intact.** |
| `app/api/lead/route.ts` | `064a8cb` (last of the original hardening commits) | **Modified.** Removed `export const runtime = 'nodejs'`, removed an unused `EnquiryOption` type, trimmed two comments, reordered two `const` declarations. No security-relevant logic changed, but **`export const runtime = 'nodejs'` was removed**, which is a behavior-relevant change (governs whether this route runs on the Node.js runtime vs. the default edge/Workers runtime under `@opennextjs/cloudflare` — worth confirming this was intentional, since the route's rate-limiting is in-memory-per-process and runtime choice affects instance lifetime). | **PARTIAL — technically violates "frozen," low security impact but not zero.** |
| `lib/security.ts` | `93b007e` (the commit that created it) | **No diff** — only one commit in its entire `git log` touches it. | **CONFIRMED intact** (it was never "pre-marketplace" so "frozen since creation" is the correct bar, and it holds). |

Additionally, `components/PilotFormClient.tsx` — part of the landing page's form UI, imported by the frozen route group though not itself one of the three named frozen paths — has an **uncommitted, currently-staged** one-line change (typing `response.json()` as `{ error?: string }`). Cosmetic/type-safety only, but flagging since it's adjacent to frozen scope and mid-conflict-resolution.

---

## 10. Out-of-order damage assessment

Given the intended dependency order (schema → intake → AI → inbox → email → metrics → hardening), concrete instances of later work outrunning its foundation, or foundation work outrunning consumers:

1. **`lib/ai/trigger.ts` was never upgraded — the single biggest break.** `feature/enquiry-intake` (2026-07-08, `da93418`) shipped `trigger.ts` as an intentional stub with a comment saying "a later session (ai-service) replaces this with the real Lane 1 qualification turn." The `ai-service` session then built every *other* piece that stub was supposed to be replaced by — `provider.ts`, `guard.ts`, `schema.ts`, `structured.ts`, `prompts/qualify.v1.ts`, and a 250-line test suite asserting `handleChatTurn`'s behavior — but the actual edit to `trigger.ts` itself is missing. `app/api/ai/chat/route.ts` and `lib/ai/trigger.test.ts` both already assume it happened. This is a stub that was supposed to be replaced but wasn't, exactly per the brief's example.

2. **`20260708110000_ai_service.sql` was authored against a foundation that had already moved.** It redeclares `message_sender` and `public.messages`, both added a day earlier by `20260707100000`/`20260707100200` (part of `feature/lead-events-schema`, merged via PR #11 → #13 well before the ai-service session started). Whoever wrote migration 14 was evidently working from an older mental model of the schema (or an older branch state) than what had already landed on `develop`. Concretely fails to apply in sequence (§2).

3. **`lib/db/types.ts`'s merge conflict is the direct fossil of finding #2.** One side (`AiDraftStatus`/`MessageSender` without `'system'`, no `DealerAliasSource`/`EnquirySource`) reflects the schema as of `feature/marketplace-integration`'s merge; the other (`'system'` added to `MessageSender`, `'generation_failed'` added to `AiDraftStatus`) reflects what `20260708110000` *intended* to add, whether or not the migration can actually run. Neither side is simply "newer" — they need to be manually reconciled against **which migration actually executed**, not against stash-vs-upstream chronology.

4. **`approveAndSendDraft` (`lib/leads.ts`) predates and now bypasses `approve_draft()` (migration 13).** `lib/leads.ts` was last touched in the *current uncommitted stash* (per `git diff --stat`, 99 lines removed — consistent with the file being pared down when `logLeadEvent`/`authorizeLeadAccess` etc. were split out), but its `approveAndSendDraft` function still does a raw `svc.from("ai_drafts").update({...})` via the service-role client, sets `status` straight from `'pending'` to `'sent'` (skipping the `'approved'` intermediate state entirely), and manually re-implements the audit logging (`draft_approved` then `reply_sent`) that `approve_draft()` does atomically in one statement. It still *works* today only because `service_role` bypasses the column-scoped grant migration 13 introduced for `authenticated` — but the RPC that migration 13's own comment calls "the ONLY way an authenticated client can move status → approved" is never called by any code path in the app. Two competing implementations of the same invariant, one of which (the DB one) is currently dead code from the app's perspective.

5. **`app/(marketplace)/cars/actions.ts` is a genuine merge collision between two lineages of the same feature.** `develop`'s history deleted this file when `feature/enquiry-intake` replaced the client-form-action pattern with `POST /api/enquiries` (`da93418`). The stash being popped on `feature/ai-service` still carries a version of this file (functionally identical to the pre-deletion version — `diff` against the stash's copy shows the on-disk file and the stash's stage-3 blob are byte-identical) calling `triggerQualification` directly. This isn't new damage so much as unresolved topology: the two branches solved "how does an enquiry get created" two different ways, and the conflict machinery is correctly flagging it — but it's currently sitting unresolved in the actual working tree, not just in history.

6. **No branch-merge conflict is coming on `enquiries`/`lead_events` beyond what's already resolved.** All the schema/event-log work for those two tables funneled through one lineage (`lead-events-schema` → `marketplace-integration` → `develop`) rather than two parallel branches touching them independently, so — aside from the migration-14 collision above — there's no *additional* looming conflict there.

7. **Metrics (§8) and demo seed (§8) are the only work-plan items that are simply behind schedule rather than actively broken** — nothing consumes a metrics API that doesn't exist yet, and nothing depends on the seed being populated to function.
