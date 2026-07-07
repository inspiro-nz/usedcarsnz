# Lead-engine audit

1. Safe to proceed for the current codebase, but the lead-engine work must assume a partially merged marketplace slice rather than a fully isolated app.
2. Proceed with the named corrections: the lead route and the marketplace inquiry flows both need the same security posture, and the middleware matcher needs to remain scoped to the marketplace auth routes.
3. Proceed with one important configuration correction: turnstile uses two env names, not one, and the repo currently has no committed Cloudflare vars/secrets manifest for them.
4. Proceed with a data-contract correction: the enquiries table already exists, but the lead engine should treat it as the canonical lead table and the event log as append-only.
5. Proceed with an environment correction: service-role writes depend on SUPABASE_SECRET_KEY, while the local build path is otherwise permissive and will not fail until runtime.
6. Proceed with a deployment correction: the Cloudflare worker config is present, but there are no cron triggers, no KV/queues bindings, and no CI workflow to enforce the build sequence.
7. Proceed with a code-splitting correction: security helpers exist in lib, but the landing lead route still carries its own in-route implementations for rate limiting, Turnstile verification, and HTML sanitization.
8. Proceed with a branch-awareness correction: the current checkout is on feature/marketplace-integration, while develop exists remotely and locally but is not the active branch.
9. Proceed with a documentation correction: the repo has strong DB and security docs, but the environment expectations are only implied by code and docs, not declared in Wrangler config.
10. Proceed with a runtime-awareness correction: the lead-engine paths are server-side and will work only when the Supabase service secret, Resend key, and Turnstile keys are present in the intended runtime environment.

## 1) Route-group inventory and landing-page vs marketplace split

- Route-group names under [app](app):
  - [app/(marketplace)](app/(marketplace)) — the merged marketplace route group.
  - [app/api](app/api) — route handlers under the /api namespace.
  - [app/auth](app/auth) — auth callback route under /auth.
  - [app](app) — the root route group for the frozen landing page and global app shell.
- Frozen landing-page scope (the hardened, pre-marketplace surface):
  - Root landing page: [app/page.tsx](app/page.tsx)
  - Global shell/layout: [app/layout.tsx](app/layout.tsx)
  - SEO files: [app/robots.ts](app/robots.ts), [app/sitemap.ts](app/sitemap.ts)
  - Hardened lead API: [app/api/lead/route.ts](app/api/lead/route.ts)
  - Landing form UI: [components/PilotForm.tsx](components/PilotForm.tsx), [components/PilotFormClient.tsx](components/PilotFormClient.tsx)
- Marketplace slice scope:
  - Auth/account/admin/dealer/cars/register-dealer routes under [app/(marketplace)](app/(marketplace))
  - Representative pages: [app/(marketplace)/account/page.tsx](app/(marketplace)/account/page.tsx), [app/(marketplace)/cars/page.tsx](app/(marketplace)/cars/page.tsx), [app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx](app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx), [app/(marketplace)/dealer/page.tsx](app/(marketplace)/dealer/page.tsx), [app/(marketplace)/register-dealer/page.tsx](app/(marketplace)/register-dealer/page.tsx)
- Important nuance: the landing page itself is still at /, while the marketplace lives under /account, /cars, /dealer, /register-dealer, etc., and the middleware deliberately excludes / and /api/lead from refresh logic in [middleware.ts](middleware.ts).

## 2) Supabase clients, lead engine, and security utilities in lib

- Supabase clients:
  - Browser/client: [lib/supabase/browser.ts](lib/supabase/browser.ts) exports supabaseBrowser.
  - Server/client for Server Components and actions: [lib/supabase/server.ts](lib/supabase/server.ts) exports supabaseServer.
  - Service-role/admin client: [lib/supabase/service.ts](lib/supabase/service.ts) exports supabaseService.
- Lead engine and AI helpers:
  - Core lead engine: [lib/leads.ts](lib/leads.ts) exports runFirstTouch, authorizeLeadAccess, approveAndSendDraft, bookViewing, markSold.
  - AI draft generation: [lib/ai/drafts.ts](lib/ai/drafts.ts) exports composeFirstTouch and draftDealerReply.
  - Funnel metrics: [lib/metrics.ts](lib/metrics.ts) exports dealerFunnelMetrics; [lib/funnel.ts](lib/funnel.ts) exports computeFunnel.
- Security utilities:
  - Turnstile verification is implemented inline in [app/api/lead/route.ts](app/api/lead/route.ts); there is no shared lib export for it.
  - Honeypot validation: [lib/security.ts](lib/security.ts) exports honeypotTripped, used by [app/(marketplace)/cars/actions.ts](app/(marketplace)/cars/actions.ts) and [app/(marketplace)/register-dealer/actions.ts](app/(marketplace)/register-dealer/actions.ts).
  - Rate limiting and client IP extraction: [lib/security.ts](lib/security.ts) exports checkRateLimit and getClientIP; the landing route [app/api/lead/route.ts](app/api/lead/route.ts) has its own local in-memory implementation instead of using the shared helper.
  - HTML sanitization: [app/api/lead/route.ts](app/api/lead/route.ts) contains a local sanitizeHtml helper; there is no shared lib wrapper for it.
  - Resend sending: [lib/email.ts](lib/email.ts) exports sendEmail. The landing route [app/api/lead/route.ts](app/api/lead/route.ts) also uses the Resend SDK directly.

## 3) Existing migrations and the tables/columns they create

- [supabase/migrations/20260621090000_extensions.sql](supabase/migrations/20260621090000_extensions.sql) — creates the extensions schema and enables pgcrypto and vector.
- [supabase/migrations/20260621090100_enums.sql](supabase/migrations/20260621090100_enums.sql) — creates user_role, dealer_status, staff_role, seller_type, listing_status, fuel_type, transmission_type, drive_type, enquiry_status, lead_actor, lead_event_type, and ai_draft_status.
- [supabase/migrations/20260621090200_core_identity.sql](supabase/migrations/20260621090200_core_identity.sql) — creates public.users with id, role, full_name, email, phone, created_at, updated_at; creates public.dealers with owner_user_id, business_name, nzbn, contact_name, email, phone, address_line, suburb, city, region, postcode, logo_url, status, verified, approved_by, approved_at, created_at, updated_at; creates public.staff_accounts with dealer_id, user_id, role, created_at.
- [supabase/migrations/20260621090300_listings.sql](supabase/migrations/20260621090300_listings.sql) — creates public.listings with the full vehicle catalog shape (seller_type, dealer_id, seller_user_id, make, model, year, variant, body_type, fuel, transmission, odometer_km, colour, engine_size_cc, cylinders, drive, seats, wof_expiry, rego_expiry, previous_owners, import_origin, condition, price_nzd, is_poa, suburb, city, region, latitude, longitude, title, description, in_trade, cin_link, status, sold_price, sold_at, expires_at, embedding, created_at, updated_at) plus public.listing_photos and public.saved_listings.
- [supabase/migrations/20260621090400_leads.sql](supabase/migrations/20260621090400_leads.sql) — creates public.enquiries with id, listing_id, dealer_id, seller_user_id, buyer_user_id, buyer_name, buyer_email, buyer_phone, message, qualification, status, created_at, updated_at; creates public.ai_drafts with enquiry_id, dealer_id, seller_user_id, draft_text, edited_text, status, approved_by, approved_at, sent_at, created_at, updated_at; creates public.lead_events with lead_id, dealer_id, listing_id, event_type, actor, occurred_at, recorded_at, payload.
- [supabase/migrations/20260621090500_functions_triggers.sql](supabase/migrations/20260621090500_functions_triggers.sql) — adds trigger functions and trigger wiring, including the lead_events append-only guard and the enquiry/ai_draft denormalisation functions; it does not create new tables, but it hardens the lead engine data flow.
- [supabase/migrations/20260621090600_rls.sql](supabase/migrations/20260621090600_rls.sql) — enables RLS and creates policies for users, dealers, staff_accounts, listings, listing_photos, enquiries, ai_drafts, saved_listings, and lead_events.
- [supabase/migrations/20260621090700_auth_user_sync.sql](supabase/migrations/20260621090700_auth_user_sync.sql) — creates the auth-to-profile sync trigger and function that materialises public.users rows on auth signup.
- Enquiries table status: it already exists and is the canonical lead table, as confirmed by [supabase/migrations/20260621090400_leads.sql](supabase/migrations/20260621090400_leads.sql) and the lead engine usage in [lib/leads.ts](lib/leads.ts).

## 4) Environment variables referenced in code and expected deployment locations

- Public Next.js/Supabase vars used by the app:
  - NEXT_PUBLIC_APP_ENV — read in [lib/env.ts](lib/env.ts); expected as a regular Next env in local development and deployment runtime.
  - NEXT_PUBLIC_SITE_URL — read in [lib/env.ts](lib/env.ts), used by [app/robots.ts](app/robots.ts) and [app/sitemap.ts](app/sitemap.ts); expected as a regular env in local and deployment runtime.
  - NEXT_PUBLIC_SUPABASE_URL — read in [lib/env.ts](lib/env.ts), [lib/supabase/server.ts](lib/supabase/server.ts), [lib/supabase/browser.ts](lib/supabase/browser.ts), and [middleware.ts](middleware.ts); expected as a public runtime env, typically in .env.local for local development and deployment env injection.
  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — read in the same files; same expectation as the URL.
  - NEXT_PUBLIC_TURNSTILE_SITE_KEY — read in [components/PilotForm.tsx](components/PilotForm.tsx) and used in [components/PilotFormClient.tsx](components/PilotFormClient.tsx); expected as a public runtime env, typically in .env.local for local development and deployment env injection.
- Server-only vars:
  - SUPABASE_SECRET_KEY — read in [lib/env.ts](lib/env.ts) and [lib/supabase/service.ts](lib/supabase/service.ts); expected as a server secret in the deployment runtime (Cloudflare secrets or equivalent) and in local .env.local for local dev.
  - RESEND_API_KEY — read in [lib/env.ts](lib/env.ts), [app/api/lead/route.ts](app/api/lead/route.ts), and [lib/email.ts](lib/email.ts); expected as a server secret in deployment runtime and local .env.local.
  - RESEND_FROM_EMAIL — read in [app/api/lead/route.ts](app/api/lead/route.ts) and documented in [README.md](README.md); expected as a server env.
  - LEAD_EMAIL — read in [app/api/lead/route.ts](app/api/lead/route.ts) and documented in [README.md](README.md); expected as a server env.
  - TURNSTILE_SECRET_KEY — read in [app/api/lead/route.ts](app/api/lead/route.ts); expected as a server secret.
  - OPENAI_API_KEY — referenced in [lib/ai/drafts.ts](lib/ai/drafts.ts) as a future provider hook and in [lib/env.ts](lib/env.ts); currently not used directly in runtime code.
  - SKIP_ENV_VALIDATION — read in [lib/env.ts](lib/env.ts); intended as an escape hatch for local/dev builds.
- Expected locations in this repo:
  - No [.env.local](.env.local) file is checked in; the build output noted .env.local, so local dev is expected to use that file.
  - No [.dev.vars](.dev.vars) file is present.
  - No secret bindings/vars are declared in [wrangler.jsonc](wrangler.jsonc).
- Mismatch to flag:
  - The repo does not declare Cloudflare Worker vars/secrets in [wrangler.jsonc](wrangler.jsonc), even though the app expects server-only secrets like RESEND_API_KEY and TURNSTILE_SECRET_KEY at runtime.
  - Turnstile uses two env names in code: NEXT_PUBLIC_TURNSTILE_SITE_KEY (public) and TURNSTILE_SECRET_KEY (secret). The prompt language should not imply a single Turnstile key.

## 5) Wrangler config, bindings, compatibility, cron triggers, and paid-plan signal

- [wrangler.jsonc](wrangler.jsonc) declares:
  - name: usedcarsnz
  - main: .open-next/worker.js
  - compatibility_date: 2026-06-03
  - compatibility_flags: nodejs_compat
  - assets binding: ASSETS
  - services binding: WORKER_SELF_REFERENCE
  - images binding: IMAGES
  - observability enabled
- There are no cron triggers declared in [wrangler.jsonc](wrangler.jsonc).
- There is no evidence of paid-only Workers features in the repo: no queues, Dispatch, Durable Objects, vectorize, D1 bindings, or other paid-only features are referenced in [wrangler.jsonc](wrangler.jsonc) or the app code.
- The repo therefore looks like a standard Workers deployment configuration rather than an explicit paid-plan configuration; the repo alone does not prove the account is on a paid plan.

## 6) Per-route runtime and Node-only API usage

- [app/api/lead/route.ts](app/api/lead/route.ts) runs as a Next route handler under the OpenNext/Cloudflare worker runtime. It uses NextRequest/NextResponse, fetch, and the Resend SDK; no Node-only APIs are used.
- [app/auth/callback/route.ts](app/auth/callback/route.ts) also runs as a Next route handler under the OpenNext/Cloudflare worker runtime. It uses Request/NextResponse and Supabase session exchange; no Node-only filesystem or process APIs are used.
- The marketplace pages under [app/(marketplace)](app/(marketplace)) are server-rendered React components and use the Supabase server client; they are not separate API routes.
- The middleware in [middleware.ts](middleware.ts) runs as edge middleware, as documented in the file and confirmed by the build output that reports Proxy (Middleware).

## 7) Test tooling, lint config, CI workflows, and what they run

- Test tooling: no Vitest or Playwright setup is present. There is no test script in [package.json](package.json), and no test runner dependencies were found.
- Logic verification script: [scripts/verify-logic.mjs](scripts/verify-logic.mjs) is a one-off verification script for funnel math and AI draft formatting, and it is wired up as npm run verify:logic in [package.json](package.json).
- Linting: [eslint.config.mjs](eslint.config.mjs) configures ESLint with next/core-web-vitals and next/typescript.
- CI workflows: none exist under [.github/workflows](.github/workflows); there is no workflow file to run lint/build/tests automatically.
- Build-related scripts present: [package.json](package.json) contains build, typecheck, lint, preview, deploy, upload, and verify:logic.

## 8) Middleware scope and matcher

- [middleware.ts](middleware.ts) is scoped to Supabase session refresh for the marketplace auth surface.
- Its matcher currently includes /account, /reset-password, /cars/:path*, /dealer/:path*, /admin/:path*, /register-dealer, /sign-in, and /sign-up.
- It excludes / and /api/lead by design, as stated in [middleware.ts](middleware.ts).
- This means the landing page and lead route are left untouched by the auth-refresh middleware, while authenticated marketplace routes are covered.

## 9) Assumption diffs against the lead-engine prompts

- (a) “app/(marketplace) exists with search + listing detail pages” — DIFFERS in wording, but CONFIRMED in substance. The route group exists and includes browse/detail routes at [app/(marketplace)/cars/page.tsx](app/(marketplace)/cars/page.tsx) and [app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx](app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx); there is not a separate /search route.
- (b) “an enquiries table exists from WP-1 migrations” — CONFIRMED. The table exists in [supabase/migrations/20260621090400_leads.sql](supabase/migrations/20260621090400_leads.sql) and is used by the lead engine in [lib/leads.ts](lib/leads.ts).
- (c) “RESEND_API_KEY and Turnstile keys are the env names in use” — CONFIRMED with nuance. The code uses RESEND_API_KEY; Turnstile uses both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, so the build prompts should mention both rather than a single Turnstile key variable.
- (d) “no vitest yet” — CONFIRMED. No Vitest or Playwright config exists; only the lightweight [scripts/verify-logic.mjs](scripts/verify-logic.mjs) script is present.
- (e) “develop is the integration branch” — DIFFERS. The local and remote branch structure includes develop, but the current checkout is feature/marketplace-integration; the repo state showed develop and the current feature branch both present locally and on origin.

## 10) Other things that would surprise a new engineer

- The landing page and the marketplace slice share one Next app but deliberately keep different security boundaries; the landing lead route is hardened separately from the marketplace form actions, and the middleware does not apply to / or /api/lead.
- The lead engine is not just email sending: it writes immutable event-log entries through the RPC in [supabase/migrations/20260621090500_functions_triggers.sql](supabase/migrations/20260621090500_functions_triggers.sql) and the service-role client in [lib/leads.ts](lib/leads.ts).
- The repo already has a strong server-side schema for enquiries, ai_drafts, and lead_events, so the new work can rely on those tables rather than inventing a new data model.
- Several security features are present, but they are duplicated across the landing route and the marketplace actions instead of being centralized under a single shared helper surface.
- The build and runtime environment expectation is partly implicit: the code references many env vars, but the repo does not declare them in [wrangler.jsonc](wrangler.jsonc) or commit a local env file, so deployment configuration is still a manual step.
