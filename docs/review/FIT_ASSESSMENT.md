# UsedCarsNZ — Fit Assessment

**Date:** 2026-08-16
**Depends on:** `docs/review/CURRENT_STATE.md` (all file-path evidence lives there; this document adds judgement, not new facts).

## 1. Keep / Adapt / Build / Kill

### Platform & data layer

| Item | Verdict | Rationale |
|---|---|---|
| Next.js 16 / OpenNext / Cloudflare Workers stack | **Keep** | Fixed by constraint; correctly wired (SSR-heavy but ISR proven on the one page that needs it); no reason to touch. |
| Core identity/listings/RLS schema (`users`, `dealers`, `listings`, `listing_photos`, `saved_listings`) | **Keep** | Sound RLS design, every table covered, no disabled-RLS findings. |
| `lead_events` append-only audit log + `metrics_*` views | **Keep** | This is the single most strategically valuable thing in the repo — it's the literal implementation of "attribution machinery to defend renewals," built before the strategy doc that names it. Don't touch the shape, only extend it. |
| `approve_draft()` fails-open authorisation hole | **Adapt — urgently** | One-line SQL fix (`coalesce(seller_user_id = auth.uid(), false)`), already diagnosed and tracked as a founder-decision tripwire. This is not a redesign question, it's a bug with a known patch sitting unapplied. Fix before any real dealer's send-approval flow is trusted in production. |
| Manual single-row listing creation form | **Adapt** | Keep as the fallback/admin path for the long tail of dealers without exportable feeds — don't kill it, but stop treating it as the primary supply mechanism. |

### Listing/marketplace UI

| Item | Verdict | Rationale |
|---|---|---|
| Listing browse/search/filter (`app/(marketplace)/cars/page.tsx`) | **Adapt** | Not off-strategy to *own*, but off-strategy to keep *investing* in. It already exists and is cheap to maintain — repurpose it as the human-readable half of the SEO surface rather than building filter richness (saved search, comparison, etc.) that would only matter if UsedCarsNZ were competing with Trade Me on browse. |
| Listing detail page + ISR (`.../[id]/page.tsx`) | **Adapt** | This *is* the demand pillar's landing page — keep and prioritise, but the production-build cookie/ISR bug must be fixed and proven under `next start`, not just `next dev`, before it's load-bearing for organic traffic. |
| Dealer storefront page (`app/(marketplace)/dealers/[id]/page.tsx`, currently uncommitted) | **Keep** | A dealer profile page is exactly the kind of durable, locally-relevant AEO/SEO surface the strategy calls for (dealer name + suburb + stock is genuinely answerable content). Finish and commit it; add `LocalBusiness`/`AutoDealer` JSON-LD while you're in there. |
| `listing-card.tsx` (no photo pipeline yet) | **Adapt** | Photos matter more for conversion and for AI-crawler image indexing than for browse aesthetics — prioritise a basic photo pipeline once feed ingestion exists, since photos will arrive with the feed rather than being hand-uploaded per listing. |

### Lead engine

| Item | Verdict | Rationale |
|---|---|---|
| Enquiry form + Turnstile + honeypot | **Keep** | Solid, tested, fails closed correctly. |
| Email-lead ingestion from forwarded Trade Me emails (`workers/email-inbound/`, `lib/inbound/*`) | **Keep** | This is a genuinely clever bridge: it captures demand-side leads today without waiting for the supply-side feed pipeline to exist, and it's the best-tested code in the repo. Keep investing here; it de-risks the gap while feed ingestion is built. |
| Dealer leads inbox, AI-drafted reply, human-approval gate (`lib/leads.ts`, `dealer/leads/*`) | **Keep** | Directly implements the "AI drafts, human sends" trust model the strategy needs for dealer buy-in. Well tested end-to-end. |
| OTP-verified enquiry / proxy phone numbers | **Build — but defer** | Named in the strategy but absent in code, and on inspection may not be M0–M3-critical: the append-only `lead_events` log already gives dealers a credible evidence trail for renewal conversations without phone-call attribution. Build this only once a design-partner dealer specifically asks "how do I know this lead came from you," not before. |
| AI qualification chat (`lib/ai/trigger.ts`) | **Keep** | Working, guarded against prompt injection, tested. |

### Dealer tooling

| Item | Verdict | Rationale |
|---|---|---|
| Dealer conversion-metrics dashboard + CSV export | **Keep** | This is the renewal-defence artefact in dealer-facing form; already production-quality. |
| Public proof-metrics page (min-N gated) | **Keep** | Directly supports the "flat monthly, not pay-per-lead" pitch — a credible public number beats a sales claim. |
| Admin dealer-approval queue | **Keep** | Necessary, small, works. |
| AI-written listing generation | **Build** | Named as the first SaaS product in the revenue sequence; currently zero code. This is a genuine gap, not a mislabelled feature — `lib/ai/generate-draft.ts` drafts buyer-enquiry replies, not listing copy. |
| Price-positioning reports | **Build** | Zero code; needs comparable-listing data (itself gated on feed ingestion existing at scale). |

### SEO/AEO

| Item | Verdict | Rationale |
|---|---|---|
| `robots.ts` | **Adapt** | Five-minute fix: add explicit `GPTBot`/`ClaudeBot`/`PerplexityBot`/`CCBot` allow rules. The wildcard probably already lets them through, but "probably" isn't a policy — make it explicit and testable. |
| `sitemap.ts` | **Keep** | Dynamic, DB-driven, safe fallback on error — sound foundation, just needs more URLs once programmatic pages exist. |
| JSON-LD (`Car`/`Offer` on listing detail only) | **Adapt** | Functional but narrow — extend to dealer pages (`AutoDealer`), and make a conscious call on `Car` vs the strategy-named `Vehicle` type (both are schema.org-valid; `Vehicle` is the more general/AEO-common type — worth normalising for consistency with the strategy doc even if `Car` also validates). |
| Programmatic SEO page generation | **Build** | Entirely absent. This is the highest-leverage gap relative to effort — the data (listings) and the rendering pattern (ISR) already exist; what's missing is the template layer (make/model/location pages) and the AEO content grounding rules. |

### Monetisation

| Item | Verdict | Rationale |
|---|---|---|
| Billing / Stripe / subscriptions | **Build** | Zero code, but correctly sequenced last in the strategy — not a gap that should be closed before there's a paying dealer to bill. |
| Lead-cap enforcement | **Build** | Same — needed only once flat-monthly-with-cap is an actual commercial term with a real dealer. |
| F&I referral tracking | **Build (later)** | Explicitly the third revenue stream in sequence; no urgency. |

### Everything else

| Item | Verdict | Rationale |
|---|---|---|
| Marketing/pilot-acquisition landing page + `PilotForm` | **Keep** | This is the M0 dealer-acquisition tool; on-strategy, already built. |
| Auth, account management, role-aware home | **Keep** | Necessary plumbing, not a strategic question either way. |
| Cron Workers (`keepalive`, `outbox-sweep`, `raw-email-purge`) | **Keep** | Small, necessary, correctly isolated as standalone Workers. |
| Demo environment (separate Cloudflare env, its own keepalive cron just to stop a free-tier Supabase project pausing) | **Adapt — reconsider proportionality** | This is real, working infrastructure, but it's a second environment with its own deploy pipeline, cron, and runbook, maintained solo, for a product with no paying customers yet. Worth an explicit founder call on whether it earns its maintenance cost once real dealer pilots replace the need for a synthetic demo, or whether it should be retired at that point (see kill list in the roadmap). |
| E2E + DB-invariant test harness | **Keep** | Genuinely protects the one flow (enquiry → ack → draft → approve → send) that must never silently break; proportionate for a solo dev. |
| Root `.patch`/`pre-recovery-*` files | **Kill** | Debris from a past recovery incident; delete. |
| `docs/AUDIT-LEAD-ENGINE.md` | **Kill (archive)** | Superseded by current migration state; move to `docs/archive/` to stop it misleading future readers (including future AI-assisted sessions). |

## 2. Gap map

Pillars with **no code at all** against them:

- **Feed ingestion (supply)** — the foundational pillar of the whole business model. Nothing exists beyond a promise in UI copy.
- **Monetisation plumbing** — billing, lead caps, F&I referrals. Correctly sequenced last, so not alarming on its own, but worth naming so it isn't mistaken for "nearly there."
- **AI listing generation / price-positioning** — the named first SaaS product has zero code; only the second-order AI capability (reply drafting) exists.
- **Programmatic SEO/AEO page generation and explicit AI-crawler policy** — the demand pillar has a working *engine* (ISR, sitemap, one JSON-LD type) but no *content strategy* implemented on top of it.

Pillars that are **further ahead than the strategy narrative would suggest**:

- **Lead capture and attribution** — this is not a gap at all; it's the most mature, best-tested part of the codebase, and it already embodies the "evidence trail for renewals" philosophy correctly (immutable log, no per-lead invoicing hooks anywhere).

## 3. Overall call: **Adjust**. Confidence: High.

This is not a "predominantly destination-marketplace UI" codebase that needs its centre of gravity moved wholesale — that would be a **Pivot** verdict, and the evidence doesn't support it. The browse/search/filter surface exists (`app/(marketplace)/cars/page.tsx` and friends) but it's compact, it's the natural front-end for the demand pillar regardless of strategy, and it hasn't grown the expensive parts of a destination marketplace (no comparison tool, no favourites-as-feature, no reviews, no valuation tool — the audit found none of these). Meanwhile the hardest, most strategically central piece — the lead engine, with its append-only evidence trail, human-approval gate, and renewal-defence framing — is already built to a standard well beyond prototype, apparently *before* the formal strategy document that describes it. That is strong evidence the underlying instincts are already aligned with the North Star; the codebase just hasn't yet been pointed at the two pillars that are genuinely and completely missing: **feed ingestion** and **programmatic SEO/AEO content**.

**Adjust means:** stop adding to the marketplace-browsing surface, stop deferring feed ingestion, and redirect the next block of solo-developer hours at the two zero-code pillars — supply automation and AEO page generation — while continuing to harden the lead engine that's already the project's strongest asset. No component needs to be torn out.

## 4. The single riskiest assumption

**"Programmatic SEO/AEO content, built on a two-dealer, low-volume Canterbury catalogue, will generate meaningful organic or AI-crawler-referred demand before the founder has the bandwidth or dealer count to produce real content depth."** Everything downstream — the lead engine's value, the renewal-defence pitch, the flat-monthly billing model — depends on there being enough inbound demand for the evidence trail to have something to measure. With two design-partner dealers and (per the schema, no evidence of any current inventory count) likely a low three-figure listing count at best, the programmatic page count and topical depth needed to move the needle on AEO/organic is untested against actual traffic.

**Cheapest test:** this doesn't require building the pillar first. Take the listings that already exist (even hand-entered via the current manual form) and the ISR/sitemap machinery that already works today, generate the ~50 listing/model pages the roadmap targets for M2, submit the sitemap to Search Console and check AI-crawler user-agent hits in Cloudflare logs, and watch impressions/referrer data for 3–4 weeks. This validates or kills the demand-side assumption for a few hours of work, using infrastructure that's already built, well before committing to a full pSEO template system or a feed pipeline sized for national scale.
