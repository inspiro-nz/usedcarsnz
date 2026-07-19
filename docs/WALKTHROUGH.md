# What you've built — a founder's walkthrough of the test harness

*Written 19 July 2026, after PROMPT-T1/T2/T3 (PRs #38/#39, #40, #41). Read this
top-to-bottom once; after that, the "Reading a red ❌" section is the part
you'll come back to.*

---

## 1. The one-sentence version

**No change can now reach `develop` if it breaks a behaviour you've proven —
including things only a real browser can see** (a broken sign-in button, a
dead enquiry form, an unprotected database table). Every pull request gets a
disposable copy of the entire product — app, database, auth, seeded data —
built from scratch inside GitHub's servers, attacked by tests, and thrown
away. Nothing cloud, nothing paid, no secrets.

## 2. The three walls

Every PR into `develop` must pass **two workflows**; a third layer runs on
your machine.

| Wall | File | What it proves | Time |
|---|---|---|---|
| **Gate** | `.github/workflows/ci.yml` | Code compiles, lints, 200+ unit tests pass (incl. the AI compliance mock suite), production build succeeds | ~1 min |
| **E2E** | `.github/workflows/e2e.yml` | The app *works in a browser* and the *database refuses what it must refuse* — details below | ~3–4 min |
| **Local** | `npm test` / `npm run test:e2e` | Same tests on your machine before you push | seconds |

The gate wall existed before. The **E2E wall is what the T-packages built.**

## 3. What the E2E wall does, step by step

When a PR opens (or you press *Run workflow*), a fresh Ubuntu runner:

1. **Boots a complete Supabase stack inside itself** (`supabase start`) —
   Postgres, Auth, storage, API. This was the old blocker: `docs/testing.md`
   used to claim CI needed a paid cloud test project. It doesn't; the stack
   is ephemeral and its keys are public dev defaults, so the repo still has
   **zero secrets**.
2. **Applies every migration + seed** (`supabase db reset`) — so the schema
   a PR ships is exactly the schema being tested.
3. **Seeds the fixtures**: the sign-in test user, the E2E dealer with its own
   dealership and listing (`npm run e2e:setup`), and the full demo dataset —
   3 dealers, 30 listings, ~130 leads (`npm run seed:demo`).
4. **Runs the SQL-boundary suite** (`tests/`, ~30 checks) — see §4.
5. **Boots the app and runs 6 Playwright specs in a real Chromium** — see §5.
6. On failure, uploads the Playwright HTML report as a downloadable artifact.

**AI safety:** no live model is reachable from CI — the Workers AI binding
doesn't exist on the runner and `ANTHROPIC_API_KEY` is never set. The AI
lanes degrade exactly as they do in a real outage (templated safe-path
replies), which is itself part of what gets tested. CI can never spend
Neurons or flake on a slow model.

## 4. The SQL-boundary suite — "enforced at the DB, not by policy", proven

`tests/db-invariants/` asserts what the database **refuses**. This is the
compliance story made executable:

- **The immutable log is immutable.** `lead_events` rejects UPDATE, DELETE
  and TRUNCATE for *every* role — the backend service role, and even the
  database owner. Tested by actually trying, plus a catalog check that the
  three guard triggers exist. This is why "first-response time, tamper-proof"
  is a claim you can make in a dealer meeting.
- **An approval cannot be forged by a bare write.** `approved` without an
  approver is impossible (CHECK constraint, even for the backend); a signed-in
  client can edit only a draft's text, never its status; `approve_draft()` is
  the single path, and it writes the status flip and the `draft_approved`
  audit event *atomically*.
- **Dealers cannot see each other.** Three clients — anonymous, dealer A,
  dealer B — each prove the *others'* enquiries, drafts, messages, events,
  aliases and metrics are invisible and unwritable, across every RLS table.
  Anon can do exactly two things: browse active listings, and enquire.

Plus `tests/demo-reset-idempotency.test.ts`: running `npm run demo:reset`
twice is safe — the second run closes nothing, re-arms nothing, and no lead's
history ever shrinks.

## 5. The browser specs

| Spec | Protects |
|---|---|
| `landing.spec.ts` | The landing page renders, no console errors |
| `marketplace.spec.ts` ×2 | `/cars` renders; a listing detail page opens |
| `signin.spec.ts` ×2 | Sign-in produces a *real* session; bad credentials fail gracefully |
| **`money-shot.spec.ts`** | **The entire demo choreography (DEMO_RUNBOOK §3)** |

The money-shot spec is the crown jewel: an anonymous "buyer" browser submits
the enquiry form on a fixture listing (with the AI disclosure visible), the
database is checked for the funnel-entry event and the automated first touch,
then a second browser signs in as the E2E dealer, finds the lead in the
inbox, sees the **"draft, not sent"** badge, edits one line of the AI draft,
clicks **Approve & send**, and the spec verifies the sent status, the
approver's identity, the preserved edit, and the timeline order:
*enquiry → first touch → approval → reply*. If any step of your pitch stops
working, the PR that broke it goes red.

## 6. Proof the walls actually detect failure

A green test suite you've never seen fail is worth nothing, so each wall was
deliberately broken once, then the break reverted:

- **T1:** changed the sign-in button's label → both sign-in specs red, unit
  gate still green (proving only a browser catches this class). Runs on PR #39.
- **T2:** added a migration dropping one immutability trigger → the migration
  applied cleanly and the invariants step went red. Runs on PR #40.

The inducing commits never landed; the job histories keep the red runs as
receipts.

## 7. What the harness found while being built

Building honest tests flushed out real issues. **These are your decisions to
make, none fixed silently:**

1. **`approve_draft()` fails open** *(security — fix soon)*. Any signed-in
   user (even a random buyer account) can approve any dealer's pending draft:
   dealer-lane drafts have no `seller_user_id`, and SQL's NULL logic makes
   the guard's `IF NOT (...)` skip its RAISE. One-line fix in a follow-up
   migration (`coalesce(... , false)`); a tripwire test (`it.fails`) is in
   place and will flip red the moment it's fixed — flip it to a plain `it`
   in the same PR.
2. **The ISR listing page 500s under a production server** *(bug)*. The
   marketplace header reads auth cookies on every page, which is fatal for
   the cached listing-detail page under `next start`. `next dev` masks it —
   that's why CI runs the dev server for now — and the OpenNext demo may be
   affected. After fixing, flip `playwright.config.ts` to the prod server.
3. **The buyer chat UI is not wired** *(demo blocker)*. `ThreadChat` (the
   labelled AI chat) exists but is mounted nowhere; `/thread/{id}` is still
   the placeholder. Runbook §3 step 3 can't happen live until it's wired.
4. **An approved reply logs `reply_sent` even if the email fails** *(minor)*.
   The ack path parks failures in `email_outbox`; the approved-reply path
   ignores the send result. Worth aligning someday.
5. **Fixed in passing** (in the T-package PRs): the seed's `auth.users` row
   broke GoTrue's admin user-listing (NULL token columns); and
   `POST /api/enquiries` 500'd *after* creating the lead on any
   non-Cloudflare runtime (CI, `next start` elsewhere) — it now degrades
   gracefully.

## 8. Reading a red ❌ on a PR

1. **`gate` red** → code/tests/build. Click through; the step log says which.
2. **`e2e` red at "DB invariants…"** → a migration or policy change weakened
   a guarantee the database must enforce. Treat as serious.
3. **`e2e` red at "Run Playwright suite"** → something a user would hit.
   Download the `playwright-report` artifact (Actions run page → Artifacts),
   unzip, open `index.html` — screenshots, traces, the failing step.
4. **`e2e` red earlier (supabase/npm steps)** → infrastructure, usually a bad
   migration file or a broken seed. The step log shows the SQL error.

A red E2E job on someone else's PR is the system working. Never merge past it.

## 9. Running everything yourself

```bash
npx supabase start                  # once; local stack (Docker)
npx supabase db reset               # apply migrations + seed
npm run e2e:setup                   # sign-in user + dealer fixture (needs env, see below)
npm run seed:demo                   # demo data (make sure env points LOCAL — see note)
npm test                            # unit + SQL-boundary suites
npm run test:e2e                    # all 6 browser specs
```

`.env.local` needs `E2E_TEST_EMAIL/PASSWORD` and (for the money shot)
`E2E_DEALER_EMAIL/PASSWORD` — any throwaway values; the fixtures are created
from them, locally only. Two gotchas: `scripts/demo-data.ts` prefers
`.env.demo` over `.env.local`, so demo-seeding *your local stack* needs the
env pinned local; and if `.env.local` has a real `RESEND_API_KEY`, local
money-shot runs will fire real (bouncing) emails at `@example.com`.

## 10. Recommended next moves

1. **Merge order: #39 → #40 → #41** (each is stacked on the previous; the
   diffs collapse as you go). Until #39 lands, `develop`'s e2e check stays
   red — it carries the pre-fix prod-server config.
2. **Make `e2e` a required check** (Settings → Branches → `develop` →
   require status checks: `e2e`) once it's green twice on trunk. A
   non-blocking E2E job rots.
3. Queue the three fixes from §7 (approve_draft guard, ISR/cookies,
   ThreadChat wiring) as small follow-up packages.
