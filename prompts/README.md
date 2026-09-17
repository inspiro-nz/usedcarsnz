# prompts/ — Claude Code work packages

Scoped, self-contained prompts for Claude Code sessions, one work package per
session, per the project's build discipline (Strategy v5.7 §15). Drafted in the
planning chat, reviewed by the founder, then handed to a session verbatim.

## How to run one

Open a Claude Code session in the repo and say: `Execute prompts/PROMPT-T1.md`.
The session must follow the prompt's invariants and verification gate, and
**never commits autonomously** — the founder reviews the diff and the report.

## Model routing

| Package | Model | Why |
|---|---|---|
| PROMPT-T1 — E2E in GitHub Actions | **Sonnet** | Mechanical CI wiring against a written design; low ambiguity |
| PROMPT-T2 — DB invariant + RLS suite | **Opus** | Security-boundary testing needs adversarial thinking about what RLS should *deny* |
| PROMPT-T3 — Money-shot journey E2E | **Sonnet** (Opus if the AI-lane mocking fights back) | Mostly Playwright plumbing over an already-tested flow |
| PROMPT-10 — Signed-in home | **Opus** | Role-aware routing + two new home surfaces; design judgement and a deliberate spec change to the sign-in wall |
| PROMPT-11 — ISR/header-cookies fix | **Opus** | Diagnosing why one ISR route went dynamic under `next build`; required experiments (Suspense vs client sliver) and moving E2E onto a production server |
| PROMPT-12 — M-1 close-out | **Sonnet** | Housekeeping against a written checklist: delete debris, archive a doc, one fixture fix, roadmap truth-up |
| PROMPT-14 — Vehicle data capture + AI search | **Opus** | Task 1 is a judgement call about which data points earn their capture cost; Task 2 touches privacy (VIN/plate) where this database has a known grants trap; Task 3 needs the session to argue against a vector-first instruction |

Shared context for all three lives in `test-harness-design.md` — each prompt
assumes the session reads it first.

## Index

- `test-harness-design.md` — the regression-harness design: what exists, the
  gaps, the target CI architecture, sequencing.
- `PROMPT-T1.md` … `PROMPT-T3.md` — the test-harness work packages, in order
  (**all three executed 19 July 2026** — PRs #38/#39, #40, #41; see
  `docs/WALKTHROUGH.md` for what they built and the findings they surfaced).
- `PROMPT-10.md` — signed-in home (role-aware landing + dealer/buyer homes).
- PROMPT-11 — ISR/header-cookies fix (M-1 item 4): static header shell +
  client-fetched `/api/viewer` sliver; E2E now runs on `next build && next
  start` and asserts `x-nextjs-cache: HIT`. **Executed 5 Sep 2026** — PR #47.
  The prompt was handed to the session verbatim rather than committed; the
  record is `docs/testing.md` and `docs/review/ROADMAP.md` (M-1).
- PROMPT-12 — M-1 close-out: recovery-debris removal, `AUDIT-LEAD-ENGINE.md`
  archived, E2E dealer-fixture ownership fix, roadmap truth-up, and
  `docs/review/NEXT.md` (the note a fresh session reads before starting M1).
  **Executed 5 Sep 2026** — branch `chore/m1-closeout`.
- `PROMPT-9.md` — **executed 19 July 2026** (PRs #34–#36); kept as the format
  reference for writing new packages.
- `PROMPT-14.md` — vehicle data capture (the ~30-column `listings` schema is
  written 16 columns deep; VIN/plate, structured features and normalised
  make/model do not exist at all) and the buyer NL search it unlocks. **Not
  runnable end-to-end yet:** Task 1 (the data-point register) can run today,
  Task 2 waits on the same real dealer sample export that blocks M1 /
  PROMPT-13, and Task 3 is in explicit tension with the ROADMAP kill list and
  needs a founder decision before a line of it is written. The session must
  read `docs/review/NEXT.md` first. PROMPT-13 (M1 feed ingestion) is reserved
  and still unwritten.

## Writing a new package

Copy the shape of PROMPT-9/T1: session invariants verbatim, a recon task that
re-verifies claims before acting, numbered tasks with file paths, an explicit
verification gate, an end-of-session report, and "stop — do not commit."
