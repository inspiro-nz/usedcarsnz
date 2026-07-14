# UsedCarsNZ — Loose-Ends Register

**Updated: 2026-07-14** — after the Prompt 7 close-out (`feature/prompt7-closeout`).
Work top to bottom. This supersedes the 12 July register: **all of PART A is now
code-complete and on `feature/prompt7-closeout`** (was previously unmerged on
`feature/demo-hardening`). Nothing below marked ⚠ is optional if the goal is a
live, Access-gated demo at `demo.usedcarsnz.co.nz`.

---

## ✅ PART A — Code (DONE, on `feature/prompt7-closeout`)

All seven code gaps are closed and pass the verification gate (tsc / lint /
vitest / build green; frozen paths untouched). See `docs/roadmap.md` for detail.

- [x] A1 `scripts/latency-check.ts` (Access service-token headers; measures `/dealer/metrics`)
- [x] A2 `DEMO_RUNBOOK.md`
- [x] A3 `/privacy` page — **linked from the marketplace footer**, Privacy Act 2020 + collecting-agency framing included (placeholder pending lawyer review)
- [x] A4 Client-side image compression (WebP, ≤200KB, fixed aspect containers)
- [x] A5 ISR on listing detail + on-demand revalidation. `/cars` deliberately `force-dynamic` (searchParams-keyed)
- [x] A6 Two crons wired (outbox sweep, raw-email 30-day purge) as standalone workers
- [x] A7 `noindex` (`X-Robots-Tag`) on the demo build only
- [x] A8 `docs/roadmap.md` populated

**Remaining code merge step:** open a PR from `feature/prompt7-closeout` → `develop`
and merge. Until then the hardening work is not on `develop`.

---

## ⚠️ ZERO — before any `supabase db reset` (verified safe 2026-07-14)

- [x] `.env.local` points at LOCAL Supabase (`http://127.0.0.1:54321`), **not** the
  prod ref `geappcqiihbgihcsitkj`. Confirmed. Re-check if you ever edit `.env.local`.

---

## PART B — Founder: Cloudflare + secrets (~90 min, dashboard + CLI)

Runbooks already written: `docs/infra/demo-standup.md`, `docs/infra/email-routing.md`,
`docs/infra/cron-schedules.md`.

### B1 — Fix two CHANGE-ME placeholders (5 min)
- [ ] `workers/keepalive/wrangler.jsonc` — real **demo** project REST URL (never prod).
- [ ] `workers/email-inbound/wrangler.jsonc` — a **verified external** inbox (not `@usedcarsnz.co.nz`, or the catch-all loops).

### B2 — Supabase demo project (15 min)
- [ ] Confirm/create `usedcarsnz-demo` (Sydney `ap-southeast-2`, free tier).
- [ ] Record ref + publishable + secret keys.
- [ ] Push migrations to demo; `npm run seed:demo` (`docs/infra/demo-standup.md` §1–2).

### B3 — Worker secrets via CLI (10 min) — one command per line, never `&&`
- [ ] App `--env demo`: `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `INBOUND_HMAC_SECRET`, `RESEND_API_KEY`
- [ ] Keepalive worker: `SUPABASE_SECRET_KEY`
- [ ] Email-inbound worker: `INBOUND_HMAC_SECRET` (identical value to the app's)
- [ ] **New for Prompt 7 crons** — `outbox-sweep` and `raw-email-purge` workers each need:
      `CRON_SECRET` (same value also set on the app), plus `CF_ACCESS_CLIENT_ID` /
      `CF_ACCESS_CLIENT_SECRET` (demo is behind Access), and a `TARGET_URL` var
      pointing at the demo host's `/api/cron/*` endpoint. See `docs/infra/cron-schedules.md`.

### B4 — GitHub repo secrets (10 min) — for `deploy-demo.yml`
- [ ] `DEMO_NEXT_PUBLIC_SUPABASE_URL`, `DEMO_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
      `DEMO_NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### B5 — Cloudflare Zero Trust / Access (25 min, dashboard) — `demo-standup.md` §6
- [ ] Zero Trust org (Free plan; card required at signup, not charged)
- [ ] One-time PIN identity provider
- [ ] Self-hosted app for `demo.usedcarsnz.co.nz` (all paths). Policy: Allow → your emails. Session 1 week.
- [ ] Service token `demo-machine` (record Client ID + Secret)
- [ ] Second policy: Service Auth → include that token
- [ ] Store the service-token ID/Secret for `latency-check` (`CF_ACCESS_CLIENT_ID` /
      `CF_ACCESS_CLIENT_SECRET`) and as secrets on the two new cron workers + email-inbound

### B6 — Create the `demo` branch and deploy (10 min)
- [ ] Merge `feature/prompt7-closeout` → `develop` first, then branch `demo` off `develop` and push. Watch `deploy-demo.yml` go green (deploy-app + deploy-keepalive).
- [ ] **Deploy the two new cron workers** (`workers/outbox-sweep`, `workers/raw-email-purge`) — `wrangler deploy` from each dir; they are not part of `deploy-demo.yml`.

### B7 — Verify the wall (5 min)
- [ ] Phone/private window → Access PIN page, not a listing
- [ ] Authed device → full app
- [ ] Machine POST without the token → 403 at edge
- [ ] "Sample data" badge renders on metrics pages (`DEMO_SAMPLE_DATA=true`)

### B8 — Email Routing (20 min — deferrable past first demo) — `email-routing.md`
- [ ] Enable Email Routing; verify destination
- [ ] **DNS collision check against Resend** (§4)
- [ ] Catch-all → route `lead-*@usedcarsnz.co.nz` to `usedcarsnz-email-inbound`
- [ ] Deploy the email worker; smoke-test a fixture

---

## PART C — Verification (30 min)

- [ ] `scripts/latency-check.ts` against the **deployed** demo — all budgets pass
      (search/listing p75 < 1.5s · enquiry POST < 1s · dashboard < 1s). Needs the
      Access service token. *(Local dev run already passes — see the session report.)*
- [ ] One full dry-run of `DEMO_RUNBOOK.md`.
- [ ] Capture the screen-recording fallback (runbook T-1 step).

---

## PART D — Not blocking the demo (but real)

1. **Legal consult — urgent.** CCCFA→FMA transfer done; privacy page is placeholder; buyer PII flows through the email lane. Book it.
2. **Production deployment.** Marketplace slice on `main`, not live (no Supabase secrets on prod worker).
3. **Marketplace-primary vs tool-first** — unresolved; the dealer conversations will decide it.
4. **Seller-side vs dealer-side ad test** — hold ad budget until resolved.
5. **Motorcentral** — post-pilot.
6. **Real Trade Me lead-email fixture** — redacted sample from the first pilot dealer (`workers/email-inbound/fixtures`).

---

## Summary

| Bucket | State |
|---|---|
| PART A — code | ✅ done on `feature/prompt7-closeout` (merge to develop pending) |
| ⚠️ Zero — env safety | ✅ verified |
| PART B — founder/Cloudflare | ⏳ ~90 min, needs credentials |
| PART C — verification | ⏳ after deploy |
| PART D — not blocking | ongoing |

**You are one PR merge and one founder afternoon from a live demo.**
