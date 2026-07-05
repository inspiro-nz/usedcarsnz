# Marketplace Integration (WP-2/3 → live site)

**Branch:** `feature/marketplace-integration` · **Base:** `main` (the live Founding Dealer site)

This merge brings the WP-2/3 marketplace slice into the live codebase. The
landing page remains the homepage; the marketplace lives alongside it.

## Guarantees honoured

| Constraint | How it's met |
| --- | --- |
| Homepage preserved | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, and every landing component are **byte-identical to `main`** — verify with `git diff main -- app/page.tsx app/layout.tsx app/globals.css components/` (empty). Marketplace pages live in a route group `app/(marketplace)/` with their own layout, so URLs and the root layout are untouched. |
| Theme inherited | All marketplace UI was re-skinned from the ZIP's green/mono theme to the live design system: slate text scale, orange-500 CTAs, white `rounded-2xl border-slate-100 shadow-sm` cards, the exact input classes from `PilotFormClient`, the red-50 error banner, `slate-950` footer, and bold `tabular-nums` for data readouts (the Hero stat treatment). No new tokens; `globals.css` unchanged. |
| Security preserved | `app/api/lead/route.ts`, `public/_headers`, `next.config.js`, `wrangler.jsonc` untouched. The new session-refresh `middleware.ts` matcher covers **only** marketplace routes — `/` and `/api/lead` are not matched, so their request path is identical to before. The landing form's honeypot + IP rate-limit pattern was additionally **extended** to the new public forms via `lib/security.ts`. |
| Routing intact | `next build` route table: `/` still static, `/api/lead` unchanged, 11 marketplace routes added, plus `/sitemap.xml` and `/robots.txt`. |

Only two pre-existing files were modified: `package.json` (new deps + two
scripts) and `package-lock.json`.

## What was added, where

```
middleware.ts                      Supabase session refresh (edge; marketplace routes only)
app/(marketplace)/layout.tsx       Marketplace chrome on a slate-50 canvas (route group — no URL change)
app/(marketplace)/(auth)/          sign-in, sign-up, sign-out action, auth form
app/(marketplace)/cars/            browse + filters, listing detail (JSON-LD, CIN/in-trade strip), enquiry form + action
app/(marketplace)/register-dealer/ dealer self-registration (pending-approval flow)
app/(marketplace)/dealer/          dashboard (conversion metrics), lead inbox, lead detail with
                                   AI-draft approval gate, listings management, new listing
app/(marketplace)/admin/           dealer approval queue
app/sitemap.ts, app/robots.ts      SEO (sitemap includes / and active listings; robots blocks /dealer,/admin)
components/marketplace/            ui primitives, chrome, listing card — all in the live design language
lib/                               env loader, auth viewer, supabase clients (browser/server/service),
                                   leads engine, ai/drafts (draft-not-send boundary), funnel maths,
                                   metrics, email, format, db types, security (honeypot + rate limit)
supabase/                          the eight WP-1 migrations + seed + config
scripts/verify-logic.mjs           11 unit checks on funnel maths + AI compliance shape (`npm run verify:logic`)
docs/marketplace-integration.md    this file
```

## Deliberate decisions (flagged)

1. **`middleware.ts`, not `proxy.ts`.** Next 16 renames middleware to
   `proxy`, but `proxy.ts` is Node-runtime-only and `@opennextjs/cloudflare`
   1.19 rejects Node middleware. The deprecated-but-supported `middleware.ts`
   compiles to edge middleware, which the Workers build requires. Expect a
   one-line deprecation warning at build time; rename when the adapter
   catches up.
2. **`NEXT_PUBLIC_SITE_URL` now defaults** to `https://usedcarsnz.co.nz` in
   `lib/env.ts` (the ZIP required it) so the existing deployment, which
   predates the variable, cannot throw.
3. **Zod stays at v3** (the lead route's pinned version). The ported env
   loader is v3-compatible; nothing was upgraded.
4. **Abuse protection extended, not modified.** `lib/security.ts` mirrors the
   `/api/lead` honeypot + in-memory rate-limit pattern for `submitEnquiry`
   (honeypot + 10/hr/IP) and `registerDealer` (3/hr/IP). Turnstile on the
   enquiry form is a deliberate follow-up decision (buyer friction trade-off),
   not an omission. Same KV upgrade path as documented in
   `docs/form-security.md`.
5. **Deferred from the ZIP** (would have touched live config for no launch
   value): Serwist PWA, local font files (site already loads Geist via
   `next/font/google`), the ZIP's multi-env wrangler config and GitHub Actions
   workflows (the live repo deploys via `npm run deploy`), and the ZIP's own
   homepage/chrome (replaced by the live landing page + new marketplace chrome).

## To run it

Marketplace routes need a Supabase project with the WP-1 migrations applied
(`supabase/migrations`, in order — or `supabase db push`). Environment:

```bash
# Required for marketplace pages
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # secret — lead engine writes (wrangler secret put)

# Optional
NEXT_PUBLIC_SITE_URL=https://usedcarsnz.co.nz   # defaults to this
NEXT_PUBLIC_APP_ENV=production                   # local | dev | demo | production
RESEND_API_KEY=...                               # already set for /api/lead; lead engine
                                                 # logs instead of sending if absent
```

Without Supabase env vars the homepage, `/api/lead`, `/sign-in` and `/sign-up`
work as before; server-rendered marketplace pages will error at request time
(the env loader is lazy, so **builds stay green** on an empty environment).

## Verification run on this branch

- `npm run typecheck` — clean (TS strict)
- `npm run verify:logic` — 11/11 PASS (funnel maths incl. the 40s median fixture; AI first-touch carries no vehicle claims; dealer draft carries the ownership notice)
- `npm run build` — compiles; route table: `/` static, 15 further routes, middleware registered
- `npx opennextjs-cloudflare build` — worker bundle generated (edge middleware accepted)
- `npm run lint` — new code clean; two pre-existing findings on `main` remain untouched (`components/Problem.tsx` unescaped apostrophe, `components/PilotFormClient.tsx` hook-deps warning) because fixing them would modify homepage files
