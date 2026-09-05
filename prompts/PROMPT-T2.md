# PROMPT T2 — DB invariant + RLS deny-matrix suite (SQL-boundary proof)

You are Claude Code in `inspiro-nz/usedcarsnz`. **Read
`prompts/test-harness-design.md` first.** Requires T1 merged (`e2e.yml`
exists). One work package, one PR, branch `chore/db-invariant-tests`.

**Definition of done: a migration that drops the `lead_events` immutability
trigger — or widens any RLS policy — fails CI.**

The compliance story is "enforced at the DB, not by policy" (Strategy v5.7
§7). Today nothing in CI proves that at the SQL boundary. Think adversarially:
every test here asserts what the database **refuses**, not what it allows.

## Session invariants

Same as T1 (branch/PR discipline, frozen paths, no autonomous commits, no
secrets, local-stack only). **Migrations are additive-only and this package
adds NO migrations** — if a test exposes a real schema hole, report it as a
finding for a founder decision; do not fix schema in this package.

## Tasks

1. **Recon:** read the migrations that carry the guarantees
   (`lead_events` immutability + `REVOKE`s; `ai_drafts` CHECK +
   `approve_draft()`; the RLS policy migrations), and the existing env-gated
   integration-test pattern (`scripts/metrics-views.integration.test.ts`) —
   follow its convention for skipping when no local stack is up.
2. **`tests/db-invariants/*.test.ts`** (Vitest, env-gated to a running local
   stack), covering at minimum:
   - `lead_events`: UPDATE, DELETE, TRUNCATE each rejected — as the service
     role too, not just authenticated roles.
   - `ai_drafts`: cannot reach `status='approved'` without `approved_by` AND
     `approved_at`; direct UPDATE bypassing `approve_draft()` cannot forge an
     approval (verify what the grants actually allow and assert exactly that).
   - `approve_draft()`: approving writes the status change and the
     `draft_approved` event atomically; a failed approval writes neither.
   - RLS deny-matrix with three clients (anon, dealer A, dealer B): each
     asserts the *others'* enquiries, drafts, messages and metrics rows are
     invisible/unwritable. Enumerate the tables with RLS and cover each.
3. **Wire into CI** as an additional step of `e2e.yml` (same booted stack —
   do not start a second one) and into the local docs (`docs/testing.md`).
4. **Negative-control proof:** demonstrate the wall works the same way T1
   did — an induced weakening (e.g. trigger dropped in a scratch migration on
   a throwaway branch) turns the job red; the inducing change never lands.

## Gate

Full T1 gate, plus the new suite green locally against the local stack and in
the `e2e.yml` run. No new migrations in the diff.

## Report

Coverage table (guarantee → test file); any schema hole found (founder
decision — do not fix here); CI run URL; anything the design doc got wrong.
Stop — do not commit.
