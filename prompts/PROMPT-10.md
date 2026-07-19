# PROMPT 10 — A signed-in home that feels like the product, not the pitch

You are Claude Code in `inspiro-nz/usedcarsnz`. One work package, one PR,
branch `feat/signed-in-home` off `develop`. **Read
`prompts/test-harness-design.md` and `docs/WALKTHROUGH.md` first** — the E2E
wall now exists; changing a proven behaviour means updating its spec in the
same PR, deliberately and visibly.

**Problem (founder):** after signing in, users land on `/` — the *founding
dealer marketing page*. A dealer who just logged in to work their leads is
shown their own sales pitch. The signed-in experience should open on the
application.

**Definition of done: signing in never strands a user on the marketing page —
each role lands on a purposeful home — and the e2e wall stays green with the
sign-in spec updated to assert the NEW destination.**

## Session invariants

1. PR-only; never commit autonomously — present the diff and report, then stop.
2. **Frozen paths untouched** (landing route group incl. `app/page.tsx`,
   `app/api/lead/route.ts`, `lib/security.ts`). The landing page stays exactly
   as it is for logged-out visitors — this package changes where signed-in
   users are TAKEN, and what greets them there, never the pitch itself.
3. No migrations. No new data the RLS-scoped viewer can't already read.
4. Every existing metric/compliance surface keeps its meaning: the dealer
   dashboard's numbers, the "Sample data" badge behaviour and the AI labels
   must be byte-for-byte or better.
5. Windows/PowerShell locally: one command per line, never `&&`.

## Design intent (founder-approved direction; details are yours)

- **Dealer** signing in → land on a real dealer home: today's leads needing
  action (pending drafts first), the sub-60s first-response stat, quick links
  (inbox, listings, metrics). `/dealer` already exists — decide whether it
  BECOMES this home or a thin `/home` route composes it.
- **Buyer** → `/account` upgraded from a stub into a simple home: saved cars,
  recent enquiries with status, continue-browsing.
- **Admin** → `/admin`.
- Logged-out → `/` unchanged, forever.

## Tasks

1. **Recon first:** the post-sign-in redirect
   (`app/(marketplace)/(auth)/auth-form.tsx` → where does it navigate?),
   `getViewer()` (`lib/auth.ts` — note: dealer membership = OWNER only),
   `/dealer`, `/account`, `MarketplaceHeader` nav states, and
   `e2e/signin.spec.ts` (it currently asserts the redirect target is `/` —
   your change MUST update this assertion in the same PR).
2. Implement the role-aware landing: smallest mechanism that works (redirect
   target computed after session establishment; avoid flashing the marketing
   page). Cover the deep-link case (`?next=` style return-to must still win)
   if one exists — recon, don't assume.
3. Build/upgrade the dealer home and buyer home per the intent above. Use
   existing RLS-scoped queries and components; new queries must ride RLS the
   same way (`supabaseServer()` as the caller, never the service role).
4. **Update the wall:** `e2e/signin.spec.ts` asserts the new role-aware
   destinations (dealer fixture → dealer home; plain E2E user → buyer home).
   Extend `e2e/money-shot.spec.ts` only if the dealer-home change moves the
   inbox entry point.
5. `docs/testing.md` + `DEMO_RUNBOOK.md`: update any path/choreography that
   moved.

## Gate

`tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build` · local
`npx playwright test` fully green (run `npm run e2e:setup` first; local stack
up) · the `e2e.yml` job green on the PR. If the sign-in spec was not changed,
the package failed (the old `/` assertion cannot survive a correct
implementation).

## Report

Screens/flows changed with before→after routes; the redirect mechanism chosen
and why; spec diffs (which assertions changed and what they now prove);
anything discovered that belongs in a follow-up package (do not scope-creep
into the ISR/cookies fix or ThreadChat wiring — those are their own packages).
Stop — do not commit.
