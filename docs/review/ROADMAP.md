# UsedCarsNZ — Roadmap

**Date:** 2026-08-16
**Depends on:** `docs/review/CURRENT_STATE.md` and `docs/review/FIT_ASSESSMENT.md`. Verdict driving this roadmap: **Adjust** — keep the lead engine and demand-surface foundations, redirect effort at feed ingestion and AEO content, defer monetisation plumbing until there's a dealer to bill.

Effort estimates assume the constraint stated in the brief: one developer, a demanding day job, irregular hours. "Hours" below means focused solo build time, not calendar time.

---

## Immediate — before any real dealer's data flows through the system

**Fix `approve_draft()`'s fails-open authorisation bug.** This is not a milestone, it's a live vulnerability sitting in `supabase/migrations/20260707100400_ai_drafts_harden.sql:53-60` with a diagnosed one-line fix (`coalesce(v_draft.seller_user_id = (select auth.uid()), false)`) already written into the test comment at `tests/db-invariants/ai-drafts-approval.test.ts:94-126`. Right now, any authenticated user can approve and trigger sending any dealer's draft reply. This must be closed — via a new migration, not an edit to the existing one — before M0's design-partner dealers start relying on the approval gate.
- **Effort:** ~1 hour (agentic tool can write the migration and flip the tripwire test from `it.fails` to `it`; founder reviews and applies).
- **Owner:** Agentic tool drafts, founder approves and merges — this is a security fix, not a founder-only task, but it should not go out unreviewed.

---

## M0 — Validation (weeks 0–2)

**Outcome:** Two design-partner dealer agreements signed; feed formats/access confirmed for both.
**Acceptance criteria:** Two written agreements (free listings + founding-dealer tooling rate) exist; for each dealer, the actual export mechanism is confirmed in writing (DMS export format, or read access to their existing site/feed).
**Effort:** Founder-only; not a coding estimate.
**Dependencies:** None — this can start immediately, in parallel with the Immediate fix above.
**Agentic tool vs founder:** 100% founder (dealer conversations, contracts). The tool's only role is producing/refining the pilot agreement draft, which already exists at `docs/legal/pilot-agreement-DRAFT.md` per prior work — reuse, don't rebuild.

*Nothing in the current codebase changes this milestone; it was already correctly scoped as founder-only and stays that way.*

---

## M1 — Supply rail (weeks 2–6)

**Outcome:** Automated ingestion for both design-partner dealers; listings refresh at least daily without manual steps; ingestion failures alert the founder.
**Why this is the top code priority:** it's the only strategic pillar with genuinely zero code today (`docs/review/CURRENT_STATE.md` §3). Everything else in the roadmap — demand pages, lead volume, dealer tooling — is gated on real inventory existing at more than manual-entry scale.
**Acceptance criteria:**
- A scheduled job (reuse the existing standalone-Worker cron pattern from `workers/outbox-sweep` / `workers/keepalive`) pulls or receives each dealer's feed at least once daily.
- Listings are upserted into the existing `listings`/`listing_photos` schema without touching RLS or the manual-entry path (keep `createListingAction` as the fallback for dealers without an exportable feed, per the Fit Assessment's "Adapt" verdict).
- A failed ingestion run posts a founder-visible alert (reuse the cron-auth/failure pattern already proven in `lib/cron/auth.ts` and the outbox-sweep worker rather than inventing a new alerting mechanism).
- No manual CSV-pasting step required for day-to-day operation once set up.
**Recommended scope-down:** build the *simplest* mechanism that satisfies two real dealers, not a general DMS-integration platform. If both design partners can export CSV, start there — a CSV-upload-and-parse admin action is a fraction of the effort of a live DMS API integration and can always be automated further later. Only build a scheduled pull/API integration if the dealer's actual export mechanism demands it.
**Effort:** 15–25 hours for a CSV-based pipeline (parser + upsert + admin trigger + cron + alerting); add 10–15 hours per dealer if a bespoke API/scrape-with-consent integration turns out to be necessary instead.
**Dependencies:** M0 (need the actual feed format from real dealers before building the parser — do not build this speculatively against an assumed CSV schema).
**Agentic tool vs founder:** Tool can write the parser, upsert logic, cron worker, and tests almost entirely unsupervised once the founder hands it a real sample export. Founder's job is obtaining that sample and validating the parsed output against the dealer's actual stock.

---

## M2 — Demand surface (weeks 4–8, can overlap M1)

**Outcome:** Listing/model pages server-rendered and cached correctly in production; Schema.org markup validating; AI-crawler policy explicit; sitemap live; first 50 programmatic pages grounded in live stock.
**What's already done — pull forward:**
- ISR is already implemented and correct in *design* on `app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx` (`revalidate = 300`, on-demand `revalidatePath` invalidation).
- `app/sitemap.ts` already exists, dynamic and DB-driven.
- JSON-LD already exists on the listing detail page (`Car`/`Offer`).
**What must be fixed or built:**
- **Fix the production ISR bug** (`docs/review/CURRENT_STATE.md` §1) — the cookie-read in `components/marketplace/chrome.tsx` forces the page dynamic under `next start`, and this is currently masked because CI's E2E suite runs against `next dev`. Likely fix: read the auth cookie only in a client-side/edge-safe way in the header, or split the header into a static shell + a client-fetched auth sliver, so the page itself stays statically cacheable.
- **Explicit AI-crawler robots policy** — add named `GPTBot`/`ClaudeBot`/`PerplexityBot`/`CCBot` allow rules to `app/robots.ts` (currently only a generic wildcard).
- **Extend JSON-LD** to the dealer storefront page (`AutoDealer`/`LocalBusiness`) and reconcile the `Car` vs. `Vehicle` schema.org type choice deliberately.
- **Build the programmatic page template layer** — this is genuinely new work: make/model/location landing pages grounded in real stock (not thin AI filler, per the strategic constraint). The existing dynamic route + ISR pattern is the right foundation; this milestone is about generating the *content templates* on top of it, gated on M1 supplying enough real inventory to ground 50 pages honestly.
**Acceptance criteria:** Rich Results Test passes on listing, dealer, and new landing-page templates; `robots.txt` explicitly names the three AI crawlers; sitemap includes all page types; 50 live pages exist backed by real (not synthetic) stock data.
**Effort:** 10–15 hours for the ISR/cookie fix and robots/JSON-LD extension (small, mechanical); 20–30 hours for the programmatic page template system, assuming M1 has supplied real inventory to ground it in.
**Dependencies:** M1 for real inventory volume (50 honest pages need real stock, not the current handful of manually entered listings); otherwise independent.
**Agentic tool vs founder:** Almost entirely tool work — this is exactly the kind of scoped, testable, spec-driven build the existing `prompts/PROMPT-*.md` convention in this repo already handles well. Founder's role is defining which page templates are worth building (which make/model/location combinations actually exist in the Canterbury stock) and eyeballing output for "thin AI filler."

---

## M3 — Lead engine (weeks 2–10, already largely built — validate and complete, don't rebuild)

**Outcome:** Verified leads flowing to design-partner dealers with a credible evidence trail.
**What's already done — pull forward, this is the strongest asset in the codebase:**
- Enquiry capture with Turnstile bot defence, rate limiting, fail-closed behaviour.
- Email-lead ingestion from forwarded Trade Me emails, fully wired with HMAC verification and dedup.
- Append-only `lead_events` audit log, immutable at the DB layer.
- AI-drafted dealer replies with a human-approval gate before sending.
- Dealer leads inbox, conversion-metrics dashboard, and a public min-N-gated proof metric.
- Strong test coverage across unit, DB-invariant, and E2E layers (`docs/review/CURRENT_STATE.md` §3).
**What's genuinely missing:**
- OTP-verified enquiry forms and proxy phone numbers are named in the strategy but don't exist. Per the Fit Assessment, **defer** these — build only if a design-partner dealer specifically asks for stronger attribution proof. Don't build speculatively; the immutable event log likely already satisfies the "defend renewals" purpose for the first 20 leads.
- The 20-verified-lead validation target itself hasn't happened yet, because it depends on M1 (real listings to enquire about) and M0 (real dealers to receive them) — this milestone's remaining work is mostly *waiting on* the other two, not building.
**Acceptance criteria:** 20 real (not seeded/demo) verified leads delivered to the two design-partner dealers, visible in their leads inbox and metrics dashboard, with the `approve_draft()` fix already applied (see Immediate, above).
**Effort:** 5–10 hours of polish (mostly: confirm the demo-seeded assumptions don't leak into production behaviour, confirm alerting works for a real dealer's first live lead) — this is validation effort, not build effort.
**Dependencies:** M0 (real dealers), M1 (real listings for buyers to enquire about).
**Agentic tool vs founder:** Founder-heavy for this milestone specifically — the code is done; what's left is watching real dealers use it and fielding their feedback, which only the founder can do.

---

## M4 — Revenue proof (weeks 10–16)

**Outcome:** At least one dealer paying the founding tooling rate; automated monthly report; one F&I referral partnership tracked end-to-end.
**What must be built (currently zero code):**
- Minimal billing: a `dealers.plan`/`dealers.lead_cap` column plus manual or lightweight Stripe integration — do not over-build here. A solo founder with one or two paying dealers does not need a self-serve billing platform; an invoice sent manually against a tracked cap counter is enough to prove the model, with Stripe Checkout/subscriptions added only once there are enough dealers that manual invoicing becomes the bottleneck.
- Automated monthly report: reuse `lib/metrics-views.ts` and the existing CSV export (`app/api/metrics/route.ts`) — this is mostly wiring an email/PDF export around data that already exists, not new data modelling.
- F&I referral tracking: a simple `referrals` table (dealer, buyer, partner, status, settled-value) and a manual link/status-update flow is sufficient to prove the model; no need for a full partner-integration platform yet.
**Acceptance criteria:** One signed founding-dealer invoice paid; one automated monthly report delivered without manual data-pulling; one F&I referral tracked from lead to settlement in the schema.
**Effort:** 15–20 hours (mostly the lead-cap counter + manual billing hook + referral table + report automation — all additive to existing schema/metrics code, no architectural change).
**Dependencies:** M0–M3 (needs real paying dealers and real lead volume to prove against).
**Agentic tool vs founder:** Tool builds the schema/report/cap-counter; founder handles the actual sales conversation, invoice, and F&I partner relationship.

---

## M5 — Density (months 6–12)

**Outcome:** 10–15 Canterbury rooftops live; onboarding under one hour of founder time; first public Canterbury price report.
**Acceptance criteria:** 10–15 active dealers; a documented onboarding runbook proven to take under an hour of founder time per dealer (this depends entirely on how well M1's ingestion generalises beyond the two design partners — if M1 was scoped too narrowly to just their two feed formats, this is where that debt is paid); one public price report published, grounded in real accumulated `lead_events`/`listings` data.
**Effort:** Hard to estimate meaningfully this far out; order-of-magnitude 40–60 hours across onboarding tooling, feed-format generalisation, and the price-report build — but the real constraint at this stage is dealer-acquisition bandwidth, not code.
**Dependencies:** M1 (feed ingestion must generalise beyond two bespoke formats), M4 (a working revenue motion to sell against).
**Agentic tool vs founder:** Founder-dominant (10–15 individual dealer relationships); tool's role is making each additional dealer's onboarding marginal cost near zero in code.

---

## M6 — Data layer (year 2+)

**Outcome:** Price index productised; listings exposed via a clean API/MCP surface for AI assistants.
**Acceptance criteria:** unchanged from the brief's default — not worth detailing further until 18–24 months of consented data actually exists, which the current schema has only just started accumulating (`lead_events` and `metrics_*` views went live 2026-07-11, per `docs/review/CURRENT_STATE.md` §2).
**Effort/dependencies:** Not usefully estimated at this distance.

---

## Kill list

Stop maintaining or actively decide not to build:

- **Root-level `.patch`/`pre-recovery-*` files** (`marketplace-integration.patch`, `pre-recovery-staged.patch`, `pre-recovery-status.txt`, `pre-recovery-unstaged.patch`) — debris from a past recovery incident. Delete.
- **`docs/AUDIT-LEAD-ENGINE.md`** — superseded by current migration state; move to `docs/archive/` so it stops being mistaken for current fact by future readers or future AI-assisted sessions.
- **Any further investment in marketplace browse/filter richness** — comparison tools, favourites-as-a-feature, reviews/ratings, valuation calculators. None of these exist today (correctly), and none should be built; they belong to the destination-marketplace model this business explicitly isn't pursuing.
- **The separate demo Cloudflare environment and its keepalive cron**, once real dealer pilots are live. It's working infrastructure today and has value for sales demos before M0 closes, but a second environment with its own deploy pipeline, cron jobs, and runbook is real ongoing maintenance load for a solo developer. Set an explicit trigger to retire it: once two real dealers are live in production (post-M3), re-evaluate whether the demo environment still earns its keep, or whether a recorded walkthrough replaces it.
- **The "frozen" legacy `/api/lead` route** referenced in comments in `app/api/enquiries/route.ts:20-25` — if nothing still calls it, delete it rather than carrying it as a comment-documented relic.

## Definition of success at 12 months

Two Canterbury design-partner dealers have moved through the full funnel — consented feed ingestion refreshing daily without founder intervention, at least 50 programmatic listing/model/dealer pages live and indexed with verified AI-crawler traffic in the logs, a combined total well past the first 20 verified leads with an intact evidence trail, and at least one dealer paying the founding-tooling rate with a monthly report they've actually read. The `approve_draft()` class of bug has a standing pattern (migration + tripwire test) that catches the next one before it ships. The demo environment has either been retired or has an explicit reason it's still earning its keep. None of this requires the marketplace browse UI to have grown a single new feature — success at 12 months looks like the lead engine and the feed pipeline carrying the business, with the browse pages quietly doing their job as SEO landing pages in the background.
