# UsedCarsNZ — Fit Assessment

**Date:** 2026-09-04 (revision 2)
**Depends on:** `docs/review/CURRENT_STATE.md` — all file-path evidence lives there. This document adds judgement, not new facts.

## 1. Keep / Adapt / Build / Kill

### Platform & data layer

| Item | Verdict | Rationale |
|---|---|---|
| Next.js 16 / OpenNext / Cloudflare Workers | **Keep** | Fixed by constraint and correctly wired; the awkward bits (deprecated `middleware.ts`, Node-runtime `proxy.ts` incompatibility) are already understood and documented in-repo. |
| `supabasePublic()` / `supabaseServer()` / `supabaseService()` client split | **Keep** | Quietly one of the best decisions in the codebase — a cookie-less client purpose-built so public pages stay cacheable. The problem is that it is under-used, not that it is wrong. |
| Core identity/listings/RLS schema | **Keep** | Every table RLS-enabled, no disabled-RLS findings, sensible policy design. |
| `lead_events` append-only log + `metrics_*` views | **Keep** | The single most strategically valuable asset here. It is the literal implementation of "attribution machinery that defends renewals", built before the strategy document that names it, with DB-level immutability and a deliberate invoker/definer split. Extend it; do not reshape it. |
| `approve_draft()` inert authorisation gate | **Adapt — fix now** | One-line fix, already diagnosed, sitting unapplied. The human-approval boundary is the central trust claim of the AI-reply product; it is currently unenforced at the exact point it was written to be enforced. |
| `listing_photos` (dead schema, zero app references) | **Adapt** | Don't drop it — it is the right shape and photos will arrive with the feed. But recognise that until it is wired, vehicle structured data has no `image`, which materially weakens the entire demand pillar. |
| Manual single-row listing form | **Keep as fallback** | Correct long-tail path for dealers without exportable feeds. Just stop treating it as the primary supply mechanism. |

### Listing / marketplace UI

| Item | Verdict | Rationale |
|---|---|---|
| Browse/search/filter (`cars/page.tsx`) | **Adapt** | Fine to own, wrong to keep investing in. Repurpose as the human-readable half of the SEO surface; add no further filter richness. |
| Listing detail + ISR | **Adapt — fix the production bug** | This *is* the demand pillar's landing page. The `MarketplaceHeader` cookie read in the shared layout defeats ISR under a production build, and CI masks it by testing against `next dev`. Right now the project's only caching does not work where it counts. |
| Dealer storefront (`dealers/[id]`, in flight) | **Keep — and unblock it** | Strategically the best new page in the repo: dealer name, suburb, live stock, verification badge is genuinely answerable content for both search and AI assistants. But as written it ships crawler-blocked by the `Disallow: /dealer` prefix rule, absent from the sitemap, uncached, and without `AutoDealer` markup. Four cheap fixes stand between it and being the strongest AEO asset in the project. |
| `listing-card.tsx` (no photos) | **Adapt** | Deferred correctly, but sequence it with feed ingestion — photos arrive with the feed, not by hand. |
| Compliance strip (in-trade, CGA/FTA, CIN) | **Keep** | Real NZ motor-trade obligation handled properly; also a genuine trust differentiator worth surfacing in structured data later. |

### Lead engine

| Item | Verdict | Rationale |
|---|---|---|
| Enquiry form + Turnstile + honeypot + rate limit | **Keep** | Fails closed in production; tested. |
| Email-lead ingestion from forwarded Trade Me notifications | **Keep** | The cleverest thing in the repo: it captures real demand-side leads *today* without waiting on the supply pipeline, and it is the best-tested code here. It de-risks the M1 gap. |
| Dealer leads inbox + AI draft + human-approval gate | **Keep** | Implements the "AI drafts, human sends" trust model dealers need. Tested end-to-end. |
| AI qualification chat + injection guard | **Keep** | Working, guarded, tested. |
| OTP-verified enquiry / proxy phone numbers | **Build — but defer** | Named in the brief, absent in code, and on inspection not M0–M3-critical: the immutable `lead_events` trail already gives dealers a defensible evidence story. Build when a design-partner dealer actually challenges attribution, not before. Proxy numbers in particular carry real recurring cost and telephony integration for a benefit no one has yet asked for. |

### Dealer tooling

| Item | Verdict | Rationale |
|---|---|---|
| Conversion-metrics dashboard + CSV export | **Keep** | The renewal-defence artefact in dealer-facing form; already production-quality. |
| Public min-N-gated proof metric | **Keep** | A published number that refuses to display until it is statistically honest is worth more than any sales claim. Rare discipline; keep it. |
| Admin dealer-approval queue | **Keep** | Small, necessary, works. |
| AI-written listing copy | **Build** | The named first SaaS product with zero code. Note this is *not* what `lib/ai/generate-draft.ts` does — that drafts enquiry replies. Genuine gap. |
| Price-positioning reports | **Build (later)** | Needs comparable-listing density, which is gated on feed ingestion at scale. Sequencing it before M1 would produce a report grounded in a handful of hand-typed cars. |

### SEO/AEO

| Item | Verdict | Rationale |
|---|---|---|
| `robots.ts` | **Adapt — highest value-per-hour fix in the review** | Add explicit GPTBot/ClaudeBot/PerplexityBot/CCBot rules, and fix `Disallow: /dealer` so it stops blocking `/dealers/*`. Under an hour of work standing between the dealer storefronts and being indexable at all. |
| `sitemap.ts` | **Adapt** | Sound foundation. Switch to `supabasePublic()` so it can be cached rather than regenerated per request, add dealer storefront URLs, and replace the bare `limit(5000)` with pagination before it silently truncates. |
| JSON-LD (`Car`/`Offer`, listing only) | **Adapt** | Extend to dealer pages (`AutoDealer`), make a deliberate `Car` vs `Vehicle` call, and add `image` once photos exist — the missing image is the difference between markup that validates and markup that earns rich results. |
| Programmatic SEO page generation | **Build** | The highest-leverage gap relative to effort: the data, the routing pattern, and the caching primitive all exist. What is missing is the template layer and the grounding rules that keep it out of thin-AI-filler territory. |

### Monetisation

| Item | Verdict | Rationale |
|---|---|---|
| Billing / Stripe | **Build (later)** | Correctly sequenced last. Do not build a self-serve billing platform for one or two dealers — a tracked cap and a manual invoice proves the model. |
| Lead-cap enforcement | **Build (later)** | Needed only once flat-monthly-with-cap is a real commercial term with a real dealer. |
| F&I referral tracking | **Build (later)** | Third revenue stream; a simple `referrals` table will do when it arrives. |

### Everything else

| Item | Verdict | Rationale |
|---|---|---|
| Marketing/pilot landing page + `PilotForm` | **Keep** | This is the M0 dealer-acquisition tool, already built. |
| Auth / account / role-aware home | **Keep** | Necessary plumbing. |
| Cron Workers (`outbox-sweep`, `raw-email-purge`) | **Keep** | Small, necessary, correctly isolated. |
| Demo environment + `keepalive` cron | **Adapt — set a retirement trigger** | Working infrastructure with genuine pre-sales value, but it is a second environment with its own pipeline, cron, runbook, and a Worker whose entire purpose is stopping a free-tier database from pausing. That is real maintenance load for a solo developer with irregular hours. Keep it through M0–M3; set an explicit trigger to re-evaluate once real dealers are live. |
| E2E + DB-invariant harness | **Keep** | Proportionate, and it protects the one flow that must never silently break. Its one flaw — falling back to `next dev` and thereby masking the ISR bug — should be closed as part of the ISR fix, not by weakening the harness. |
| Root `.patch` / `pre-recovery-*` files | **Kill** | Recovery debris. Delete. |
| `docs/AUDIT-LEAD-ENGINE.md` | **Kill (archive)** | Superseded by current migration state; actively misleading to future readers and to future agentic sessions that treat repo docs as ground truth. Move to `docs/archive/`. |

## 2. Gap map

**Pillars with no code at all:**

- **Feed ingestion (supply).** The foundational pillar of the entire model. Nothing exists but a promise in UI copy. Everything else — page volume, lead volume, price data — is gated on this.
- **Programmatic SEO/AEO content.** The engine exists (ISR, sitemap, one JSON-LD type, a cookie-less client built for caching); the content layer does not. Compounded by an AI-crawler policy that was never written and a robots rule that actively blocks the newest public pages.
- **AI listing generation / price-positioning.** The named first SaaS product, zero code. Only the second-order AI capability (reply drafting) exists.
- **Monetisation.** Billing, caps, F&I. Correctly sequenced last, but worth naming so it is not mistaken for nearly-there.

**Pillar further ahead than the strategy narrative implies:**

- **Lead capture and attribution.** Not a gap. The most mature, best-tested area, already embodying the "evidence trail, not per-lead invoice" philosophy — there are no per-lead billing hooks anywhere, which is exactly right.

## 3. Overall call: **Adjust**. Confidence: **High**.

The evidence does not support a Pivot. A Pivot verdict would require the build to be predominantly destination-marketplace UI with the strategic core unbuilt — and the opposite is true. The browse/filter surface is compact and, tellingly, has *not* grown the expensive furniture of a destination marketplace: no comparison tool, no favourites feature, no reviews, no valuation calculator. Meanwhile the hardest and most defensible piece — the lead engine, with DB-enforced immutable attribution, a human-approval trust gate, prompt-injection guarding, and a public metric disciplined enough to refuse to display below minimum sample size — is built to a standard well past prototype, apparently before the strategy document that describes it. That is not a codebase pointed the wrong way; it is a codebase whose author already had the right instincts and has not yet spent hours on the two pillars that are genuinely empty.

What sharpens the verdict on this second pass is the *character* of the demand-side gap. It is not that the SEO/AEO foundations are wrong — they are unusually well prepared. There is a purpose-built cookie-less client for cacheability, a correct ISR configuration, a dynamic sitemap, and valid structured data. The problem is that these foundations are undermined by small, cheap, unglamorous defects: a robots rule that blocks the new dealer pages by accident of prefix matching, a layout-level cookie read that silently defeats the only ISR page in production, a sitemap that omits the newest page type, and structured data with no image because the photo table was never wired. None of these is architectural. All of them are a few hours' work. The demand pillar is not far away — it is close and quietly broken, which is a much better position than it looks from the maturity ratings alone.

**Adjust means:** stop extending the browsing surface; fix the four cheap demand-side defects so the foundations that already exist actually function; then put the next substantial block of hours into the two empty pillars — feed ingestion and programmatic page generation — while leaving the lead engine alone except to close its one security hole. Nothing needs to be torn out.

## 4. The single riskiest assumption

**That programmatic SEO/AEO, built on two dealers' worth of Canterbury stock, will produce meaningful demand before the founder has the dealer count or the hours to give it content depth.**

Everything downstream rests on it. The lead engine's value, the renewal-defence pitch, and the flat-monthly billing model all assume enough inbound demand for the evidence trail to have something to measure. With two design partners and a listing count that is currently bounded by what can be typed in by hand, the page volume and topical depth needed to register with either a search engine or an answer engine is entirely untested. The failure mode is not dramatic — it is publishing fifty honest pages and watching nothing happen, six months in, with the supply pipeline already built to serve them.

**The cheapest test does not require building the pillar.** It requires roughly a day:

1. Fix the robots rule and add the AI-crawler allows (under an hour).
2. Fix the ISR/cookie bug so pages are actually served cached (a few hours).
3. Add dealer storefronts to the sitemap and give them ISR (under an hour — they already use the right client).
4. Submit the sitemap to Search Console, then watch Cloudflare logs for GPTBot/ClaudeBot/PerplexityBot user-agent hits and Search Console for impressions over three to four weeks.

That measures whether AI crawlers and search engines will actually pick up grounded, low-volume, locally-specific inventory pages — using stock and infrastructure that already exist, before committing to a template system or a feed pipeline sized for national scale. If the crawlers come and impressions climb on fifty pages, the thesis is live and M1/M2 are worth the hours. If nothing moves in a month on properly indexable pages, that is the cheapest possible discovery that demand must come from somewhere other than organic — and it arrives before the expensive work, not after.
