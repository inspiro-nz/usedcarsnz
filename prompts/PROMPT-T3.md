# PROMPT T3 — The money-shot journey as a browser test

You are Claude Code in `inspiro-nz/usedcarsnz`. **Read
`prompts/test-harness-design.md` first.** Requires T1 merged (T2 helpful, not
required). One work package, one PR, branch `chore/e2e-money-shot`.

**Definition of done: the demo choreography (DEMO_RUNBOOK §3) cannot silently
regress — enquiry → instant ack event → dealer inbox → approve → sent is
asserted in a real browser on every PR.**

## Session invariants

Same as T1. Additionally: the AI lanes must run on the **deterministic mock
adapter** in this spec (never a live model — CI must not spend or flake); and
the spec must assert the **compliance-visible** facts, not just navigation:
the AI label is visible on the assistant thread, and the draft is not sent
until approval.

## Tasks

1. **Recon:** read `DEMO_RUNBOOK.md` §3 (the choreography this protects),
   `scripts/seed-demo.ts` and `scripts/demo-reset.ts` (what a seeded dealer
   looks like: users, listing, armed draft), the dealer inbox pages
   (`app/(marketplace)/dealer/leads*`), `POST /api/enquiries`, and how a
   dealer user signs in. Determine how to authenticate the dealer in
   Playwright (seeded dealer creds via env, or extend `ensure-e2e-user` — an
   e2e-only dealer attached to the seeded dealership; keep any new seeding
   idempotent and local-guarded like `ensure-e2e-user.ts`).
2. **`e2e/money-shot.spec.ts`** — one journey, two browser contexts:
   - *Buyer context:* open a seeded listing, submit the enquiry form
     (Turnstile: verify how local dev bypasses/test-keys it — recon, don't
     assume), see the buyer-side confirmation.
   - *Dealer context:* the enquiry appears in the inbox; the timeline shows
     the ack/first-touch event; open the (mock-generated or seeded) draft,
     edit one line, approve; status flips to sent and the approval event
     appears on the timeline. Assert the "AI assistant" label where the
     runbook points at it.
   - Assert order where it matters (ack event exists *before* any approval).
3. **`demo:reset` idempotency test** (Vitest or a spec step): run reset twice
   against the local seeded stack; the second run closes 0 leads and re-arms
   0 drafts; `lead_events` rows are never deleted (count only grows).
4. **Wire into `e2e.yml`** (same job; the stack and seed already exist from
   T1). Update `docs/testing.md` coverage list.

## Gate

Full T1 gate; whole Playwright suite green locally and in CI; the new spec
survives two consecutive CI runs (flake check) before the PR is declared
ready.

## Report

Map each DEMO_RUNBOOK §3 step to the assertion covering it (or state why one
is uncoverable); the dealer-auth approach chosen; CI run URLs; design-doc
corrections. Stop — do not commit.
