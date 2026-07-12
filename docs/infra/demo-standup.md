# Runbook — stand up the DEMO environment (demo.usedcarsnz.co.nz)

*This is the manual, operator-only work (Chris) that the repo cannot do for
itself. The repo side is already wired: `env.demo` in `wrangler.jsonc`, the
`.github/workflows/deploy-demo.yml` deploy workflow, the `keepalive_ping`
migration, and the standalone `workers/keepalive` cron Worker. This runbook is
the CLI + dashboard steps that turn it on and point it at the DEMO Supabase
project and Cloudflare Access.*

**Demo Supabase project:** `usedcarsnz-demo` (free tier, Sydney).
**Demo app Worker:** `usedcarsnz-demo` (`wrangler.jsonc` → `env.demo`).
**Keep-alive Worker:** `usedcarsnz-demo-keepalive` (`workers/keepalive/`).
**Demo hostname:** `demo.usedcarsnz.co.nz`, behind Cloudflare Access (one-time PIN).

> **Golden rule:** every command below targets the **demo** project/Worker. Never
> run `supabase db push` / the seed against production. The seed scripts refuse
> to run unless `NEXT_PUBLIC_APP_ENV` is `local`/`demo` and the URL is not the
> prod project (`scripts/demo-data.ts` guard) — but check the ref anyway.

Windows PowerShell: run each command on its own line (no `&&`).

---

## 0. Prerequisites

- The `usedcarsnz-demo` Supabase project exists (founder created it via the
  dashboard). Note its **project ref** (the `<ref>` in `<ref>.supabase.co`) and
  its **DB password**.
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
creates the full schema including the new `keepalive_ping` table.

```
npx supabase link --project-ref <demo-ref>
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

The seed is idempotent and hard-guarded to local/demo. Point a local `.env.local`
at the **demo** project first (this file is gitignored):

```
NEXT_PUBLIC_APP_ENV=demo
NEXT_PUBLIC_SUPABASE_URL=https://<demo-ref>.supabase.co
SUPABASE_SECRET_KEY=<demo project secret key>
DEMO_SAMPLE_DATA=true
```

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

## 3. Set the demo Worker secrets (CLI — you do this)

`NEXT_PUBLIC_*` are baked in at build time by CI (step 5). The **server-side
secrets** are set once on the demo Worker and persist across deploys. Run each
in the repo root, all with `--env demo` so they land on `usedcarsnz-demo`:

```
npx wrangler secret put SUPABASE_SECRET_KEY --env demo
```
```
npx wrangler secret put TURNSTILE_SECRET_KEY --env demo
```
```
npx wrangler secret put ANTHROPIC_API_KEY --env demo
```
```
npx wrangler secret put INBOUND_HMAC_SECRET --env demo
```

`ANTHROPIC_API_KEY` and `INBOUND_HMAC_SECRET` are optional (Workers AI is the
default provider; the inbound-email lane can stay off in the demo). Paste the
**demo** project / demo credentials for each — never prod values.

---

## 4. Set the keep-alive Worker's secret (CLI — you do this)

The daily keep-alive Worker needs the demo project's secret key. From the
Worker's directory:

```
cd workers/keepalive
```
```
npx wrangler secret put SUPABASE_SECRET_KEY
```

Also set the demo project's REST base URL in `workers/keepalive/wrangler.jsonc`
(`vars.SUPABASE_URL`) — replace `https://CHANGE-ME-demo-ref.supabase.co` with
`https://<demo-ref>.supabase.co` and commit that one line.

---

## 5. Add the GitHub repo secrets and deploy (CLI/dashboard — you do this)

The `deploy-demo` workflow builds with the demo `NEXT_PUBLIC_*` and deploys both
Workers. Add these **repository secrets** (GitHub → Settings → Secrets and
variables → Actions), all pointing at the **demo** project / this Cloudflare
account:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with *Edit Workers* on this account |
| `CLOUDFLARE_ACCOUNT_ID` | This Cloudflare account ID |
| `DEMO_NEXT_PUBLIC_SUPABASE_URL` | `https://<demo-ref>.supabase.co` |
| `DEMO_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | demo project publishable key |
| `DEMO_NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key (or reuse prod's) |

Then create/point the long-lived `demo` branch at the commit to deploy (usually
`develop`) and push — the workflow builds + deploys on push:

```
git checkout -B demo develop
```
```
git push -u origin demo
```

Or trigger it manually from the Actions tab (**Run workflow** → `deploy-demo`).
The route `demo.usedcarsnz.co.nz` (custom domain) is created by Wrangler on first
deploy; confirm the DNS record appears for the zone.

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
   - Session duration: your call (e.g. 24h).
4. **Allow policy (email allow-list)** — on that app, add a policy:
   - Action **Allow**, Include → **Emails** → the specific dealer/founder emails
     allowed into the demo (or **Emails ending in** a domain you control). Keep
     it a tight allow-list — this is the wall.
5. **Service token + Service-Auth policy (only if a machine must reach the demo
   without a PIN)** — e.g. if the inbound-email Worker POSTs to the demo app:
   - Access → Service Auth → **Create Service Token**; note
     `CF-Access-Client-Id` / `CF-Access-Client-Secret` (secrets — treat like any
     key).
   - Add a second policy on the app: Action **Service Auth**, Include → **Service
     Token** → that token.
   - Add the two header values to the calling Worker's request (they are secrets;
     set via `wrangler secret put`, never commit). For the email Worker this is
     the `action.signed.headers` note in `docs/infra/email-routing.md` §Deferred.

---

## 7. Verify the wall

Confirm the demo is reachable only through Access, and that seeded numbers are
labelled:

1. **Logged-out phone** (mobile data, not signed in): open
   `https://demo.usedcarsnz.co.nz` → you should get the **Cloudflare Access
   one-time-PIN page**, not the app.
2. **Authed device**: complete the PIN with an allow-listed email → the demo app
   loads, and every metric surface shows the **"Sample data"** badge.
3. **Tokenless machine POST**: from a machine with no service token, `POST` to a
   demo endpoint behind Access → expect **403** (Access blocks it). With the
   service-token headers, it passes.
4. **noindex check**: `curl -sI https://demo.usedcarsnz.co.nz | grep -i x-robots`
   (once authed/edge-cached appropriately) → `X-Robots-Tag: noindex, nofollow`.
5. **Keep-alive**: manually hit the keep-alive Worker's URL once (its
   `workers.dev` URL, or wait for the 12:00 UTC cron) → a row appears in
   `public.keepalive_ping`. Confirm the demo project no longer shows an
   inactivity-pause countdown.

---

## Deferred (not part of demo stand-up)

- **Outbox sweep cron** and **raw-email 30-day purge cron** (`email_outbox`
  sweep in `lib/email/outbox.ts`; `purge_inbound_email_raw()`) are still unwired
  — see `docs/infra/email-routing.md` §Deferred. Flagged for Prompt 7 proper;
  out of scope here.
