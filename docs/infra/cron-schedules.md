# Cron schedules — standalone Workers

**Every scheduled job is its own Worker.** The OpenNext-generated app worker
(`.open-next/worker.js`) exports only a `fetch` handler — no `scheduled` — so a
cron trigger placed on it would fire into a void. Each cron therefore lives in a
standalone Worker under `workers/`, following the `workers/email-inbound`
precedent. This is the single source of truth for what runs when.

| Worker | Schedule (UTC) | Does what | Target | Secrets |
|---|---|---|---|---|
| `usedcarsnz-demo-keepalive` (`workers/keepalive`) | `0 12 * * *` (daily) | Inserts one `keepalive_ping` row so the free-tier **demo** Supabase project never pauses | Demo Supabase REST | `SUPABASE_SECRET_KEY` |
| `usedcarsnz-outbox-sweep` (`workers/outbox-sweep`) | `*/15 * * * *` (every 15 min) | POSTs `/api/cron/outbox-sweep` → `sweepOutbox()` retries failed enquiry acks | App (`TARGET_URL`) | `CRON_SECRET` (+ `CF_ACCESS_*` if behind Access) |
| `usedcarsnz-raw-email-purge` (`workers/raw-email-purge`) | `30 13 * * *` (daily) | POSTs `/api/cron/purge-raw-email` → deletes inbound raw MIME > 30 days via the storage API | App (`TARGET_URL`) | `CRON_SECRET` (+ `CF_ACCESS_*` if behind Access) |

Schedules are intentionally offset so they never collide.

## How the app-targeting crons are secured

The sweep and purge Workers are thin schedulers. The real work stays in the app
(reusing `lib/email/outbox.ts` and the Supabase storage API), behind two shared
secrets:

- **`CRON_SECRET`** — set on BOTH the app worker and each Cron Worker. The Worker
  sends `Authorization: Bearer <CRON_SECRET>`; the endpoint verifies it with a
  constant-time compare and **fails closed (503) if it is unset**. Generate with
  `openssl rand -hex 32`.
- **`CF-Access-Client-Id` / `CF-Access-Client-Secret`** — only needed when the
  target app is behind Cloudflare Access (e.g. the demo host). Set them as
  `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` secrets on the Worker and it
  forwards them as headers so it passes the Access wall. Prod is not behind
  Access, so these stay unset for the default prod `TARGET_URL`.

## Deploy / set secrets

Per Worker directory (PowerShell — one command per line):

```
cd workers/outbox-sweep
wrangler deploy
wrangler secret put CRON_SECRET
```
```
cd workers/raw-email-purge
wrangler deploy
wrangler secret put CRON_SECRET
```

On the **app** worker, set the matching secret once:

```
wrangler secret put CRON_SECRET
```

(For a demo target behind Access, also `wrangler secret put CF_ACCESS_CLIENT_ID`
and `CF_ACCESS_CLIENT_SECRET` on each Cron Worker, and point its `TARGET_URL`
var at the demo host.)

## Manual trigger (smoke test)

Each Worker also has a `fetch` handler so you can trigger it once without waiting
for the schedule — hit its `workers.dev` URL and it performs one run and returns
the downstream status code.
