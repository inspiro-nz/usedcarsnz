# NEXT — what the next build session does (and must not do)

**Date:** 2026-09-05. **Read after** `docs/review/ROADMAP.md`. M-1 is complete (PR #45, PR #47, and this close-out).

## The single next build package: M1 feed ingestion

**Status: BLOCKED on M0.** M1 starts only when a design-partner dealer has
supplied a **real sample export** of their stock. Until that file exists in
the founder's hands, **no M1 code is to be written** — no parser, no schema
mapping, no cron worker, no "placeholder CSV format". A parser built against
an imagined schema is work that will be thrown away, and worse, it anchors
the design to columns the dealer may not have.

## What the founder must hand the next session

1. **The sample file itself** — an actual export from the dealer's system,
   with real stock in it (photos or photo URLs included if the export has
   them). Redact nothing structural; the column set is the whole point.
2. **The dealer's DMS / export name** — what produces the file (e.g. the
   DMS product, a website-platform feed, or "they email a spreadsheet"), and
   whether it is pull (URL/API) or push (email/upload).
3. **The refresh cadence the dealer can support** — how often a fresh
   export can be produced without the dealer doing manual work, and at what
   time of day. This sets the cron schedule and the "at least daily"
   acceptance test in ROADMAP M1.

With those three, M1 is largely unsupervised tool work: parse → upsert into
the existing `listings` schema (RLS untouched, manual entry stays as the
fallback) → `listing_photos` → a standalone cron Worker on the
`workers/outbox-sweep` pattern → founder-visible failure alert → tests.
Write it as `prompts/PROMPT-13.md` once the inputs above exist.

## Meanwhile (founder, not tool)

- M0: sign two design-partner dealers (`docs/legal/pilot-agreement-DRAFT.md`).
- Submit the sitemap and watch for AI-crawler hits — the demand-thesis test.
- Validate a dealer storefront in the Rich Results Test (last open M-1 tick).
