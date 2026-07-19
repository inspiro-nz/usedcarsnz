# UsedCarsNZ — Roadmap (5 / 30 / 90 days)

**Written:** 19 July 2026. **This file is the current plan of record.** Build
history (Prompts 0–8, all complete) lives in Strategy v5.7 §15; architecture in
`docs/architecture.md`; the stand-up procedure in `docs/infra/demo-standup.md`.

**State of play in one paragraph:** the product is built and green in CI —
marketplace, both AI lanes with the DB-enforced approve→send gate, email
ingestion, the immutable-log metrics dashboard, demo hardening, and three cron
workers deployable by CI. Nothing that remains is application code. What
remains is **configuration** (one founder afternoon: Supabase demo project,
secrets, Cloudflare Access, one click of the Promote-demo action),
**law** (the urgent post-CCCFA→FMA consult, the `/privacy` copy, the pilot
agreement), and **decisions** (the marketplace-vs-tool-first fork, the pilot
baseline design — both drafted as ⚠ FOUNDER DECISION blocks in Strategy v5.7).

---

## Next 5 days (by Thu 24 Jul) — retire execution risk

1. **Safety first:** re-verify `.env.local` points at the local Docker stack,
   never `geappcqiihbgihcsitkj` (last verified 2026-07-14; two minutes).
2. **Stand up the demo** end-to-end from `docs/infra/demo-standup.md`
   (rewritten 19 Jul — the single complete path): demo Supabase migrations +
   seed → **all** secrets including `RESEND_API_KEY` and `CRON_SECRET` →
   Zero Trust / Access + service token → GitHub repo secrets → **Actions →
   Promote demo** → watch the dispatched deploy go green.
3. **Rehearse:** one full `DEMO_RUNBOOK.md` dry-run **including receiving the
   ack email on a real phone**; cron smoke tests return 2xx;
   `npm run latency-check` green; capture the screen-recording fallback.
4. **Book the lawyer** (the calendar item this week; the meeting can be next):
   FTA/CGA AI scope, finance-referral bright line post-CCCFA→FMA, `/privacy`
   copy, pilot agreement. No referral revenue before this consult — hard rule.
5. **Book the five dealer visits** from the top-25 call-first cohort.

## Next 30 days (by Tue 18 Aug) — buy the evidence

1. **Mystery-shopper baseline:** enquire on ~10 Christchurch Trade Me /
   AutoTrader listings; record median first-response time. This first-party
   number replaces the US studies in every conversation (zero attribution
   risk — never say "Harvard").
2. **Hold the five dealer conversations**, demo in hand: listen first, demo
   second, and ask the price-anchored forcing question verbatim before leaving
   ("…for something like $150 a month?"). Record answers in the
   `dealer-validation-kit.md` capture grid.
3. **Resolve the marketplace-vs-tool-first fork** within one week of the fifth
   conversation, per the decision rule in Strategy v5.7 (Exec Summary — covers
   4–5 / 2–3 / 0–1 yes outcomes). Write it down, dated. The strategy rewrite
   around the winner is v5.8. The fork does not roll to a sixth version.
4. **Legal consult held**; pilot agreement drafted (data-processing +
   AI-labelled-response authorisation + 30-day retention + the chosen baseline
   design); `/privacy` copy to the lawyer.
5. **Choose the pilot baseline design** (§5 ⚠ FOUNDER DECISION: mystery-shop
   per dealer / BCC quiet period / labelled self-report) — before any pilot
   dealer goes live.
6. **Prod deploy only if the fork outcome needs it** (fast-forward `main` from
   `develop`, set prod secrets, `npm run deploy`). **Ad budget stays held**
   until the fork is resolved — the copy differs materially by outcome.

## Next 90 days (by Fri 17 Oct) — run the hard gate

1. **Sign 5–10 pilot dealers** (top-10 cohort) on the lawyer-reviewed pilot
   agreement.
2. **Wire Email Routing for pilots:** verify the founder forward Gmail as a
   Cloudflare destination (confirm-link email), run the DNS collision check
   against Resend, catch-all → email-inbound worker. Get one real **redacted**
   Trade Me lead email into `workers/email-inbound/fixtures`.
3. **Capture each dealer's baseline** per the chosen design **before**
   switching the AI on for them.
4. **Two-month measurement window** per dealer; every pilot dealer watches
   their own live dashboard.
5. **Day-90 verdict** — the §5 hard gate: measurable enquiry-to-appointment
   lift vs baseline, or not. **Pass** → productise the proof, approach
   Motorcentral with numbers (a conversation with proof beats one with a
   promise), introduce the flat plan on its two preconditions. **Fail** →
   Strategy §12.2 verbatim: pivot or stop. Do not keep building on faith.

---

## Alive/dead gates — how we know this isn't a dead idea

Each gate has a date, what "alive" looks like, and what failure honestly means.
No gate can be passed by enthusiasm; each requires an artifact or a number.

| Date | Gate | Alive looks like | Dead / act looks like |
|---|---|---|---|
| **24 Jul** | Demo live & rehearsed | Access-gated demo up; ack email received on a real phone; latency + cron smoke green; dry-run done | Config still failing → fix before any dealer sees it. This gate carries **no strategic signal** either way — it only retires execution risk |
| **18 Aug** | Demand signal | ≥4 of 5 conversations held; forcing question answered ×5; fork resolved and written down; ≥1 dealer volunteers for the pilot unprompted | **0 dealers interested at any price** → the offer, not the build, is wrong. Stop; re-examine the wedge before any pilot or ad spend. 2–3 lukewarm → proceed, but the founder decision on the fork must still be made and dated |
| **~17 Oct** | The wedge (hard gate, §5) | Measured enquiry-to-appointment lift vs the chosen baseline in ≥half the pilot cohort, from the immutable log | **No measurable lift in two months** → the wedge has failed. §12.2 verbatim: pivot or stop. The published-proof strategy has no honest fallback claim without this number |

Ongoing tripwires (checked monthly, from Strategy §12.2): NZME announces a
self-built automotive venture → accelerate Motorcentral + pilot; Trade Me ships
sub-minute AI response **and** publishes sale-rate metrics → the feature moat is
gone, pivot to the compliance/human-approval angle or seek acquisition;
Motorcentral refuses integration → reassess whether CSV import can sustain
adoption at all.

---

## Standing rules (do not schedule these away)

- **No referral money changes hands before the legal consult** — the
  CCCFA→FMA deferral anchor is gone (Strategy §7.3); the finance line is the
  primary revenue plan and it is blocked until a lawyer clears the
  advice-vs-referral bright line, FSPR registration and DRS membership.
- **`.env.local` is re-verified before every `supabase db reset`** (Strategy
  §10.1). One reset against a prod-pointing config destroys production.
- **Seeded numbers always carry the "Sample data" badge and the spoken
  disclaimer** (`DEMO_RUNBOOK.md`) — presenting fabricated metrics as measured
  is direct Fair Trading Act exposure.
