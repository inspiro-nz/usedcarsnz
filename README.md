# UsedCarsNZ

Dealer-first, AI-native used-car **co-listing** platform for New Zealand — an
[Inspiral NZ](https://usedcarsnz.co.nz) venture. Dealers keep their Trade Me
listing and add UsedCarsNZ; every enquiry gets a templated (no-LLM) first
response in under 60 seconds, is AI-qualified, and is handed to the dealer as a
warm lead — with the conversion lift measured from an immutable event log and
published.

**Start here:**

- `docs/UsedCarsNZ_Requirements_Strategy_v5_7.md` — strategy, compliance
  boundaries (§7), critical path (§14).
- `docs/architecture.md` — system, AI-lane, environment and cron diagrams.
- `docs/roadmap.md` — the current 5/30/90-day plan with go/kill gates.
- `DEMO_RUNBOOK.md` — the dealer-meeting rehearsal script.
- `docs/infra/demo-standup.md` — one-time demo environment stand-up.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
**Cloudflare Workers** via `@opennextjs/cloudflare` (not Pages, not Vercel) ·
Supabase (Postgres, Auth, Storage, RLS) · Workers AI (default) with Anthropic
as escalation · Resend (outbound email) · Cloudflare Email Routing (inbound
leads) · Turnstile.

## Local development

Local **is** the dev environment (Supabase free tier caps at two cloud
projects: prod + demo). Requires Docker for the local Supabase stack.

```bash
npx supabase start   # local Postgres/Auth/Storage at http://127.0.0.1:54321
npm install
npm run dev          # http://localhost:3000
```

`.env.local` must point at the **local** stack — never at a cloud project.
Verify before any `supabase db reset` (Strategy §10.1 safety rule).

Verification gate (run before any PR):

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

## Deploy

- **Demo** (`demo.usedcarsnz.co.nz`, Cloudflare Access-gated): GitHub →
  Actions → **Promote demo** → Run workflow. This points the `demo` branch at
  `develop` and dispatches `deploy-demo.yml` (app worker + three cron workers).
- **Production** (`usedcarsnz.co.nz`): no CI deploy by design — manual
  `npm run deploy` from `main` only.

Secrets are set once via `wrangler secret put` and persist across deploys — see
`docs/infra/demo-standup.md` for the complete list (note: `RESEND_API_KEY` is
required for the acknowledgment email to actually send).

## Repo conventions

- PR-only into `develop`; `main` is production.
- Migrations are additive-only; `lead_events` is append-only by DB trigger.
- Frozen paths (landing route group, `app/api/lead/route.ts`,
  `lib/security.ts`) are import-only.
- The §7 compliance envelope (two-lane AI, approve-to-send gate) is enforced in
  code and tests — see `docs/architecture.md`.
