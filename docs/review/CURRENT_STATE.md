# UsedCarsNZ — Current State Audit

**Date:** 2026-09-04 (revision 2 — first pass 2026-08-16)
**Repository state:** branch `docs/strategic-review`, HEAD `71facca`, branched from `develop` at `365b69d`. No application commits have landed since the first pass; the working tree carries four modified files and one untracked directory (see §5 of the assumptions below).
**Method:** Static read-only review. Revision 2 re-verified every load-bearing claim by reading the source files directly rather than relying on delegated summaries — this corrected two overstatements and surfaced four defects the first pass missed, all noted inline. No code, migrations, or dependencies were changed to produce this document.

## Open questions / assumptions

1. **OTP-verified enquiry forms and proxy phone numbers are named in the strategic brief as existing attribution machinery. Neither exists.** Verified by direct search: zero matches for `otp`/`signInWithOtp`/one-time-passcode outside false positives on the string "forgotPassword", and zero matches for Twilio, proxy phone, masked number, or call tracking anywhere in `app/`, `lib/`, or `workers/`. Enquiry bot-defence is Cloudflare Turnstile (`lib/turnstile.ts`); phone numbers are stored and rendered in plain text (`app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx:238-240`). **Assumption: aspirational, not built.** Treated as absent throughout.
2. **Dealer inventory feed ingestion does not exist.** Verified by direct search: the only match for Motorcentral/DMS/feed-import across the entire codebase is a line of UI copy promising it (`app/(marketplace)/dealer/listings/new/page.tsx:19`). Every other CSV match is the metrics *export* (`lib/metrics-publish.ts`, `app/api/metrics/route.ts`), which is an unrelated outbound feature. **Assumption: this is the largest gap and is treated as such.**
3. **`docs/AUDIT-LEAD-ENGINE.md`** (dated 2026-07-09) describes a broken working tree and a broken `ai_service` migration. The migration on disk today is clean and uses defensive `IF NOT EXISTS` guards. **Assumption: superseded historical snapshot**; disregarded below.
4. Whether `ci.yml`/`e2e.yml` are *required* branch-protection checks cannot be determined from repo files. **Assumption: advisory unless confirmed.**
5. The untracked `app/(marketplace)/dealers/[id]/page.tsx` and four modified files are an in-flight **dealer storefront** feature, ~136 insertions across the listing detail page, cars index, leads detail page, and listing card. Treated as current state, not hypothetical — and it is the subject of several new findings below.

---

## 1. Stack and structure

- **Framework:** Next.js `16.2.7`, React `19.2.4`, App Router only (`package.json`). `AGENTS.md` warns this version breaks from training-data expectations; verified against `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. The changes that actually bite here: `middleware.ts`→`proxy.ts` (repo deliberately keeps the deprecated filename because `proxy.ts` is forced to the Node runtime and `@opennextjs/cloudflare` v1.19 needs edge middleware); synchronous `cookies`/`headers`/`params` access fully removed; `next lint` removed (the `lint` script already calls `eslint` directly).
- **Backend:** No ORM. Raw `@supabase/supabase-js` `^2.110.0` + `@supabase/ssr` `^0.12.0` against hand-written types in `lib/db/types.ts`. **No Supabase Edge Functions exist** (`supabase/functions/` is absent) — all server logic is Next.js Route Handlers under `app/api/`, deployed to Cloudflare via `@opennextjs/cloudflare` `^1.19.11`. The brief's "verified JWTs on functions" security requirement therefore has no Edge Function surface to apply to; the equivalent concern is the shared-secret verification on the cron and inbound-email routes, which is correctly implemented (§2).
- **Supabase client split** — this is a well-designed piece of the codebase worth naming: `lib/supabase/public.ts` exports `supabasePublic()`, a deliberately **cookie-less** anon client whose docstring explains it exists so public pages can be ISR-cached (any `cookies()` access forces dynamic rendering). `lib/supabase/service.ts` is `import "server-only"` and throws if the service key is missing. The architecture for cacheable public pages is already correct and in place — it is simply under-used (§3, SEO/AEO).
- **Rendering:** overwhelmingly `export const dynamic = "force-dynamic"` — 16+ routes including all of `dealer/*`, `admin`, `cars`, `home`, `metrics`, `sitemap.ts`, and the new `dealers/[id]`. The **only** cached route is the listing detail page (`app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx:14-23`): `revalidate = 300`, `dynamicParams = true`, `generateStaticParams() => []`, correctly using `supabasePublic()` so it is actually cacheable, with on-demand `revalidatePath` invalidation from `app/(marketplace)/dealer/actions.ts`. This is the only `generateStaticParams` in the codebase.
  - **Confirmed unresolved bug:** the ISR page 500s under a production server. Root cause verified directly: `app/(marketplace)/layout.tsx` renders `MarketplaceHeader` from `components/marketplace/chrome.tsx`, which at line 13 calls `await getViewer()` — a cookie read — inside the layout wrapping every marketplace page. Next then errors "Page changed from static to dynamic at runtime, reason: cookies." Because of this, `.github/workflows/e2e.yml` and `playwright.config.ts` deliberately run E2E against `next dev`. **ISR is unverified in production and currently non-functional there** — the one piece of demand-surface caching the project has is not actually working where it matters.
  - No `runtime = "edge"` exports anywhere. Three `loading.tsx` files exist (under `cars/` and `dealer/`); no `error.tsx` or `not-found.tsx` anywhere.
- **Deploy pipeline:** `wrangler.jsonc` — production is the top-level/default config (worker `usedcarsnz`), deployed **manually only** via `npm run deploy`; no CI job deploys production. An `env.demo` block defines a separate `usedcarsnz-demo` worker on `demo.usedcarsnz.co.nz` redeclaring every binding (Wrangler does not inherit bindings into named environments). Four workflows: `ci.yml` (typecheck → lint → unit tests → build, on every push and PR into `develop`), `e2e.yml` (PR-only; boots an ephemeral Supabase stack, runs the DB-invariant/RLS suite plus Playwright, on Node 22 because `supabase-js` realtime needs native WebSocket), `deploy-demo.yml` (push to `demo` branch; deploys app + all four standalone Workers to demo only), `promote-demo.yml` (manual dispatch; force-pushes a ref to `demo` then explicitly re-dispatches the deploy, since a bot-token push won't self-trigger).
- **Standalone Cloudflare Workers** under `workers/`, each with its own `wrangler.jsonc`, all existing because the OpenNext app worker exports only `fetch` and no `scheduled` handler: `email-inbound` (Email Routing handler), `keepalive` (daily cron; exists solely to stop a free-tier Supabase project pausing), `outbox-sweep` (15-min cron; drains the ack-email retry queue), `raw-email-purge` (daily cron; 30-day raw-MIME retention).
- **Repo layout:** `app/` (App Router; marketing landing page at root, `app/api/` handlers, `app/(marketplace)/` for the product), `components/` (landing components + `components/marketplace/`), `lib/` (`ai/`, `cron/`, `db/`, `email/`, `enquiries/`, `inbound/`, `leads/`, `supabase/`, plus `auth.ts`, `metrics*.ts`), `supabase/migrations/` (20 files) + `supabase/seed/`, `workers/` (the four above), `scripts/` (demo seed/reset, E2E user setup, latency checks), `docs/`, `prompts/` (the authored AI build-package convention), `e2e/` (Playwright), `tests/` (Vitest DB-invariant/RLS tests needing a live stack).
- **Debris at repo root:** `marketplace-integration.patch`, `pre-recovery-staged.patch`, `pre-recovery-status.txt`, `pre-recovery-unstaged.patch` — leftovers from a past git-recovery incident.

## 2. Data model

Postgres 17 (`supabase/config.toml`). 20 migrations, `20260621090000` → `20260711100000_keepalive.sql`, across 7 commits (2026-07-04 → 2026-07-12). No generated types file — this was built by reading the migrations.

**Tables (13, all with RLS enabled — none found disabled):**

| Table | Purpose | RLS |
|---|---|---|
| `users` | Profile extending `auth.users`; role buyer/dealer/staff/admin | Enabled, 4 policies |
| `dealers` | Dealer entity, NZBN, approval/verification state | Enabled, 4 policies |
| `staff_accounts` | Dealer sub-accounts | Enabled, 4 policies |
| `listings` | Vehicle listings; dealer-or-private ownership CHECK | Enabled, 4 policies |
| `listing_photos` | Up to 20 photos/listing, trigger-enforced | Enabled, 4 policies — **but see finding below: zero application code references this table** |
| `saved_listings` | Buyer-saved listings | Enabled, 1 policy |
| `enquiries` | The lead; `listing_id` nullable since `20260710090000_enquiries_email_lane.sql` for listing-less email leads | Enabled, 4 policies |
| `ai_drafts` | AI-drafted dealer reply awaiting human approval | Enabled, 4 policies; table-level UPDATE revoked from `authenticated` and re-granted column-scoped to `edited_text` only |
| `lead_events` | Append-only immutable funnel/audit log; sole source of every metric | Enabled, SELECT-only; writes only via `log_lead_event()` (EXECUTE granted to `service_role` alone); mutation blocked for **every** role including owner by `prevent_mutation()` triggers |
| `dealer_aliases` | Inbound-email local-part → `dealer_id` routing; admin-provisioned | Enabled, 4 policies (broad table GRANT to `authenticated`, but every write policy requires `is_admin()` — RLS is the real gate) |
| `messages` | Buyer/AI/dealer chat thread | Enabled, SELECT-only; no client INSERT |
| `email_outbox` | Resend-failure retry queue | Enabled, **zero policies** — correctly locks out anon/authenticated; `service_role` only |
| `keepalive_ping` | Demo-only cron ping | Enabled, **zero policies** — same pattern |

**Views** (all in `20260711090000_metrics_views.sql`): `metrics_lead_facts`, `metrics_dealer`, `metrics_first_response_30d_dealer`, `metrics_time_on_market_dealer`, `metrics_enquiries_per_listing_dealer` — all `security_invoker = on`, granted to `authenticated, service_role` only, so RLS on `lead_events` scopes them per dealer. `metrics_platform` is the deliberate exception: `security_invoker = off` to aggregate across all dealers, exposes no `lead_id`/`dealer_id`, granted to `anon`. This split is sound and intentional.

**Functions:** RLS-predicate helpers (`is_admin`, `is_dealer_member`, `is_dealer_owner`, `is_listing_owner`) are `SECURITY DEFINER` with `search_path=''`, read-only, safe. `log_lead_event()` is `SECURITY DEFINER` with EXECUTE revoked from `PUBLIC`. `handle_new_user()` hardcodes new signups to `role='buyer'` regardless of client input. `purge_inbound_email_raw()` is `service_role`-only. `set_enquiry_denorm()` authoritatively sets `dealer_id` from the listing and only trusts a server-resolved `dealer_id` when `listing_id IS NULL`.

### Security finding — `approve_draft()` authorisation check is non-functional

`supabase/migrations/20260707100400_ai_drafts_harden.sql:53-60`, verified by direct read:

```sql
if not (
  public.is_dealer_member(v_draft.dealer_id)
  or v_draft.seller_user_id = (select auth.uid())
  or public.is_admin()
) then
  raise exception 'approve_draft: not authorized for draft %', p_draft_id
```

For a **dealer-lane** draft, `seller_user_id` is always `NULL` (it is populated only for private-seller listings). In SQL three-valued logic `false OR NULL OR false` evaluates to `NULL`; `NOT NULL` is `NULL`; and plpgsql treats a `NULL` `IF` condition as false. **The `RAISE EXCEPTION` is therefore skipped and the authorisation gate does not fire.** The function is `SECURITY DEFINER`, so the subsequent `UPDATE` bypasses RLS and succeeds, setting `approved_by` to the caller and appending a `draft_approved` event to the immutable log.

**Correction to the first pass, in the interest of accuracy:** revision 1 stated that "any authenticated user can approve any dealer's draft." That overstates the practical exposure. Exploitation requires knowing the draft's UUID, and `ai_drafts` carries RLS policies that prevent an unrelated user from enumerating drafts — so a random authenticated buyer cannot discover a target ID by querying. The accurate statement is: **the function's own authorisation gate is inert, and the only thing standing between an authenticated user and approving an arbitrary draft is that they must obtain its UUID by some other route** (a shared link, a log line, a screenshot, a support ticket, or any future code path that exposes draft IDs). That is defence-in-depth accidentally carrying the whole load, with the layer designed to be the gate contributing nothing.

It remains a must-fix before dealers rely on the approval gate — the human-approval boundary is the core trust claim of the AI-reply feature, and it is currently unenforced at the point it was written to be enforced. It is a **known, deliberately deferred** finding: tracked as an expected-red tripwire at `tests/db-invariants/ai-drafts-approval.test.ts:94-126` ("KNOWN HOLE — T2 FINDING #1 (founder decision; do not fix in this package)"), documented in `docs/testing.md:144-150` and `prompts/PROMPT-T2.md`. The fix is one line: `or coalesce(v_draft.seller_user_id = (select auth.uid()), false)`.

**Other security posture:** clean. Storage has exactly one bucket, `inbound-email-raw`, explicitly `public = false`. Cron endpoints (`lib/cron/auth.ts`) and the inbound-email endpoint both **fail closed** (503) when their shared secrets are unset, and the inbound route HMAC-verifies before processing. No hardcoded service-role key exists in any client-reachable file. Turnstile verification fails closed in production.

## 3. Feature inventory against the strategic pillars

### Feed ingestion / listing pipeline — **Absent**
No feed parser, DMS connector, scheduled inventory sync, or bulk-upload UI exists. Listing creation is manual, one row at a time, via `app/(marketplace)/dealer/listings/new/new-form.tsx` → `createListingAction`. The only first-party acknowledgement is the form's own copy: *"Photos and bulk import arrive with the Motorcentral / CSV pipeline"* (`app/(marketplace)/dealer/listings/new/page.tsx:19`). The `workers/email-inbound/` + `lib/inbound/` pipeline ingests forwarded Trade Me **lead** emails, not inventory — that is lead capture, not supply.

**New finding (revision 2): `listing_photos` is dead schema.** The table, its 20-photo trigger, and its four RLS policies all exist, but a search across `app/`, `lib/`, and `components/` returns **zero references**. The listing detail page renders a make/model monogram plate instead, with an in-file comment conceding "photo pipeline is a later WP" (`.../[id]/page.tsx:128`). This matters beyond aesthetics — see the SEO/AEO section.

### Listing display UI — **Working**, destination-marketplace in shape
Browse/search/filter at `app/(marketplace)/cars/page.tsx` (server-rendered facets: keyword, make, dealer, price, year, fuel, transmission). Listing detail at `.../[id]/page.tsx` — the one ISR page, with JSON-LD, spec sheet, and a genuinely good compliance strip (in-trade disclosure, CGA/FTA notice, CIN link) that reflects real NZ motor-trade obligations. In-flight dealer storefront at `app/(marketplace)/dealers/[id]/page.tsx`. `components/marketplace/listing-card.tsx` has no photo rendering. Test coverage is smoke-level only (`e2e/marketplace.spec.ts`, 2 tests).

### Lead capture and attribution — **Working**, verging on Production-ready; the strongest asset in the repo
Enquiry form with Turnstile + honeypot + rate limiting, failing closed in production (`app/api/enquiries/route.ts`, `lib/turnstile.ts`, `lib/security.ts`). Email-lead ingestion from forwarded Trade Me notifications, HMAC-verified, deduped on `external_message_id`, dealer resolved via `dealer_aliases`, raw MIME retained and purged on a 30-day cron. Append-only `lead_events` trail underpinning the dealer leads inbox (`app/(marketplace)/dealer/leads/[id]/page.tsx`), a human-approval gate before any AI reply sends (`lib/leads.ts` — structurally refuses to send without `status==='approved'` and an `approved_by`), and a buyer-facing chat thread. Test coverage is genuinely strong: unit suites across `lib/inbound/*`, `lib/leads*`, `lib/email/*`, `lib/ai/*`; DB-invariant tests for log immutability and an RLS deny-matrix; a 222-line E2E money-shot journey.
**Missing:** OTP verification and proxy phone numbers, both named in the brief, both absent.

### Dealer-facing tooling — **Working** (lead ops) / **Absent** (the named first SaaS product)
Dealer dashboard, conversion-metrics dashboard with CSV export (`app/(marketplace)/dealer/metrics/page.tsx`, `lib/metrics-views.ts`, `lib/metrics-publish.ts`), admin dealer-approval queue. The AI that exists is buyer-qualification chat and dealer-**reply** drafting (`lib/ai/trigger.ts`, `lib/ai/generate-draft.ts`, `lib/ai/guard.ts`), prompt-injection-guarded and human-approval-gated. **AI-written listing copy and price-positioning reports — the first product in the stated revenue sequence — have zero code.**

### SEO/AEO surface — **Prototype**, with three concrete defects
- `app/robots.ts` is a single wildcard rule: `{ userAgent: "*", allow: "/", disallow: ["/dealer", "/admin"] }`. **No GPTBot/ClaudeBot/PerplexityBot/CCBot rules exist anywhere in the repo**, despite explicit AI-crawler policy being a named strategic requirement.
- **New finding (revision 2), and the most consequential of this pass: `Disallow: /dealer` also blocks `/dealers/*`.** robots.txt path matching is prefix-based, so the rule intended to hide the private dealer *dashboard* at `/dealer` simultaneously blocks every public dealer *storefront* at `/dealers/[id]` from every crawler. The storefront page being built right now — a well-formed, locally-relevant, on-strategy AEO surface, already linked twice from the listing detail page (`.../[id]/page.tsx:224,233`) — would ship invisible to Google and to every AI crawler. Fixing it requires changing the rule to `/dealer$` and `/dealer/`, or renaming one of the two routes.
- **New finding: the dealer storefront is `force-dynamic` despite being ideal ISR material.** It already uses the cookie-less `supabasePublic()` client (the exact prerequisite the codebase built for cacheability) but explicitly opts out of caching. Public, anon-readable, slow-changing content re-queried on every crawler hit.
- **New finding: dealer storefronts are absent from the sitemap.** `app/sitemap.ts` emits only `/`, `/cars`, and listing URLs.
- `app/sitemap.ts` also uses `supabaseServer()` — the **cookie-reading** client — which is why it needs `force-dynamic`. Switching it to `supabasePublic()` would let the sitemap be cached. It also has a hard `limit(5000)` with no pagination, which will silently truncate rather than fail once stock grows.
- JSON-LD exists only on listing detail, typed `Car`/`Offer` rather than the brief's `Vehicle`. Both are schema.org-valid, but **the markup has no `image` property** — a direct consequence of `listing_photos` being unused — and image is effectively required for vehicle rich results. There is no `AutoDealer`/`LocalBusiness` markup on the dealer page.
- **No programmatic SEO page generation of any kind.** No make/model/location templates. The engine exists; the content layer does not.

### Monetisation plumbing — **Absent**
Verified by direct search: zero matches for Stripe, subscription, invoice, or lead-cap anywhere in `app/`, `lib/`, or `workers/`. No billing tables in any migration. No pricing page. No F&I referral tracking.

### Everything else
- **Marketing/pilot landing page** (`app/page.tsx` + `components/{Hero,Problem,HowItWorks,WhyDealersJoin,PilotForm,FAQ}.tsx`) — dealer-acquisition top-of-funnel; on-strategy.
- **Public proof-metric page** (`app/(marketplace)/metrics/page.tsx`) — publishes the platform aggregate only past a minimum sample size (`lib/metrics-publish.ts`), else "insufficient data". Directly serves the renewal-defence pitch; on-strategy and unusually disciplined.
- **Auth, account management, role-aware home** — necessary plumbing.
- **No off-strategy consumer bloat.** No comparison tool, no favourites-as-feature, no reviews, no valuation calculator, no finance calculator. The marketplace surface is filter-heavy but has not grown the expensive parts of a destination marketplace — which is what makes the repositioning cheap.
- **Cron Workers** — necessary infra.
- **Root `.patch`/`pre-recovery-*` files** — dead debris.

## 4. Honest maturity rating per pillar

| Pillar | Rating | Basis |
|---|---|---|
| Feed ingestion / listing pipeline | **Absent** | Zero code; manual single-row form only; `listing_photos` dead schema |
| Listing display UI | **Working** | Fully wired against real data; ISR designed correctly but broken in production; smoke-tested only |
| Lead capture and attribution | **Working** (strongest area) | Best test coverage in the repo across three layers; missing the named OTP/proxy-phone pieces |
| Dealer tooling/dashboards | **Working** (lead ops) / **Absent** (AI listings, pricing) | Metrics and lead queue are real and tested; the first SaaS product has no code |
| SEO/AEO surface | **Prototype** | Present but generic, and carrying three concrete defects — crawler-blocked dealer pages, no image markup, no programmatic pages |
| Monetisation plumbing | **Absent** | Zero code |

---

*Every claim above cites the file it rests on. Strategic verdicts are in `FIT_ASSESSMENT.md`; sequencing is in `ROADMAP.md`.*
