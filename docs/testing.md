# Testing

Two layers, kept separate:

| Layer | Runner | Runs in CI? | Command |
| --- | --- | --- | --- |
| Unit / logic | Vitest (Node) | ✅ yes | `npm test` |
| Browser smoke (E2E) | Playwright (Chromium) | ❌ local only | `npm run test:e2e` |

## Unit tests (Vitest)

```
npm test
```

Runs every `*.test.ts` under `lib/` and `app/` in a Node environment (95 tests).
Playwright specs live in `e2e/` and are **excluded** from the Vitest run
(`vitest.config.ts`), so the two runners never collide.

## Browser E2E (Playwright) — local only

Playwright drives a real Chromium against a dev server it boots for you
(`webServer: npm run dev` in `playwright.config.ts`). You do **not** need to start
the app yourself.

```
npm run test:e2e        # headless run
npm run test:e2e:ui     # interactive UI mode (pick/debug specs)
```

First-time setup (already done if you ran the install once):

```
npx playwright install chromium
```

### What the smoke suite covers

- **`e2e/landing.spec.ts`** — `/` returns 200, the hero heading and the
  "Join the Founding Dealer Program" CTA render, and there are no uncaught
  exceptions or app-originated console errors on load.
- **`e2e/marketplace.spec.ts`** — `/cars` returns 200 and shows either listing
  cards or the empty state; clicking a listing opens its detail page. The detail
  test **skips** cleanly when the database has no listings.
- **`e2e/signin.spec.ts`** — the priority. Fills email + password on `/sign-in`,
  submits, and asserts a *real* authenticated outcome (the auth-gated `/account`
  page renders). It also guards the recent regression by asserting the
  `signInWithPassword is not a function` error never appears, and checks the
  negative path (bad credentials show an error banner, not a crash).

### Test user for the sign-in spec

The sign-in specs need a known Supabase auth user. Credentials are read from env
and are **never hardcoded** — the specs **SKIP** (they do not fail) when the env
vars are absent.

1. Set these in `.env.local` (`playwright.config.ts` loads it via `@next/env`
   for both the test runner and the dev server):

   ```
   E2E_TEST_EMAIL=e2e@example.com
   E2E_TEST_PASSWORD=<a-strong-password>
   ```

2. Create/repair the matching user with one command (idempotent, hard-guarded
   to the **local** stack — it refuses any non-127.0.0.1 URL):

   ```bash
   npm run e2e:setup
   ```

   Run it again any time — after every `supabase db reset` in particular,
   which wipes the user and otherwise makes the sign-in spec fail with
   "Invalid login credentials" for an environmental reason, not a code one.
   (`scripts/ensure-e2e-user.ts`; it creates the user auto-confirmed, or
   re-syncs the password to the env value if the user already exists.)

   The user must be **confirmed** (`email_confirm: true` / Auto Confirm), or
   sign-in returns "Email not confirmed" and the happy-path test fails.

> ⚠️ The default `.env.local` points at the **production** Supabase project. Prefer
> a local or a dedicated test Supabase project for E2E so you're not creating test
> users in production. Promoting E2E into CI later requires exactly that (see below).

## What CI runs automatically

`.github/workflows/ci.yml` defines one job, **`gate`**, on `ubuntu-latest` with
Node 20 (matches `next@16.2`'s `>=20.9.0` engine floor). It triggers on **every
push** and on **pull requests targeting `develop`**, and runs the same gate you
run locally, in order:

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npx vitest run`
4. `npm run build`

### GitHub repo secrets

**None are required today.** `next build` validates env lazily (never at build
time) and every marketplace route is server-rendered on demand, so the build
succeeds against an empty environment. If a future build step needs public
config, add repo secrets (Settings → Secrets and variables → Actions) and
reference them in the build step, e.g.:

```yaml
- name: Build
  run: npm run build
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
```

## Not covered (yet)

- Browser E2E in CI — **planned, designed, and prompt-ready**: see
  `prompts/test-harness-design.md` and `prompts/PROMPT-T1.md`. (The old note
  here said CI E2E needs a cloud test Supabase project; it doesn't — the
  Supabase CLI boots the full stack inside the Actions runner with no secrets.)
- Any coverage of the bounded AI layer (already has its own Vitest suite),
  registration/dealer flows, enquiry submission, and password reset.
