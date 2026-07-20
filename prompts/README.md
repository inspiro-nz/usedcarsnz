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

Shared context for all three lives in `test-harness-design.md` — each prompt
assumes the session reads it first.

## Index

- `test-harness-design.md` — the regression-harness design: what exists, the
  gaps, the target CI architecture, sequencing.
- `PROMPT-T1.md` … `PROMPT-T3.md` — the test-harness work packages, in order
  (**all three executed 19 July 2026** — PRs #38/#39, #40, #41; see
  `docs/WALKTHROUGH.md` for what they built and the findings they surfaced).
- `PROMPT-10.md` — signed-in home (role-aware landing + dealer/buyer homes).
- `PROMPT-9.md` — **executed 19 July 2026** (PRs #34–#36); kept as the format
  reference for writing new packages.

## Writing a new package

Copy the shape of PROMPT-9/T1: session invariants verbatim, a recon task that
re-verifies claims before acting, numbered tasks with file paths, an explicit
verification gate, an end-of-session report, and "stop — do not commit."
