# UsedCarsNZ — Roadmap

**Date:** 2026-09-04 (revision 2)
**Depends on:** `docs/review/CURRENT_STATE.md`, `docs/review/FIT_ASSESSMENT.md`. Driving verdict: **Adjust** — keep the lead engine, repair the cheap demand-side defects, then build the two empty pillars (feed ingestion, programmatic pages). Defer monetisation until there is a dealer to bill.

Hours are focused solo build time, not calendar time — the binding constraint is a demanding day job and irregular evenings, so milestones are sized to be completable in sittings rather than requiring long uninterrupted runs.

Revision 2 adds **M-minus-1**, a new front-loaded milestone. The second audit pass found that several demand-side foundations already exist but are quietly broken or blocked, and repairing them is both far cheaper than the milestones they precede *and* a prerequisite for testing the riskiest assumption in the plan. Doing this first is the highest-leverage change to the sequence.

---

## M-1 — Unbreak what already exists — ✅ DONE (PR #45, PR #47, close-out PR from `chore/m1-closeout`; 4–5 Sep 2026)

**Outcome:** the demand-side foundations that already exist actually function, and the security hole in the approval gate is closed.

Five items, none architectural, all cheap — all landed:

1. ✅ **Fix the `approve_draft()` authorisation gate.** **Done — PR #45 (`6fe65b9`).** New migration adds `coalesce(..., false)` so the dealer-lane check can no longer evaluate to SQL `NULL`; the tripwire at `tests/db-invariants/ai-drafts-approval.test.ts` flipped from `it.fails` to a positive `it`. The same PR (`db8ae8f`) closed a second hole found on the way: `anon` held an explicit INSERT grant on the immutable `lead_events` log via default privileges.
2. ✅ **Fix the robots rule that blocks the dealer storefronts.** **Done — PR #45.** `app/robots.ts` no longer prefix-blocks `/dealers/[id]`.
3. ✅ **Add explicit AI-crawler rules** for GPTBot, ClaudeBot, PerplexityBot and CCBot. **Done — PR #45.**
4. ✅ **Fix the ISR/cookies bug.** **Done — PR #47 (`fix/isr-header-cookies`, PROMPT-11).** Header split into a static shell plus a client-fetched auth sliver (`GET /api/viewer`, RLS-scoped, booleans only; a `<Suspense>` boundary was tested and does not help without PPR). `playwright.config.ts` / `e2e.yml` now run `next build && next start`; `e2e/marketplace.spec.ts` asserts `x-nextjs-cache: HIT` on the second request for listing detail and dealer storefront — fails on the pre-fix `develop`, passes on the branch.
5. ✅ **Give the dealer storefront the same treatment as listing detail:** `revalidate = 300` ISR with on-demand invalidation from `dealer/actions.ts` (PR #47); storefront URLs in `app/sitemap.ts`, `AutoDealer` JSON-LD, `sitemap.ts` on `supabasePublic()` (PR #45). **One founder tick outstanding:** validate a storefront URL in the Rich Results Test (manual, not code).

**Close-out (PROMPT-12, `chore/m1-closeout`):** recovery debris deleted, `docs/AUDIT-LEAD-ENGINE.md` archived, the E2E dealer fixture now re-points `owner_user_id` at the current `E2E_DEALER_EMAIL` instead of silently keeping its first owner, and `docs/review/NEXT.md` records what M1 is gated on.

**Acceptance criteria (met, except the manual Rich Results check):** the tripwire test passes as a positive assertion; `robots.txt` names the four AI crawlers and no longer disallows `/dealers/`; the E2E suite runs against `next start` and passes; a dealer storefront URL appears in `sitemap.xml` and returns a cache hit on second request.

**Next:** see `docs/review/NEXT.md` — M1 feed ingestion, blocked until a design-partner dealer supplies a real sample export.

---

## M0 — Validation (weeks 0–2, runs in parallel with M-1)

**Outcome:** two design-partner dealer agreements in writing; feed formats and access obtained from both.
**Acceptance criteria:** two signed agreements (free listings + founding-dealer tooling rate); for each dealer, the actual export mechanism confirmed in writing — DMS name and export format, or permissioned access to their own site's feed.
**Dependencies:** none. Start immediately; it gates M1 entirely and is the only work that cannot be accelerated by tooling.
**Agentic tool vs founder:** 100% founder. The tool's only contribution is the pilot agreement, which already exists at `docs/legal/pilot-agreement-DRAFT.md` — reuse it rather than rebuilding.

**Note on sequencing:** M0 and M-1 are deliberately concurrent. M-1 is solo evening work; M0 is dealer conversations. Neither blocks the other, and running them together means the demand-thesis test (below) can start the moment M-1 lands rather than waiting on contracts.

---

## M1 — Supply rail (weeks 2–6, ~15–25 hours)

**Outcome:** automated ingestion for both design partners; listings refresh at least daily with no manual steps; failures alert the founder.
**Why it is the top build priority after M-1:** it is the only strategic pillar with genuinely zero code, and every downstream milestone — page volume for M2, lead volume for M3, comparable density for price-positioning — is gated on inventory existing beyond hand-typed scale.

**Scope discipline — the most important call in this milestone:** build the simplest thing that serves two real dealers, not a general DMS integration platform. If both partners can export CSV, a parse-and-upsert path plus a scheduled trigger is a fraction of the cost of live API integrations, and can be automated further later. Build a bespoke integration *only* if a dealer's actual export mechanism leaves no choice.

**Acceptance criteria:**
- A scheduled job (reuse the standalone-Worker cron pattern proven in `workers/outbox-sweep`) refreshes each dealer's inventory at least daily.
- Listings upsert into the existing `listings` schema without touching RLS and without disturbing the manual-entry path, which stays as the long-tail fallback.
- A failed run produces a founder-visible alert — reuse the existing cron-auth and failure patterns rather than inventing new alerting.
- Wire `listing_photos` as part of this milestone: photos arrive with the feed, and until they exist the vehicle structured data has no `image` and the demand pillar is running with one hand tied.
- Zero manual steps in day-to-day operation.

**Effort:** 15–25 hours for a CSV pipeline including photos and alerting; add 10–15 hours per dealer if a bespoke API integration proves necessary.
**Dependencies:** M0 — do not build the parser speculatively against an assumed schema. Wait for a real sample export.
**Agentic tool vs founder:** the tool can write the parser, upsert logic, cron worker, photo handling, and tests largely unsupervised once handed a real sample file. The founder obtains that file and validates parsed output against the dealer's actual stock — the one step that cannot be automated, because only the dealer knows whether the data is right.

---

## M2 — Demand surface (weeks 4–10, overlapping M1)

**Outcome:** Schema.org markup validating across all page types; sitemap complete; first 50 programmatic pages live and grounded in real stock.

**Pulled forward into M-1** (do not re-plan these): robots policy, AI-crawler rules, ISR correctness, dealer-page caching and markup, sitemap coverage.

**Remaining work is the genuinely new part — the programmatic page template layer:** make/model, make/model/location, and body-type/price-band landing pages, generated from real inventory. The routing pattern and caching primitive already exist; what is missing is the template system and, more importantly, the **grounding rules** that keep these pages out of thin-AI-filler territory. The strategic constraint is explicit on this point, and it is also a practical one: fifty pages of generated prose about cars that are not in stock is precisely the pattern search engines penalise. Every page must be backed by live listings, and pages should disappear or degrade when stock does.

**Acceptance criteria:** Rich Results Test passes on listing, dealer, and landing-page templates; 50 live programmatic pages exist, each backed by at least one real active listing; every page type appears in `sitemap.xml`; no page renders generated prose about inventory that does not exist.
**Effort:** 20–30 hours for the template system, assuming M1 has supplied real inventory to ground it.
**Dependencies:** M-1 (foundations must work first, or these pages inherit the same defects at fifty times the scale); M1 for inventory volume — fifty honest pages need real stock.
**Agentic tool vs founder:** near-entirely tool work. The founder decides which template axes are worth generating — which make/model/location combinations actually exist in Canterbury stock — and reads a sample for filler.

**The demand-thesis test rides on this milestone.** After M-1 lands, submit the sitemap and watch Cloudflare logs for AI-crawler user agents and Search Console for impressions over three to four weeks, *before* committing the 20–30 hours to the template layer. If properly indexable pages produce no crawler interest in a month, that is the cheapest available signal that demand must come from somewhere other than organic — and it arrives before the expensive work rather than after it.

---

## M3 — Lead engine (weeks 2–12 — largely built; validate, do not rebuild)

**Outcome:** verified leads flowing to design-partner dealers with an intact evidence trail.

**Already built — pull forward:** enquiry capture with Turnstile, rate limiting and fail-closed behaviour; email-lead ingestion from forwarded Trade Me notifications with HMAC verification and dedup; the append-only `lead_events` trail; AI reply drafting behind a human-approval gate; the dealer leads inbox; the conversion-metrics dashboard; the min-N-gated public proof metric; and strong test coverage across unit, DB-invariant, and E2E layers.

**Genuinely outstanding:**
- The `approve_draft()` fix — moved to M-1, because it should not wait.
- OTP verification and proxy phone numbers: **defer deliberately.** Named in the brief, absent in code, and not required to deliver or defend the first twenty leads — the immutable event log already provides a defensible attribution story. Proxy numbers in particular add recurring telephony cost and a live integration for a benefit no dealer has yet asked for. Build when a design partner actually challenges attribution.
- The twenty-verified-leads target itself, which is gated on M0 and M1 rather than on code.

**M3 correction (2026-09-11/12, uncommitted on `develop`):** "AI reply drafting behind a human-approval gate" was true in isolation but the buyer-facing side of the loop was quietly non-functional — none of this shipped as a separate milestone, it's the lead engine finally doing what M3 already claimed it did. Found and fixed, all with live tests against the real Workers AI binding (not mocks) and DB reads, not just eyeballing UI:
- **The buyer thread page (`/thread/[id]`) was a static placeholder**, never wired to the real `messages` table or the already-built `ThreadChat` component — the ack email advertised "follow the conversation here any time" and it was fiction. Now loads real history and renders `ThreadChat`; a poll every 6s (`GET /api/thread/[id]/messages`) picks up a dealer reply sent while the buyer has the tab open.
- **Buyer chat turns were never persisted.** `handleChatTurn` (`lib/ai/trigger.ts`) saved only the AI's replies to `messages`, never the buyer's own message — so the dealer lead page showed the AI's half of the conversation with no way to see what the buyer had actually said. Now inserts a `sender: 'buyer'` row and logs the previously-defined-but-unused `buyer_message_received` event.
- **`sendApprovedReply()` (`lib/leads.ts`) never wrote to `messages` at all** — an approved-and-sent AI draft reached the buyer by email but never appeared in the conversation thread either side could see. Fixed with the missing insert.
- **No dealer-initiated reply existed** — the portal could only approve/edit an AI-generated draft when the AI itself decided one was needed; once that single draft was used, there was no way to send a follow-up. Added `sendDealerReply()` (stages the dealer's free text as a `pending` `ai_drafts` row and runs it through the *same* `approve_draft()`/`sendApprovedReply()` gate — preserving the "dealer free text reaches `messages` only via the approved-draft path" DB invariant from migration 11, not a new bypass) plus a compose UI on the lead page for whenever no AI draft is pending.
- **The qualify-lane chatbot re-asked already-answered topics** (financing asked 3x, trade-in 2x, confirmed live against `@cf/meta/llama-3.3-70b-instruct-fp8-fast`) because topic selection was left to the model's own re-read of a text summary each turn. Fixed by making topic progression deterministic in `lib/ai/trigger.ts` (`nextMissingTopic()`, computed from the DB row, not model judgment) — the model now only phrases the question and extracts the answer. A same-scenario replay after the fix captured all 5 qualification fields with zero repeats.
- **The guard (`lib/ai/guard.ts`) had no category for fabricated non-vehicle business claims.** Surfaced by testing an alternative model (IBM Granite 4.0-h-micro, evaluated for the qualify lane and rejected — see below) which invented "we have a dealership right here in town" for a buyer's stated location. Added an `unapproved_business_claim` category narrowly scoped to unverifiable proximity-to-buyer claims (not generic location statements — a plain `approved_facts.address` disclosure still passes, with a test asserting so).
- **Model choice for the qualify lane, evaluated and rejected:** `granite-4.0-h-micro` and `glm-4.7-flash` are ~17x cheaper than the current model with larger context windows and are explicitly marketed for instruction-following, per `wrangler ai models list --json` against the live catalog. Granite was tested head-to-head on the same conversation and hallucinated the business claim above; the current `llama-3.3-70b-instruct-fp8-fast` did not. Staying on it — this isn't a complex-reasoning task, so the fix that mattered was the deterministic topic engine, not a bigger/different model.

**Acceptance criteria:** 20 real (not seeded) leads delivered to the two design partners, visible in their inbox and metrics dashboard, with the approval-gate fix applied.
**Effort:** 5–10 hours of validation polish — confirming demo-seeded assumptions do not leak into production behaviour, and that alerting fires on a real dealer's first live lead. This is watching, not building.
**Dependencies:** M0 (real dealers), M1 (real stock to enquire about).
**Agentic tool vs founder:** founder-heavy. The code is done; what remains is watching real dealers use it and responding to what they say.

---

## M4 — Revenue proof (weeks 12–20, ~15–20 hours)

**Outcome:** at least one dealer paying the founding tooling rate; monthly report automated; one F&I referral tracked end to end.

**Scope discipline:** do not build a self-serve billing platform for one or two dealers. A `dealers.plan` / `dealers.lead_cap` column, a cap counter, and a manually issued invoice proves the commercial model. Stripe Checkout arrives when manual invoicing becomes the bottleneck — which, at two to five dealers, it will not be. The monthly report is mostly wiring email or PDF delivery around `lib/metrics-views.ts` and the existing CSV export, not new data modelling. F&I referral tracking needs a simple `referrals` table (dealer, buyer, partner, status, settled value), not a partner-integration platform.

**Acceptance criteria:** one founding-dealer invoice issued and paid; one monthly report delivered without manual data-pulling; one F&I referral tracked from lead to settlement in the schema.
**Effort:** 15–20 hours, all additive to existing schema and metrics code.
**Dependencies:** M0–M3.
**Agentic tool vs founder:** tool builds the cap counter, referral table, and report automation; the founder does the sales conversation, the invoice, and the F&I partnership.

---

## M5 — Density (months 6–12)

**Outcome:** 10–15 Canterbury rooftops live; onboarding under one hour of founder time; first public Canterbury price report.
**Acceptance criteria:** 10–15 active dealers; a documented onboarding runbook demonstrably completable in under an hour per dealer; one public price report grounded in real accumulated data.
**The dependency that actually matters:** how well M1's ingestion generalises beyond two bespoke formats. If M1 was scoped tightly to two dealers' exports — which is the right call at the time — this milestone is where that debt is repaid, and the generalisation work should be planned honestly rather than discovered.
**Effort:** order-of-magnitude 40–60 hours across onboarding tooling, feed generalisation, and the price report. The real constraint at this stage is dealer-acquisition bandwidth, not code.
**Agentic tool vs founder:** founder-dominant (10–15 relationships); the tool's job is driving each additional dealer's marginal onboarding cost toward zero.

---

## M6 — Data layer (year 2+)

**Outcome:** price index productised; listings exposed via a clean API/MCP surface for AI assistants.
Not usefully detailed at this distance. Worth noting only that the data clock started on 2026-07-11 when `lead_events` and the `metrics_*` views went live — the 18–24 months of consented data this milestone assumes is accruing from that date, not from project start.

---

## Kill list

- ✅ **`docs/AUDIT-LEAD-ENGINE.md`** — superseded by current migration state and actively misleading. **Moved to `docs/archive/` with an ARCHIVED banner (PROMPT-12).** Root-level `.patch` / `pre-recovery-*` debris deleted in the same PR.
- **`/api/lead` is NOT a relic — do not delete it.** Rev-2 of this list said "if nothing calls it, delete it". Recon (PROMPT-12) shows `components/PilotFormClient.tsx:139` — the landing page's Founding Dealer form — POSTs to `/api/lead`. It is the live landing-form endpoint and stays **frozen** with the rest of the landing route group and `lib/security.ts`. The comments at `app/api/enquiries/route.ts:20` reference it as the security pattern that `/api/enquiries` mirrors, which is accurate.
- **All further marketplace browse/filter richness** — comparison tools, favourites-as-feature, reviews, valuation calculators, finance calculators. None exist today, which is correct. None should be built; they belong to the destination-marketplace model this business is explicitly not pursuing.
- **The demo environment and its keepalive Worker — on a trigger, not immediately.** It has real pre-sales value through M0–M3. But a second environment with its own deploy pipeline, cron jobs, runbook, and a Worker whose only purpose is preventing a free-tier database from pausing is ongoing load for a solo developer. Set the trigger explicitly: once two real dealers are live in production after M3, decide whether it still earns its keep or whether a recorded walkthrough replaces it.

## Definition of success at 12 months

Two Canterbury design-partner dealers have been through the whole funnel: consented inventory refreshing daily without the founder touching it, at least fifty programmatic pages live and genuinely indexed with AI-crawler hits visible in the logs, comfortably more than the first twenty verified leads delivered with an intact evidence trail, and at least one dealer paying the founding tooling rate against a monthly report they have actually read. The approval gate is enforced, the E2E suite runs against a production build so the next ISR-class bug cannot hide behind `next dev`, and the demo environment has either been retired or has an articulated reason to persist. None of this requires the browse UI to have gained a single feature — success looks like the feed pipeline and the lead engine carrying the business, with the marketplace pages quietly doing their real job as landing pages for search and answer engines.
