# PROMPT T1 — Browser E2E in GitHub Actions (the regression wall)

You are Claude Code in `inspiro-nz/usedcarsnz`. **Read
`prompts/test-harness-design.md` first** — it is the design of record; this
package implements its T1 slice only. One work package, one PR.

**Definition of done: a PR that breaks the sign-in flow fails CI.**

## Session invariants

1. Branch `chore/e2e-ci` off `develop`; PR-only; **never commit autonomously**
   — present the diff and report, then stop.
2. Frozen paths (landing route group, `app/api/lead/route.ts`,
   `lib/security.ts`) untouched. No migrations. App code changes only if the
   webServer decision (design doc) strictly requires a config touch.
3. No secrets in any file. The local Supabase keys from `supabase status` are
   public defaults — they may appear in workflow env; nothing else may.
4. CI E2E must never target demo or prod, and must never call a live AI
   provider (mock adapter only — verify which env vars force it in
   `lib/env.ts` / `lib/ai/provider.ts` and set them in the workflow).
5. Windows/PowerShell locally: one command per line, never `&&`.

## Tasks

1. **Recon:** read `playwright.config.ts`, `e2e/*.spec.ts`,
   `scripts/ensure-e2e-user.ts`, `scripts/seed-demo.ts` (how it targets
   local), `docs/testing.md`, `.github/workflows/ci.yml`. Verify the design
   doc's workflow shape against the current `supabase/setup-cli` and
   Playwright-in-Actions docs before writing YAML — do not trust training
   data for action versions.
2. **`.github/workflows/e2e.yml`** per the design-doc shape: PRs into
   `develop` + `workflow_dispatch`; ephemeral Supabase via the CLI
   (`supabase start`, `supabase db reset`); keys read from
   `supabase status -o json` into env; throwaway `E2E_TEST_EMAIL`/`PASSWORD`
   as plain workflow env; `npm run e2e:setup`; local demo seed so the
   marketplace specs exercise real listings; `npx playwright install
   --with-deps chromium`; run the suite; upload `playwright-report/` as an
   artifact on failure. Decide dev-vs-prod server per the design doc and
   record the decision in a comment in the workflow.
3. **Concurrency + cost:** its own concurrency group keyed on the PR;
   cancel-in-progress true; job timeout ≤ 15 min.
4. **`docs/testing.md`:** replace the "Browser E2E in CI needs a test
   Supabase project" paragraph — it is wrong; document the actual mechanism
   and `npm run e2e:setup`.
5. **Prove it:** push the branch, open no PR yet — trigger via
   `workflow_dispatch` on the branch if the trigger allows, else open the PR
   and iterate until the e2e job is green. Then deliberately verify the wall
   works: state in the report how you confirmed failure-detection (e.g. the
   job's history shows a red run from an induced failure that you then
   reverted — never leave the inducing change in the final diff).

## Gate

`tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build` · local
`npx playwright test` fully green (run `npm run e2e:setup` first) · the
`e2e.yml` job green on GitHub · YAML parses. Diff touches only `e2e.yml`,
`docs/testing.md`, and (if unavoidable) `playwright.config.ts`.

## Report

Gate results incl. the CI run URL; the dev-vs-prod-server decision and why;
anything in the design doc that turned out wrong (update it in the same PR).
Recommend to the founder whether to mark the job a required check now.
Stop — do not commit beyond the reviewed branch pushes needed for CI runs.
