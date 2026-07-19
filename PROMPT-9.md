# PROMPT 9 — Documentation Truth-Up, Architecture Record & 5/30/90 Roadmap

You are Claude Code working in `inspiro-nz/usedcarsnz`. This is a **single work package**: bring every document in the repo into agreement with the actual state of `develop`, remove what is stale, add the missing architecture record, and replace the build roadmap with a dated 5/30/90-day plan that carries explicit alive/dead checkpoints. Two CI-workflow changes (Tasks 3 and 3b) and two runbook lines are the only non-doc changes permitted.

This prompt was produced from a sceptical external review (19 July 2026) that verified every finding against the repo. Do not re-litigate the findings, but **do re-verify each one exists before fixing it** (recon before action). If a finding is already fixed, say so in the report and move on.

---

## Session invariants (verbatim, non-negotiable)

1. Base branch `develop`, never `main`. Work on a new branch `chore/docs-truth-up`.
2. Frozen paths are import-only, never modified: the landing route group, `app/api/lead/route.ts`, `lib/security.ts`.
3. TypeScript strict + ESLint must stay green.
4. Every dependency must be Workers-runtime compatible (no new dependencies expected in this package).
5. Migrations are additive-only — **this package touches no migrations and no app code** except the two files named in Tasks 3 and 4.
6. Secrets via env only. Never write a real key, token, or secret value into any file.
7. Windows/PowerShell: one command per line, never `&&`-chained; git refs with braces quoted (`"stash@{0}"`).
8. The §7 compliance envelope is enforced in code and tests — nothing in this package may weaken a compliance statement; where a doc claim is stronger than what is enforced, weaken the **claim**, never invent a mechanism.
9. End-of-session report with the pass/fail gate checklist. **You never commit or push autonomously** — stage nothing; present the diff and the report and stop.

**Founder-decision rule:** several items below are strategy decisions, not fixes. For each one marked ⚠ FOUNDER DECISION, draft the text but wrap it in a clearly labelled `> ⚠ FOUNDER DECISION — draft, not adopted` blockquote. Do not present drafted strategy as settled.

---

## Task 0 — Recon (read before any edit)

Read, in this order:
`docs/UsedCarsNZ_Requirements_Strategy_v5_6.md`, `docs/infra/demo-standup.md`, `docs/infra/cron-schedules.md`, `docs/infra/email-routing.md`, `docs/LOOSE-ENDS.md`, `docs/roadmap.md`, `docs/dealer-validation-kit.md`, `docs/dealer-interviews.md`, `docs/dealer-onboarding-email.md`, `docs/PRD_v5.1.md`, `docs/marketplace-integration.md`, `docs/AUDIT-LEAD-ENGINE.md`, `DEMO_RUNBOOK.md`, `README.md`, `.github/workflows/deploy-demo.yml`, all four `workers/*/wrangler.jsonc`, `lib/email.ts` (header comment only), `docs/state fo play v2`.

Then confirm ground truth with:

```
git log --oneline -5 origin/develop
```
```
git log --oneline -3 origin/main
```
```
git rev-list --count origin/main..origin/develop
```
```
git branch -r
```

Expected ground truth (verify, don't assume): no `demo` branch exists; `main` is ~34 commits behind `develop` (at PR #18 — the current marketplace slice, privacy page and all hardening are **not** on `main`); `deploy-demo.yml` deploys the app worker plus all three cron workers; both new cron workers' `TARGET_URL` vars point at **prod** (`https://usedcarsnz.co.nz/...`), where the `/api/cron/*` endpoints are not deployed.

---

## Task 1 — Strategy document v5.7 (the truth-up patch)

Create `docs/UsedCarsNZ_Requirements_Strategy_v5_7.md` as a surgical patch of v5.6 (carry the body; edit only what is listed). Then move `docs/UsedCarsNZ_Requirements_Strategy_v5_6.md` to `docs/archive/UsedCarsNZ_Requirements_Strategy_v5_6.md`.

**1a. Strip the contamination.** v5.6 lines 1–99 are a pasted Claude-chat UI export (recents list, project memory dump including the prod Supabase ref and revenue math). The v5.7 file starts at the title block. Do not carry any of the pasted preamble forward.

**1b. New changelog table "What Changed in v5.7"** with entries for each correction below, in the established format (| # | Change | Where | Why |). Keep the v5.6/v5.5/v5.4 changelog sections beneath it.

**1c. Corrections to make in the body:**

1. **Resolve the v5.6 changelog-item-1 vs item-4 contradiction.** State plainly: as merged, the two new crons deploy via CI but target prod, where no `/api/cron/*` endpoint exists — so **the 30-day purge and outbox sweep currently run in no environment**, and the `/privacy` retention claim has no working mechanism until Task 3's fix is deployed. Reference the Task 3 change as the fix.
2. **§14 rewritten as an executable critical path.** Item 2 (secrets) must enumerate the complete app-worker secret list — `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, and optionally `ANTHROPIC_API_KEY`, `INBOUND_HMAC_SECRET` — with a warning that **without `RESEND_API_KEY` the acknowledgment email silently does not send** (`lib/email.ts` logs and returns). Add the cron-worker wiring (per-worker `CRON_SECRET`, `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`, demo `TARGET_URL` — now handled by CI per Task 3). Item 5 (verify) must include: ack email received in a real inbox, and one manual smoke of each cron worker's `workers.dev` URL returning a 2xx from the demo endpoint.
3. **Exec Summary build-state row:** change "three deployed-by-CI cron workers" to "three cron workers **deployable by CI** (the workflow has never run — no `demo` branch exists)".
4. **§14 item 9:** rewrite as "Fast-forward `main` from `develop`, then set prod secrets and deploy" — the current marketplace slice is not on `main`.
5. **Changelog item 2's absolute claim:** "No `CHANGE-ME` remains anywhere in the repo" → "in any config file" (doc references remain by design).
6. **§10.1 safety flag:** record that `.env.local` was verified pointing at local on 2026-07-14 (LOOSE-ENDS ZERO), keep the standing rule to re-verify before any `supabase db reset`.
7. **§5 baseline honesty.** The claim that email routing "captures their true current first-response time empirically per lead — not a self-report" has no mechanism: the platform sees inbound buyer enquiries but never the dealer's outbound replies. Replace with a ⚠ FOUNDER DECISION block presenting the three candidate baseline designs: (a) pre-pilot mystery-shop of each pilot dealer's own listings; (b) an ingest-only quiet period with the dealer BCC'ing replies to their lead address; (c) honest structured self-report. Also note that the "median first-response under 5 minutes" half of the gate is guaranteed by the platform's own ack and is a deployment-health check, not evidence of lift.
8. **§12.2 "no audience" row.** Add a ⚠ FOUNDER DECISION note: the email-ingestion lane has pre-installed this row's fallback as the front door, so the trigger can no longer force a pivot-or-stop; after the fork resolves, this row must be rewritten (tool-first equivalent, e.g. fewer than N pilot dealers converting to the flat plan within M months = kill) or explicitly retired.
9. **The forcing question — complete the decision rule.** In the Exec Summary and §4.2, extend the rule to cover all outcomes, with a price anchor in the question itself (use the §11.3 indicative range, e.g. "…for something like $150 a month?"). Draft (⚠ FOUNDER DECISION): 4–5 yes → tool-first; 0–1 yes → marketplace-primary posture retained and the wedge re-examined; 2–3 yes → founder decides within one week using the recorded reasons dealers gave, and the tie-break defaults to tool-first because it is the cheaper strategy to falsify next.

---

## Task 2 — Rewrite `docs/infra/demo-standup.md` to post-PR#32 reality

This is the runbook the founder executes; it must be the **single, complete, currently-true** stand-up path.

- §3 (app worker secrets): full list per Task 1c-2, each as its own `wrangler secret put NAME --env demo` line, with the RESEND warning.
- §4: delete the `CHANGE-ME` replacement instruction (done in PR #32); keep the keepalive secret step.
- Add a new section for the two cron workers: `CRON_SECRET` (same value as the app's), `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` (from the §6 service token), and note that `TARGET_URL` is supplied by CI (Task 3) so no dashboard var edits are needed — dashboard-set vars are clobbered on every deploy.
- §5: note the workflow now deploys all four workers (app + 3 crons), and replace the manual branch commands with the Promote-demo action (Task 3b) — one click creates or re-points `demo` and triggers the deploy. Sequence matters: GitHub secrets (this section) must exist **before** the first promote, or the dispatched deploy fails.
- §7 (verify): add (a) submit one enquiry and **confirm the ack email arrives** in a real inbox; (b) hit each cron worker's `workers.dev` URL once and confirm a 2xx from the demo endpoint; (c) confirm `email_outbox` is empty afterwards.
- Delete the stale "Deferred" section (it claims the crons are unwired — false since PR #32).

## Task 3 — `deploy-demo.yml`: point the CI-deployed crons at the demo (the one CI change)

In the `deploy-outbox-sweep` and `deploy-raw-email-purge` jobs, override the target at deploy time so the demo workflow ships demo-targeting crons:

```
npx wrangler deploy --config workers/outbox-sweep/wrangler.jsonc --var TARGET_URL:https://demo.usedcarsnz.co.nz/api/cron/outbox-sweep
```

(and the purge equivalent). Update the job comments: this workflow is the demo deploy, so the crons it ships target demo; the wrangler.jsonc prod default only applies to a manual `wrangler deploy` outside CI. Do not touch the wrangler.jsonc files themselves. Verify the `--var` syntax against the wrangler docs before writing it (load the `wrangler` skill if available).

## Task 3b — `promote-demo.yml`: create/point the `demo` branch from the Actions tab

The founder should never have to run local git commands to stand up or refresh the demo. Create `.github/workflows/promote-demo.yml`:

- **Trigger:** `workflow_dispatch` only, with one input: `ref` (the commit/branch to promote, default `develop`).
- **Job:** checkout the chosen ref with full history, then force-push it to the `demo` branch (`git push origin HEAD:refs/heads/demo --force`). This both creates the branch on first run and re-points it on every later run — "point `demo` at what should be live" becomes one click.
- **Permissions:** `contents: write` on the job, and `actions: write` for the dispatch step below.
- **Critical gotcha — encode it in a comment:** pushes made with the default `GITHUB_TOKEN` **do not trigger** `push`-event workflows, so this push alone will never fire `deploy-demo.yml`. After the push, the workflow must explicitly dispatch the deploy: `gh workflow run deploy-demo.yml --ref demo` (with `GH_TOKEN: ${{ github.token }}`) — `workflow_dispatch` events *are* exempt from the GITHUB_TOKEN no-retrigger rule, and `deploy-demo.yml` already has a `workflow_dispatch` trigger.
- Add the same `concurrency` group as `deploy-demo.yml`? **No** — give it its own group (`promote-demo`); the dispatched deploy run enforces its own.
- Header comment: this workflow only moves a branch pointer and dispatches the demo deploy; it can never touch prod (the deploy it triggers is `--env demo` only).

Where the docs currently instruct `git checkout -B demo develop` + `git push -u origin demo` (demo-standup.md §5, DEMO_RUNBOOK.md T-1, roadmap), replace with: **Actions tab → "Promote demo" → Run workflow** (leave `ref` as `develop`), then watch the dispatched "Deploy demo" run go green. Keep the local-git route as a one-line fallback note.

## Task 4 — `DEMO_RUNBOOK.md`: two lines

- T-30 dry-run step: after "phone → inbox → approve", add "**and confirm the ack email actually arrived in the buyer inbox on the phone** — if it did not, `RESEND_API_KEY` is missing on the demo worker; fix before the dealer arrives."
- T-1 checklist: add "confirm `email_outbox` has no stuck rows (sweep cron healthy)."

## Task 5 — Prune and reconcile the rest of `docs/`

- **Delete** `docs/state fo play v2` (superseded, misspelled, extensionless) and the empty `docs/dealer-interviews.md`.
- **`docs/LOOSE-ENDS.md`:** replace its body with a short "superseded 2026-07-19 — see `docs/roadmap.md`" stub, carrying over only PART D items not yet represented elsewhere. Its B1/B6 instructions are stale (pre-PR#32) and it now conflicts with the runbook.
- **Archive** `docs/PRD_v5.1.md` to `docs/archive/` (superseded by the strategy doc line).
- **`docs/dealer-validation-kit.md`:** delete the "Nothing is built yet and I'm not selling anything today" opener (false — there is a live demo); replace with an honest one-liner ("I've built a working version I can show you — but today I'm here to listen, not sell"). Add the forcing question **with the price anchor** as the closing question, plus a small capture grid: yes/no, price reaction, reason verbatim.
- **`docs/roadmap.md`:** replaced entirely by Task 7.
- **Sweep everything else** (`README.md`, `docs/marketplace-integration.md`, `docs/testing*.md`, `docs/infra/email-routing.md`, `docs/dealer-onboarding-email.md`, `SECURITY_IMPLEMENTATION.md`) for statements contradicting ground truth (branch state, cron wiring, "not built yet" claims, four-environment model, Anthropic-as-default). Fix what is factual; list every change in the report. Do not restyle prose that is merely old but true.

## Task 6 — Create `docs/architecture.md` (currently missing entirely)

One page, Mermaid diagrams (GitHub renders them natively), each with a two-sentence caption. Four diagrams:

1. **System context** — buyer, dealer, founder/admin; OpenNext app worker (`fetch` only); the four standalone workers (email-inbound, keepalive, outbox-sweep, raw-email-purge); Supabase (Postgres/Auth/Storage, RLS, immutable `lead_events`); Resend outbound; Cloudflare Email Routing inbound; Turnstile; Cloudflare Access in front of demo.
2. **The two AI lanes** — enquiry → deterministic templated ack (no LLM, `email_outbox` on failure) in Lane 1's send path; LLM qualify + draft → `ai_drafts` `status='draft'` → dealer approve (`approve_draft()` security-definer, atomic event) → send, in Lane 2. Mark the DB-enforced gate.
3. **Environments & deploy topology** — local (Supabase CLI, the dev environment), demo (`env.demo`, Access-gated, `deploy-demo.yml` on `demo` branch), prod (manual deploy, landing only today, `main` currently behind `develop`); which secrets live where (names only, never values).
4. **Cron wiring** — the three schedules, `TARGET_URL` resolution (CI `--var` → demo; config default → prod), `CRON_SECRET` bearer + fail-closed 503, `CF_ACCESS_*` headers through the Access wall.

State the two architectural invariants in prose: the OpenNext app worker cannot hold a `scheduled` handler (all crons are standalone workers), and `lead_events` is append-only by DB trigger (corrections are compensating events).

## Task 7 — Replace `docs/roadmap.md` with the 5/30/90 plan

Structure: a short "state of play" paragraph (what is done, what is config, what is decision), then three dated windows, then the **alive/dead gates** table. Use absolute dates from 19 July 2026.

**Next 5 days (by 24 Jul) — retire execution risk:**
1. Re-verify `.env.local` → local (two minutes, standing rule).
2. Execute the corrected `demo-standup.md` end-to-end: Supabase demo project (migrations + seed), all secrets (including `RESEND_API_KEY` + `CRON_SECRET`), Zero Trust/Access + service token, GitHub secrets, then **Actions → Promote demo** to create the `demo` branch and watch the dispatched `deploy-demo.yml` run go green.
3. Full `DEMO_RUNBOOK` dry-run **including receiving the ack email on a real phone**; capture the screen-recording fallback; `npm run latency-check` green.
4. Book the legal consult (the calendar item, not the meeting): FTA/CGA scope, finance-referral bright line post-CCCFA→FMA, `/privacy` copy, pilot agreement.
5. Book the five dealer visits from the top-25 call-first cohort.

**Next 30 days (by 18 Aug) — buy the evidence:**
1. Mystery-shopper baseline: enquire on ~10 Christchurch Trade Me/AutoTrader listings, record median first-response — the first-party stat that replaces the US studies in every conversation.
2. Hold the five dealer conversations, demo in hand, forcing question (with price) asked every time, answers recorded in the validation-kit grid.
3. **Resolve the marketplace-vs-tool-first fork** per the decision rule, within one week of conversation five. Rewrite the strategy doc around the winner (that is v5.8).
4. Legal consult held; pilot agreement drafted; `/privacy` copy to the lawyer.
5. Fast-forward `main` and deploy prod only if the fork outcome needs the public marketplace surface now.
6. Only then: decide the ad test (copy differs by fork outcome); hold the budget until decided.

**Next 90 days (by 17 Oct) — run the hard gate:**
1. Sign 5–10 pilot dealers (top-10 cohort) on the pilot agreement.
2. Enable Email Routing for pilots (verify the founder Gmail destination, DNS collision check vs Resend, catch-all → email worker); get one real redacted Trade Me lead fixture into the test suite.
3. Implement whichever baseline design the founder chose (§5) **before** switching the AI on per dealer.
4. Two-month measurement window per dealer; dashboards live for each.
5. Day-90: the §5 gate verdict — measurable lift or not. Pass → productise the proof, approach Motorcentral with numbers, introduce the flat plan on its two preconditions. Fail → §12.2: pivot or stop, on evidence.

**Alive/dead gates table** (this is the "how we know it isn't a dead idea" section — evidence, dates, and the honest failure meaning):

| Date | Gate | Alive looks like | Dead/act looks like |
|---|---|---|---|
| 24 Jul | Demo live & rehearsed | Access-gated demo, ack email received, latency green | Config still failing → fix before any dealer sees it; no strategic signal either way |
| 18 Aug | Demand signal | ≥4/5 conversations held; fork resolved; ≥1 dealer agrees to pilot unprompted | 0 dealers interested at any price → the offer, not the build, is wrong — stop and re-examine before pilot spend |
| ~17 Oct | The wedge (hard gate, §5) | Measured enquiry-to-appointment lift vs the chosen baseline in ≥half the cohort | No measurable lift in two months → §12.2 verbatim: pivot or stop; do not keep building on faith |

End the file with: the standing legal precondition (no referral revenue before the consult) and the §10.1 safety rule.

---

## Verification gate (all must pass before you write the report)

```
npx tsc --noEmit
```
```
npm run lint
```
```
npx vitest run
```
```
npm run build
```
```
git diff --stat develop
```

The diff must show **only**: `docs/**`, `DEMO_RUNBOOK.md`, `PROMPT-9.md` (if updated), `.github/workflows/deploy-demo.yml`, `.github/workflows/promote-demo.yml` (new), and deletions/moves listed in Task 5. Frozen paths untouched. If GitHub Actions linting is available (`actionlint`), run it on the workflow; otherwise re-read the YAML diff carefully.

## End-of-session report

1. Gate checklist pass/fail.
2. Every file changed/deleted/moved, one line each on why.
3. Every ⚠ FOUNDER DECISION block created, listed for sign-off.
4. Any finding from Task 0 recon that was already fixed or turned out different from this prompt's expectation.
5. Stop. Do not commit.
