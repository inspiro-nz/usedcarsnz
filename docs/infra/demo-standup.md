# Runbook — stand up the DEMO environment (demo.usedcarsnz.co.nz)

*Rewritten 19 July 2026 (post-PR #32) — this is the single, complete stand-up
path. This is the manual, operator-only work (Chris) that the repo cannot do for
itself. The repo side is fully wired: `env.demo` in `wrangler.jsonc`, the
`deploy-demo.yml` workflow (app + all three cron workers, with the two
app-targeting crons' `TARGET_URL` overridden to the demo host at deploy time),
the `promote-demo.yml` branch action, the `keepalive_ping` migration, and the
standalone workers under `workers/`. This runbook is the CLI + dashboard steps
that turn it on.*

**Demo Supabase project:** `usedcarsnz-demo` (ref `ttwsmrsgdqzjnobflihd`, free tier, Sydney).
**Demo app Worker:** `usedcarsnz-demo` (`wrangler.jsonc` → `env.demo`).
**Cron Workers:** `usedcarsnz-demo-keepalive`, `usedcarsnz-outbox-sweep`, `usedcarsnz-raw-email-purge`.
**Demo hostname:** `demo.usedcarsnz.co.nz`, behind Cloudflare Access (one-time PIN).

> **Golden rule:** every command below targets the **demo** project/Worker. Never
> run `supabase db push` / the seed against production. The seed scripts refuse
> to run unless `NEXT_PUBLIC_APP_ENV` is `local`/`demo` and the URL is not the
> prod project (`scripts/demo-data.ts` guard) — but check the ref anyway.

Windows PowerShell: run each command on its own line (no `&&`).

---

## 0. Prerequisites

- The `usedcarsnz-demo` Supabase project exists (founder created it via the
  dashboard). Confirm its **project ref** is `ttwsmrsgdqzjnobflihd` (this is the
  ref already committed in `workers/keepalive/wrangler.jsonc`) and have its
  **DB password**, **publishable key** and **secret key** to hand.
- The `usedcarsnz.co.nz` zone is on this Cloudflare account (it already is, for
  prod + email routing).
- `wrangler` and `supabase` CLIs are available (both are dev dependencies /
  installed locally). Log in once:

```
npx wrangler login
npx supabase login
```

---

## 1. Push the schema to the demo project (CLI — you do this)

Link the Supabase CLI to the **demo** project and push all migrations. This
creates the full schema including the `keepalive_ping` table.

```
npx supabase link --project-ref ttwsmrsgdqzjnobflihd
```
```
npx supabase db push
```

Confirm the migration list applied cleanly (it should include
`20260711100000_keepalive`).

```
npx supabase migration list
```

---

## 2. Seed the demo data (CLI — you do this)

The seed is idempotent and hard-guarded to local/demo. Create a dedicated
`.env.demo` (gitignored) for the demo project — the seed/reset scripts prefer it
over `.env.local`, so the demo credentials never overwrite the local stack's
`.env.local`:

```
NEXT_PUBLIC_APP_ENV=demo
NEXT_PUBLIC_SUPABASE_URL=https://ttwsmrsgdqzjnobflihd.supabase.co
SUPABASE_SECRET_KEY=<demo project secret key>
DEMO_SAMPLE_DATA=true
```

(`.env.demo` present → `npm run seed:demo` and `npm run demo:reset` target the
demo project; delete/rename it to go back to seeding the local stack.)

Then run the seed (safe to re-run; it no-ops already-seeded rows):

```
npm run seed:demo
```

Between dealer meetings, reset live-created leads (preserves seeded history — the
event log is immutable by design):

```
npm run demo:reset
```

---

## 3. Set the demo app Worker secrets (CLI — you do this)

`NEXT_PUBLIC_*` are baked in at build time by CI (step 6). The **server-side
secrets** are set once on the demo Worker and persist across deploys. Run each
in the repo root, all with `--env demo` so they land on `usedcarsnz-demo`:

```
npx wrangler secret put SUPABASE_SECRET_KEY --env demo
```
```
npx wrangler secret put TURNSTILE_SECRET_KEY --env demo
```
```
npx wrangler secret put RESEND_API_KEY --env demo
```
```
npx wrangler secret put CRON_SECRET --env demo
```
```
npx wrangler secret put ANTHROPIC_API_KEY --env demo
```
```
npx wrangler secret put INBOUND_HMAC_SECRET --env demo
```

- **`RESEND_API_KEY` is NOT optional for the demo.** Without it, `lib/email.ts`
  silently skips every send — the enquiry appears in the inbox but **the buyer
  never receives the sub-60-second acknowledgment**, which is the money shot of
  the dealer meeting. (Local dev deliberately runs keyless and logs instead.)
- **`CRON_SECRET`** protects `/api/cron/outbox-sweep` and
  `/api/cron/purge-raw-email`; the endpoints fail closed (503) if it is unset.
  Generate once (`openssl rand -hex 32`) and reuse the same value in step 4.
- `ANTHROPIC_API_KEY` and `INBOUND_HMAC_SECRET` are optional (Workers AI is the
  default provider; the inbound-email lane can stay off in the demo).
- Paste **demo** credentials for each — never prod values.

---

## 4. Set the cron Workers' secrets (CLI — you do this)

Each standalone Worker keeps its own secrets; they persist across CI deploys.

**Keep-alive** (needs the demo project's secret key):

```
cd workers/keepalive
```
```
npx wrangler secret put SUPABASE_SECRET_KEY
```

**Outbox sweep** and **raw-email purge** (each needs the shared `CRON_SECRET`
from step 3 plus the Access service token from step 6 — you can come back and
set the `CF_ACCESS_*` pair after step 6 creates the token):

```
cd ../outbox-sweep
```
```
npx wrangler secret put CRON_SECRET
```
```
npx wrangler secret put CF_ACCESS_CLIENT_ID
```
```
npx wrangler secret put CF_ACCESS_CLIENT_SECRET
```
```
cd ../raw-email-purge
```
```
npx wrangler secret put CRON_SECRET
```
```
npx wrangler secret put CF_ACCESS_CLIENT_ID
```
```
npx wrangler secret put CF_ACCESS_CLIENT_SECRET
```

> **`TARGET_URL` needs no action from you.** `deploy-demo.yml` overrides it to
> the demo host at deploy time (`--var`). Never set worker **vars** in the
> Cloudflare dashboard — every CI deploy re-asserts the config values and
> silently clobbers dashboard edits. (Secrets are safe; only vars are clobbered.)

---

## 5. Add the GitHub repo secrets (dashboard — you do this)

The `deploy-demo` workflow builds with the demo `NEXT_PUBLIC_*` and deploys the
app plus all three cron workers. Add these **repository secrets** (GitHub →
Settings → Secrets and variables → Actions), all pointing at the **demo**
project / this Cloudflare account:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with *Edit Workers* on this account |
| `CLOUDFLARE_ACCOUNT_ID` | This Cloudflare account ID |
| `DEMO_NEXT_PUBLIC_SUPABASE_URL` | `https://ttwsmrsgdqzjnobflihd.supabase.co` |
| `DEMO_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | demo project publishable key |
| `DEMO_NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key (or reuse prod's) |

**These must exist before the first promote (step 6a)** — the dispatched deploy
fails without them.

---

## 6. Dashboard-only steps (Cloudflare Zero Trust — you do these by hand)

**None of the below is in the repo — it is all Cloudflare dashboard work.** Do it
in the Zero Trust dashboard (`one.dash.cloudflare.com`).

1. **Zero Trust org / team domain** — if not already created, set up the Zero
   Trust organisation for this account (free plan).
2. **One-time PIN IdP** — Settings → Authentication → add **One-time PIN** as a
   login method (no external IdP needed).
3. **Self-hosted Access application** — Access → Applications → **Add an
   application → Self-hosted**:
   - Application domain: `demo.usedcarsnz.co.nz`.
   - Session duration: your call (e.g. 1 week).
4. **Allow policy (email allow-list)** — on that app, add a policy:
   - Action **Allow**, Include → **Emails** → the specific dealer/founder emails
     allowed into the demo (or **Emails ending in** a domain you control). Keep
     it a tight allow-list — this is the wall.
5. **Service token + Service-Auth policy** — machines that must reach the demo
   without a PIN: the two app-targeting cron Workers and `latency-check`.
   - Access → Service Auth → **Create Service Token** (`demo-machine`); note
     `CF-Access-Client-Id` / `CF-Access-Client-Secret` (secrets — treat like any
     key).
   - Add a second policy on the app: Action **Service Auth**, Include → **Service
     Token** → that token.
   - Set the pair as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` secrets on
     `workers/outbox-sweep` and `workers/raw-email-purge` (step 4), and export
     them locally when running `npm run latency-check`. If the email-inbound
     Worker ever POSTs to the demo app, it needs the same pair
     (`docs/infra/email-routing.md`).

### 6a. Promote the `demo` branch — one click

GitHub → **Actions** → **Promote demo** → **Run workflow** (leave `ref` as
`develop`). The action force-pushes `develop` to the `demo` branch (creating it
on first run) and then dispatches the **Deploy demo** workflow — watch both go
green. The route `demo.usedcarsnz.co.nz` (custom domain) is created by Wrangler
on the first deploy; confirm the DNS record appears for the zone.

*(Fallback, if Actions is unavailable: `git checkout -B demo develop` then
`git push -u origin demo --force` — but the action is the normal path.)*

---

## 7. Verify the wall — and the machinery

Confirm the demo is reachable only through Access, seeded numbers are labelled,
and the money-shot mechanics actually fire:

1. **Logged-out phone** (mobile data, not signed in): open
   `https://demo.usedcarsnz.co.nz` → you should get the **Cloudflare Access
   one-time-PIN page**, not the app.
2. **Authed device**: complete the PIN with an allow-listed email → the demo app
   loads, and every metric surface shows the **"Sample data"** badge.
3. **Ack email really sends**: submit one enquiry with an email address you
   control → the acknowledgment email **arrives in that inbox** within a minute.
   If it does not, `RESEND_API_KEY` is missing/wrong on the demo Worker (step 3).
4. **Cron smoke test**: hit each cron Worker's `workers.dev` URL once (each has a
   `fetch` handler that performs one run and returns the downstream status) →
   expect **2xx** from the demo endpoint. A 503 means `CRON_SECRET` mismatch; a
   302/403 to an Access page means the `CF_ACCESS_*` secrets are missing (step 4).
   Then confirm `email_outbox` is empty.
5. **Tokenless machine POST**: from a machine with no service token, `POST` to a
   demo endpoint behind Access → expect **403** (Access blocks it). With the
   service-token headers, it passes.
6. **noindex check**: `curl -sI https://demo.usedcarsnz.co.nz | grep -i x-robots`
   (once authed/edge-cached appropriately) → `X-Robots-Tag: noindex, nofollow`.
7. **Keep-alive**: manually hit the keep-alive Worker's URL once (its
   `workers.dev` URL, or wait for the 12:00 UTC cron) → a row appears in
   `public.keepalive_ping`. Confirm the demo project no longer shows an
   inactivity-pause countdown.
8. **Latency**: `npm run latency-check` (needs `DEMO_URL` + the `CF_ACCESS_*`
   pair exported) → all budgets pass.

Then do one full `DEMO_RUNBOOK.md` dry-run and capture the screen-recording
fallback. The demo is live.
