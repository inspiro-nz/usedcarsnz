# Test-harness design — regression protection in CI

*Written 19 July 2026, verified against `develop`. Goal: no change can merge to
`develop` if it breaks a proven behaviour — including browser-level journeys,
not just unit logic. Built in three packages (PROMPT-T1 → T3), each
independently shippable.*

## What exists today (do not rebuild)

| Layer | What | Where it runs |
|---|---|---|
| Unit + integration | 172 Vitest tests, incl. the **compliance mock suite** (deliberately-bad output through `guardReply` via `fake-provider.ts` — the only real compliance proof) and env-gated DB integration tests (`scripts/metrics-views.integration.test.ts` pattern) | `ci.yml` gate on every push/PR |
| Static | `tsc --noEmit`, ESLint, `next build` | `ci.yml` gate |
| Browser E2E | 5 Playwright specs (`e2e/`): landing, marketplace ×2, sign-in ×2. Sign-in user is auto-seeded by `npm run e2e:setup` (`scripts/ensure-e2e-user.ts`, local-only guard) | **Local only — the gap** |
| Perf | `scripts/latency-check.ts` budgets vs the deployed demo (needs Access token) | Manual, pre-meeting |

## The gaps, in priority order

1. **E2E never runs in CI** — a PR can break sign-in or the marketplace and
   merge green. (`docs/testing.md` assumed CI E2E needed a cloud test Supabase
   project; it doesn't — the Supabase CLI boots the full local stack inside
   the Actions runner: DB, Auth, REST, Storage. No secrets, no cloud project.)
2. **DB invariants are asserted only from app code paths** — nothing in CI
   proves the `lead_events` immutability trigger, the `ai_drafts` CHECK, or
   the RLS matrix directly at the SQL boundary. A careless future migration
   could weaken them without any test noticing.
3. **The money shot has no browser test** — enquiry → ack event → dealer inbox
   → approve → send is the demo choreography and the product's core claim; it
   is covered by unit/integration tests but never as one browser journey.

## Target architecture — one new workflow, `e2e.yml`

Runs on PRs into `develop` (and manual dispatch). Shape:

```
jobs.e2e:
  supabase/setup-cli@v3  →  supabase start  →  supabase db reset   # migrations + seed.sql
  read local keys from `supabase status -o json` into env          # NEXT_PUBLIC_SUPABASE_URL,
                                                                   # publishable + secret keys
  npm ci  →  npx playwright install --with-deps chromium
  E2E_TEST_EMAIL/PASSWORD = throwaway values (workflow env, not secrets)
  npm run e2e:setup                                                # seeds the sign-in user
  NEXT_PUBLIC_APP_ENV=local npm run seed:demo                      # marketplace has listings
  npx playwright test                                              # webServer boots the app
  actions/upload-artifact (playwright-report) on failure
```

Design decisions the packages must respect:

- **Ephemeral stack, zero secrets.** The local Supabase keys are public
  defaults; nothing cloud is touched. Never point CI E2E at demo or prod.
- **Make it a required check** once green twice in a row — a non-blocking
  E2E job rots.
- **No live AI provider is reachable in CI** — CI must never spend
  Neurons/tokens or flake on a live model. *(Corrected by T1: there is no
  env-selectable mock adapter — `lib/env.ts` only allows
  `workers-ai | anthropic`; the Vitest suite mocks at module level via
  `vi.mock`, not env.)* CI safety is by absence instead: the `workers-ai`
  adapter needs the Cloudflare AI binding (absent under `next start`), and
  `anthropic` needs `ANTHROPIC_API_KEY` (never set in `e2e.yml`). **T3 must
  solve mocking for real** (its journey exercises the AI lanes): either an
  env-gated deterministic adapter added behind `getProvider()` or a seeded
  pre-armed draft that avoids live generation — decide in-package.
- **T2's SQL-boundary tests reuse the same booted stack** in the same
  workflow (a second step, not a second stack) to keep CI minutes down.
- **Keep `ci.yml`'s gate job untouched** — it is fast and battle-tested; the
  e2e job is additive.
- Dev-server (`next dev`) vs production server (`next build && next start`)
  for the Playwright `webServer` in CI: **T1 decided dev-mode** — but only
  after prod-mode earned its keep by catching a real pre-existing bug on its
  first CI run: the ISR listing-detail page 500s under a prod server
  ("Page changed from static to dynamic at runtime, reason: cookies")
  because the marketplace layout's `MarketplaceHeader` calls `getViewer()`
  (auth cookies) on every marketplace route — `next dev` semantics always
  masked this, and it likely affects the OpenNext demo deployment too
  (FOUNDER FINDING, needs its own fix PR). Until fixed, prod-mode cannot go
  green, so CI uses `next dev` (verified to boot on a credential-less
  runner: the wrangler remote-proxy failure is a logged, non-fatal
  rejection; only the AI binding dies, which no spec uses). After the ISR
  fix, flip `playwright.config.ts`'s `webServer.command` to prod under CI.

## Sequencing

- **T1** — `e2e.yml` exactly as above, existing 5 specs only. Update
  `docs/testing.md` (its "Not covered / needs a cloud project" section is now
  wrong). *Definition of done: a PR that breaks sign-in fails CI.*
- **T2** — `db-invariants/` Vitest suite against the booted stack's Postgres:
  `lead_events` UPDATE/DELETE/TRUNCATE rejected for every role; `ai_drafts`
  CHECK (`approved` requires `approved_by` + `approved_at`); `approve_draft()`
  atomicity (status change and event appear together or not at all); RLS
  deny-matrix (anon/dealer-A/dealer-B against each other's enquiries, drafts,
  messages). Wire as a step in `e2e.yml`. *Done: a migration dropping the
  immutability trigger fails CI.*
- **T3** — one Playwright journey: submit enquiry on a seeded listing →
  enquiry appears in the dealer inbox with the first-touch event → (mock)
  draft approved → status flips to sent → timeline shows the approval event.
  Plus a `demo:reset` idempotency assertion (run twice, second run closes 0).
  *Done: the demo money shot cannot silently regress.*

## Explicitly out of scope

Visual regression, load testing, cross-browser (Chromium-only stands),
latency-check in CI (needs the deployed demo + Access token — stays a
pre-meeting manual step), and any test hitting a cloud environment.
