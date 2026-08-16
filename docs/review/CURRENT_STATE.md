# UsedCarsNZ — Current State Audit

**Date:** 2026-08-16
**Method:** Static read-only review of the repository at `c:\Development-Git\usedcarsnz` (branch `develop`, HEAD `86edbf7`). No code, migrations, or dependencies were changed to produce this document.

## Open questions / assumptions

These are flagged up front rather than left buried, per the brief's instruction to proceed on stated assumptions rather than stall.

1. **OTP-verified enquiry forms and proxy phone numbers are described in the strategic brief as existing attribution machinery, but no such code exists anywhere in the repository.** Enquiry bot-defence is Cloudflare Turnstile (`lib/turnstile.ts`), not OTP; buyer/dealer phone numbers are stored and rendered in plain text. **Assumption: these are aspirational/planned, not built.** Treated as absent throughout this document.
2. **Dealer inventory feed ingestion (the "supply" pillar) does not exist in code at all** — not prototype, not stub, genuinely absent. The one first-party breadcrumb is a line of UI copy on the new-listing form promising a future "Motorcentral / CSV pipeline." **Assumption: this is the single largest gap and is treated as such throughout.**
3. **`docs/AUDIT-LEAD-ENGINE.md`** (dated 2026-07-09) describes a broken mid-stash-conflict working tree and a broken `ai_service` migration. The migration on disk today (`supabase/migrations/20260708110000_ai_service.sql`) is clean and uses defensive `IF NOT EXISTS` guards throughout. **Assumption: that audit is a superseded historical snapshot, not current state**, and is disregarded below.
4. Whether `ci.yml` and `e2e.yml` are configured as *required* GitHub branch-protection checks on `develop` cannot be determined from files in the repo (branch protection is a GitHub settings artefact, not a repo file). **Assumption: treated as advisory unless the founder confirms otherwise.**
5. The untracked directory `app/(marketplace)/dealers/` and the four modified files in the working tree (`git status` at session start) are a new **dealer public storefront page** already substantially built but uncommitted. Treated below as in-progress current-state, not hypothetical.

---

## 1. Stack and structure

- **Framework:** Next.js `16.2.7` on React `19.2.4`, App Router only (`package.json`). `AGENTS.md` warns this Next.js version has training-data-breaking changes; verified against `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. The changes that actually bite in this repo:
  - `middleware.ts` → `proxy.ts` rename is in Next 16, but `proxy.ts` is forced onto the Node runtime, which `@opennextjs/cloudflare` v1.19 rejects (it needs edge middleware). The repo deliberately keeps the deprecated `middleware.ts` filename — a comment in the file explains why.
  - Synchronous access to `cookies`/`headers`/route `params` is fully removed (not just deprecated) — this is the kind of thing an LLM trained on older Next.js would get wrong by default.
  - `next lint` is removed; `package.json`'s `"lint"` script already calls `eslint` directly.
- **Backend:** No ORM. Raw `@supabase/supabase-js` (`^2.110.0`) + `@supabase/ssr` (`^0.12.0`) against hand-written types in `lib/db/types.ts`. No Supabase Edge Functions exist (`supabase/functions/` does not exist) — all server logic is Next.js Route Handlers (`app/api/*`) deployed to Cloudflare via `@opennextjs/cloudflare` (`^1.19.11`).
- **AI:** `@anthropic-ai/sdk` (`0.110.0`) as a tested escalation path, with Cloudflare Workers AI as the default provider (`lib/ai/provider.ts`).
- **Email:** `resend` for outbound, `postal-mime` for inbound parsing.
- **Rendering:** almost entirely `export const dynamic = "force-dynamic"` (SSR on every request) — confirmed on 16+ routes including the whole `dealer/*`, `admin`, `cars`, `home`, `metrics`, and cron API routes. The **only** cached route in the app is the listing detail page, `app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx`, which uses `revalidate = 300` (ISR) with `generateStaticParams() => []` (nothing pre-rendered at build; populated on-demand) and on-demand invalidation via `revalidatePath` calls in `app/(marketplace)/dealer/actions.ts` and `app/(marketplace)/admin/actions.ts`. This is the **only** `generateStaticParams` call in the codebase.
  - **Known unresolved bug:** under a production server build, this ISR page 500s ("Page changed from static to dynamic at runtime, reason: cookies") because the shared `MarketplaceHeader` in `components/marketplace/chrome.tsx` reads auth cookies via `lib/auth.ts`. Because of this, `.github/workflows/e2e.yml` and `playwright.config.ts` deliberately run E2E against `next dev`, not a production build — **ISR is not verified to work in production**, only in dev mode.
  - No `runtime = "edge"` exports anywhere; no `loading.tsx`/`error.tsx`/`not-found.tsx` files exist except three narrow `loading.tsx` under `cars/` and `dealer/`.
- **Hosting/deploy pipeline:**
  - `wrangler.jsonc` — production is the **default/top-level config** (worker `usedcarsnz`), deployed only manually via `npm run deploy`. There is no CI job that deploys production.
  - `env.demo` block in the same file — worker `usedcarsnz-demo`, its own domain (`demo.usedcarsnz.co.nz`), and its own copy of every binding (comment notes Wrangler does not inherit bindings into named environments).
  - Four GitHub Actions workflows, no more, no less: `ci.yml` (typecheck/lint/unit-test/build on every push and PR into `develop`), `e2e.yml` (PR-into-`develop` only — boots an ephemeral Supabase stack, runs DB-invariant/RLS tests and the full Playwright suite), `deploy-demo.yml` (push to `demo` branch — deploys the app plus all four standalone Workers to the demo environment only), `promote-demo.yml` (manual-dispatch — force-pushes `develop` onto `demo`, then explicitly re-dispatches `deploy-demo.yml` since a bot-token push won't self-trigger).
- **Standalone Cloudflare Workers** (outside the Next.js app, each with its own `wrangler.jsonc`) under `workers/`: `email-inbound` (Email Routing handler, no cron), `keepalive` (daily cron, demo-only, stops the free-tier Supabase project pausing), `outbox-sweep` (every-15-min cron, drains the ack-email retry queue), `raw-email-purge` (daily cron, purges raw inbound MIME after 30 days). All four exist because the OpenNext app worker exports only `fetch`, not `scheduled` — consistent with the prior "keep-alive must be standalone" finding in project memory.
- **Repo layout:** `app/` (App Router — landing page at root, `app/api/*` route handlers, `app/(marketplace)/*` for the actual product), `components/` (landing-page components + `components/marketplace/`), `lib/` (domain logic: `ai/`, `cron/`, `db/`, `email/`, `enquiries/`, `inbound/`, `leads/`, `supabase/`, plus `auth.ts`, `metrics*.ts`), `supabase/` (`migrations/`, `seed/`), `workers/` (the four standalone Workers), `scripts/` (demo seed/reset, E2E user setup), `docs/` (strategy, architecture, runbooks, audits), `prompts/` (the authored AI-build-package prompts — `PROMPT-9`, `PROMPT-T1/T2/T3`), `e2e/` (Playwright specs), `tests/` (Vitest DB-invariant/RLS tests requiring a live stack).
- **CI gate:** `ci.yml` runs `tsc --noEmit` → `eslint` → `vitest run` (unit) → `next build`, on every push and PR into `develop`. E2E (Playwright + DB-invariant suite) is a separate workflow, PR-only, deliberately excluded from `ci.yml` because it needs a live Supabase stack.
- **Leftover artefacts at repo root** worth a housekeeping pass: `marketplace-integration.patch`, `pre-recovery-staged.patch`, `pre-recovery-status.txt`, `pre-recovery-unstaged.patch` — look like debris from a past git-recovery incident, not part of the working app.

## 2. Data model

Postgres 17 (`supabase/config.toml`). 20 migrations, `supabase/migrations/20260621090000_*` → `20260711100000_keepalive.sql`, spanning 7 commits from 2026-07-04 to 2026-07-12. No `database.types.ts`/generated schema file exists — this table was built by reading every migration directly.

**Tables (11, all with RLS enabled — none found with RLS disabled):**

| Table | Purpose | RLS |
|---|---|---|
| `users` | Profile extending `auth.users`, role (buyer/dealer/staff/admin) | Enabled, 4 policies |
| `dealers` | Dealer business entity, NZBN, approval state | Enabled, 4 policies |
| `staff_accounts` | Dealer sub-accounts | Enabled, 4 policies |
| `listings` | Vehicle listings, dealer-or-private ownership | Enabled, 4 policies |
| `listing_photos` | Up to 20 photos/listing | Enabled, 4 policies |
| `saved_listings` | Buyer-saved listings | Enabled, 1 policy |
| `enquiries` | The lead itself; `listing_id` nullable since `20260710090000_enquiries_email_lane.sql` to support listing-less email leads | Enabled, 4 policies |
| `ai_drafts` | AI-drafted dealer reply pending human approval | Enabled, 4 policies |
| `lead_events` | Append-only, immutable funnel/audit log — sole source of every conversion metric | Enabled, SELECT-only; writes only via `log_lead_event()` SECURITY DEFINER RPC (client EXECUTE revoked); mutation additionally blocked for **every role including owner** by a `prevent_mutation()` trigger |
| `dealer_aliases` | Inbound-email local-part → `dealer_id` routing, admin-provisioned only | Enabled, 4 policies (broad table GRANT to `authenticated`, but write policies require `is_admin()` — RLS is the real gate) |
| `messages` | Buyer/AI/dealer chat thread | Enabled, SELECT-only; no client INSERT |
| `email_outbox` | Resend-failure retry queue | Enabled, **zero policies** (locked to `service_role` only — correct, not a gap) |
| `keepalive_ping` | Demo-only cron ping | Enabled, **zero policies** (same pattern) |

**Views (all in `20260711090000_metrics_views.sql`):** `metrics_lead_facts`, `metrics_dealer`, `metrics_first_response_30d_dealer`, `metrics_time_on_market_dealer`, `metrics_enquiries_per_listing_dealer` — all `security_invoker = on` (RLS on `lead_events` scopes them per dealer), granted to `authenticated, service_role` only. `metrics_platform` is the deliberate exception: `security_invoker = off` so it can aggregate across all dealers, exposes no `lead_id`/`dealer_id`, and is granted to `anon` — this is the public "proof" number surfaced on `/metrics`.

**Functions:** four RLS-predicate helpers (`is_admin`, `is_dealer_member`, `is_dealer_owner`, `is_listing_owner`) are `SECURITY DEFINER` with `search_path=''`, read-only, and safe. `log_lead_event()` is the sole sanctioned write path into `lead_events`, `SECURITY DEFINER`, `EXECUTE` revoked from `PUBLIC` and granted only to `service_role`. `handle_new_user()` hardcodes new signups to `role='buyer'` regardless of client input — correct. `purge_inbound_email_raw()` is `service_role`-only.

**Security finding — `approve_draft()` fails open (still live, unfixed):** `supabase/migrations/20260707100400_ai_drafts_harden.sql:53-60`. For dealer-lane drafts, `seller_user_id` is always `NULL`; the authorisation check is `not (is_dealer_member(...) or seller_user_id = auth.uid() or is_admin())`. `NULL = auth.uid()` is SQL `NULL`, so the whole `OR` chain evaluates to `NULL`, and `if not (NULL)` is treated as false in plpgsql — the `RAISE EXCEPTION` is silently skipped. **Any authenticated user can currently call `approve_draft()` on any dealer's pending draft**, forging `approved_by` and a `draft_approved` event. This is a **known, deliberately unfixed** finding — it's tracked as an expected-red tripwire test (`tests/db-invariants/ai-drafts-approval.test.ts:94-126`, labelled "KNOWN HOLE — T2 FINDING #1 (founder decision; do not fix in this package)") and documented in `docs/testing.md:144-150` and `prompts/PROMPT-T2.md:17-19,53`. This document does not fix it (per the read-only brief) but flags it as the standout live security item requiring a founder decision.
- No other RLS bypass, exposed public bucket, or unverified server endpoint was found. Storage: one bucket, `inbound-email-raw`, explicitly `public = false`. Cron endpoints and the inbound-email endpoint both fail **closed** (503) if their shared secrets are unset. `supabaseService()` (the only place the service-role key is instantiated) is marked `import "server-only"` and throws if the key is missing; no hardcoded service-role key was found in any client-reachable file.

## 3. Feature inventory against the strategic pillars

### Feed ingestion / listing pipeline — **Absent**
No CSV/XML/JSON feed parser, no DMS connector, no scheduled sync, no admin bulk-upload UI exists anywhere. Listing creation is entirely manual, one row at a time, via `app/(marketplace)/dealer/listings/new/new-form.tsx` → `createListingAction` in `app/(marketplace)/dealer/actions.ts`. The form's own copy admits the gap: *"Photos and bulk import arrive with the Motorcentral / CSV pipeline"* (`app/(marketplace)/dealer/listings/new/page.tsx:19`). The only "ingestion" pipeline in the repo (`workers/email-inbound/`, `lib/inbound/ingest.ts`) ingests forwarded **Trade Me lead-notification emails**, not inventory — that's a lead-capture feature, not supply.

### Listing display UI — **Working, but off-strategy in shape**
A fully wired, classic destination-marketplace browse/search/filter surface: `app/(marketplace)/cars/page.tsx` (server-rendered facet filters: keyword, make, dealer, price, year, fuel, transmission), listing detail at `app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx` (the one ISR page, with JSON-LD), and a new (uncommitted) dealer storefront page `app/(marketplace)/dealers/[id]/page.tsx`. `components/marketplace/listing-card.tsx` renders a make/model monogram plate — there is no photo display pipeline yet despite `listing_photos` existing in the schema. Test coverage is smoke-level only (`e2e/marketplace.spec.ts`, 2 tests).

### Lead capture and attribution — **Working, best-tested part of the codebase**
Enquiry form with Cloudflare Turnstile + honeypot (`lib/turnstile.ts`, `app/(marketplace)/cars/enquiry-form-client.tsx`, `app/api/enquiries/route.ts` — rate-limited, fails closed on missing Turnstile secret in production). Email-lead ingestion from forwarded Trade Me emails is fully wired with HMAC verification (`lib/inbound/verify.ts`), dedup on `external_message_id`, alias-resolved `dealer_id` (`dealer_aliases` table), and raw-MIME retention/purge. Append-only `lead_events` audit trail underlies the dealer leads inbox (`app/(marketplace)/dealer/leads/[id]/page.tsx`), a human-approval gate before any AI-drafted reply is sent (`lib/leads.ts`, DB-enforced via `approve_draft()`), and a buyer-facing chat thread (`app/(marketplace)/thread/[id]/page.tsx`). Test coverage is genuinely strong: unit tests across `lib/inbound/*`, `lib/leads*`, `lib/email/*`, DB-invariant tests for immutability and the RLS deny-matrix, and a 222-line E2E "money-shot" journey test.
**Gap:** the brief's described attribution machinery — **OTP-verified enquiry forms and proxy phone numbers** — does not exist in code. Bot defence is Turnstile, not OTP; phone numbers are plain text, not proxied or call-logged.

### Dealer-facing tooling / dashboards — **Working (lead ops), Absent (AI content/pricing tools)**
Dealer dashboard (`app/(marketplace)/dealer/page.tsx`), conversion-metrics dashboard with CSV export (`app/(marketplace)/dealer/metrics/page.tsx`, `lib/metrics-views.ts`), admin dealer-approval queue (`app/(marketplace)/admin/`). AI capability that exists is **buyer-qualification chat + dealer-reply drafting** (`lib/ai/trigger.ts`, `lib/ai/generate-draft.ts`, `lib/ai/guard.ts`), always human-approval-gated before sending — well tested. **AI-written listing generation and price-positioning reports, both named in the revenue-sequence strategy as the first SaaS product, do not exist anywhere in code** — strategy-document content only.

### SEO/AEO surface — **Prototype, generic not AEO-tuned**
`app/robots.ts` is a single wildcard rule (`allow: "/"`, disallow `/dealer` and `/admin`) — **no explicit GPTBot/ClaudeBot/PerplexityBot allow entries exist anywhere in the repo**, despite this being named as a specific strategic requirement. The generic wildcard likely lets those crawlers through by default, but there's no differentiated policy, and nothing to prove it's been checked. `app/sitemap.ts` is dynamic, DB-driven, capped at 5,000 listings, with a safe homepage-only fallback on DB error. JSON-LD exists only on the listing-detail page and uses schema.org **`Car`/`Offer`**, not the `Vehicle` type the strategy brief specifically names (`Car` is broadly equivalent and Google-recognised, but it's a mismatch worth a conscious decision rather than an accident). There is no programmatic SEO page generation of any kind — no make/model/location landing-page templates, no long-tail AEO content strategy in code.

### Monetisation plumbing — **Absent**
No Stripe or any payment SDK in dependencies. No pricing page. No `billing`/`subscriptions`/`invoices` table in any migration. No lead-cap counter or enforcement logic anywhere, despite "flat-monthly-per-rooftop-with-cap" being the named revenue model. No F&I referral tracking code. This entire pillar exists only in `docs/roadmap.md` and the strategy document.

### Everything else
- **Marketing/pilot-acquisition landing page** (`app/page.tsx` + `components/{Hero,Problem,HowItWorks,WhyDealersJoin,PilotForm,FAQ,Footer}.tsx`) — this is dealer-acquisition top-of-funnel, on-strategy, not off-strategy.
- **Public proof-metric page** (`app/(marketplace)/metrics/page.tsx`) — publishes the platform aggregate first-response time only once a minimum sample size is reached (`lib/metrics-publish.ts`), otherwise "insufficient data." Directly supports the "evidence to defend renewals" framing — on-strategy.
- **Auth, account management, role-aware signed-in home** — standard product plumbing, not off-strategy but not pillar-advancing either.
- **No off-strategy consumer bloat found**: no favouriting/saved-search-as-feature, no comparison tool, no reviews/ratings, no valuation tool, no finance calculator. The marketplace surface is browse/filter-heavy but hasn't grown the heavier destination-marketplace feature set that would make unwinding it expensive.
- **Cron/maintenance Workers** (`keepalive`, `outbox-sweep`, `raw-email-purge`) — necessary infra, not product features.
- **Root-level `.patch`/`pre-recovery-*` files** — dead debris, candidates for deletion, not features.

## 4. Honest maturity rating per pillar

| Pillar | Rating | Basis |
|---|---|---|
| Feed ingestion / listing pipeline | **Absent** | No code; manual single-row form only; DMS/CSV named as future work in the form's own UI copy |
| Listing display UI | **Working** (destination-marketplace-shaped) | Fully wired against real data, ISR on the money page, but only smoke-tested and off-strategy in emphasis |
| Lead capture and attribution | **Working**, verging on **Production-ready** for the parts built | Strongest test coverage in the repo (unit + DB-invariant + E2E); missing named pieces (OTP, proxy phone) |
| Dealer tooling/dashboards | **Working** (lead ops) / **Absent** (AI listings, pricing) | Metrics dashboard and lead queue are real and tested; the named first SaaS product (AI listings, price-positioning) doesn't exist |
| SEO/AEO surface | **Prototype** | robots/sitemap/JSON-LD present and functional but generic; no AEO-specific crawler policy despite it being a named requirement; no programmatic page generation |
| Monetisation plumbing | **Absent** | Zero code; strategy-document only |

---

*Sources for every claim above are the file paths cited inline. This document makes no strategic recommendations — see `FIT_ASSESSMENT.md` for the Keep/Adapt/Build/Kill verdicts and the Continue/Adjust/Pivot call, and `ROADMAP.md` for the milestone plan.*
