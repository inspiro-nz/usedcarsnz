
/
Car Trading Website
Car Trading Website



How can I help you today?




Pinned
Hide
Building platform foundation for demo
Jun 21
Recents
Prompting fable for project review
5 hours ago
Project status review and cleanup strategy
4 days ago
Handover review and next steps
7 days ago
Technical blueprint for usedcarsnz PoC demo
7 days ago
Validating build status with Claude extension
Jul 11
Setting up local LLM testing with Ollama
Jul 11
GitHub Actions and Cloudflare troubleshooting with Claude Code
Jul 11
Code review for security and efficiency
Jul 11
Free platform promotion and social media strategy
Jul 7
Evaluating used car marketplace UI for market disruption
Jul 7
Website architecture and Claude prompts for dealership demo
Jul 6
Requirements strategy alignment review
Jul 5
Supabase authentication best practices
Jul 5
Localhost signup issue
Jul 5
Integrating new items into existing website
Jul 5
UsedCarsNZ database schema and lead events migrations
Jul 4
Building a website from project information
Jul 3
UsedCarsNZ project foundation setup with Next.js 15 and Cloudflare
Jun 21
Registering usedcarsnz as a company
Jun 20
Gumtree partnership dead, but NZME threat remains reshaped
Jun 20
Show more
Instructions
Add instructions to tailor Claude’s responses

Memory
Only you
Purpose & context Chris is a solo founder in Christchurch, NZ building UsedCarsNZ — a dealer-first AI-native used-car co-listing platform operating under Inspiral NZ Ltd (GitHub org: inspiro-nz, repo: inspiro-nz/usedcarsnz, primary branch: develop). The venture is bootstrapped, pre-revenue, built alongside a day job, with a hard infrastructure ceiling under NZD $100/month. Core strategic wedge: A published, auditable sub-60-second first-response time to buyer enquiries, enforced by an AI lead engine, producing a measurable conversion lift for dealers. The proof metric — not AI features or lower cost — is the moat. Positioning is explicitly as a Trade Me co-listing partner, never a replacement. Key strategic constraints and principles: The templated instant acknowledgment is never an LLM call; the 60-second SLA is LLM-independent All vehicle-specific, CGA/warranty, and finance-opinion AI output exists only as dealer-approved drafts, enforced at the DB level — the approvedraft() security-definer function prevents any free-text from being sent without explicit dealer approval Speed-to-lead statistics (21x / "78%") originate from MIT/InsideSales (Oldroyd), not Harvard Business Review — "Harvard" must never appear in dealer-facing material The CCCFA-to-FMA regulatory transfer completed July 2026, making the prior legal deferral anchor moot; a legal review is now required before any finance referral arrangement proceeds Seeded demo metrics must carry a visible "Sample data" badge and spoken disclaimer to avoid Fair Trading Act exposure Target milestone: Demo environment (demo.usedcarsnz.co.nz) live and Cloudflare Access-gated for dealer meetings, supporting five Christchurch pilot dealer conversations. Exit goal: Trade sale to a buyer such as Trade Me, NZME, or AutoTrader. --- Current state Build completion (as of latest audit against develop branch): Prompts 0–6 are genuinely complete: 20 migrations, immutable leadevents append-only ledger (enforced by DB trigger), two AI lanes with a two-adapter provider layer (Workers AI as default, Anthropic as escalation), dealer inbox with approve-to-send gate enforced by DB state machine, email ingestion worker with five fixtures, conversion metrics dashboard, CI gate Prompt 7 is ~40% complete — seven deliverables not yet shipped: scripts/latency-check.ts, DEMORUNBOOK.md, /privacy page, client-side image compression, page-level ISR, email-outbox sweep cron, and raw-email 30-day purge cron Demo environment status: Not yet live. The docs/infra/demo-standup.md and docs/infra/email-routing.md runbooks are written and correct but have not been executed. Dependency chain: Supabase demo project must be created first → Zero Trust configured → GitHub Actions secrets set → scripts/latency-check.ts can close remaining Prompt 7 gate items. Supabase free tier caps at 2 active projects per org (prod + demo fills the cap; local dev via CLI is the correct dev environment). Active safety flag: Local dev may still be pointing at the production Supabase project — supabase db reset must only ever be run against the local stack. Open strategic fork: Marketplace-primary vs. tool-first positioning is deliberately unresolved pending five dealer conversations, with a forcing question added to each conversation script. --- On the horizon Execute docs/infra/demo-standup.md founder dashboard steps to stand up the demo Supabase project and Cloudflare Access Zero Trust (one-time PIN auth at no cost) Run PROMPT-8.md Claude Code session to close the seven remaining Prompt 7 deliverables Five Christchurch dealer conversations to resolve the marketplace-primary vs. tool-first strategic fork Legal review for finance referral arrangements (now urgent post July 2026 CCCFA-to-FMA regulatory transition) Motorcentral DMS integration (identified as existential production dependency; CSV import is the accepted MVP bridge) --- Key learnings & principles Build order is sacrosanct: leadevents immutable pipeline must exist before any UI depending on it; migrations are additive-only and never edited after application Recon before action: Every Claude Code session reads the repo state before making changes; frozen paths (landing route group, app/api/lead/route.ts, lib/security.ts) are import-only, never modified One work package per session with a hard verification gate before merge: Gate is tsc --noEmit, lint, vitest run, next build, supabase db reset (local only), git diff --stat develop confirming frozen paths untouched Claude Code vs. Claude chat division of labour: Claude Code is the implementation agent; Claude chat provides strategic direction, scoped briefs, and gate review. All instructions to Claude Code are written as prompts to Claude Code — not as founder task lists Compliance is structurally enforced, not policy-stated: The two-lane AI boundary (generic auto-sent vs. draft-only requiring approval) is enforced in DB state machine, not just documented Evidence discipline: No unsubstantiated results claims in dealer-facing or ad copy; Fair Trading Act exposure is a live concern OpenNext architectural constraint: OpenNext-generated workers export only fetch with no scheduled handler — all cron jobs must be standalone Workers, not app-worker crons enquiries.listingid is nullable: Email-lane leads have no listing and must be excluded from per-listing conversion denominators Competitor intelligence: DriveChat (Trade Me Motors chat widget) is a third-party human-agent service, not a native Trade Me AI feature, and publishes no auditable conversion metrics — does not satisfy kill criterion 12.2. Trade Me's CarExpert NZ joint venture (new-car content/reviews) is a separate product. NZME exited its Gumtree partnership but remains open to its own venture --- Approach & patterns Windows/PowerShell environment: One command per line — never chain with &&; git refs with braces must be quoted (e.g., "stash@{0}") Waterfall/requirements-first with numbered work packages and explicit phase gates; versioned strategy documents maintained in-project (UsedCarsNZRequirementsStrategyv5.4 is current, superseding v5.3) Surgical edits over full rewrites on strategy documents; version history preserved in-document Scoped Claude Code prompts drafted in planning chat, reviewed before handoff; Chris approves diffs and gate results before committing — the agent never commits autonomously PR-only workflow to develop; full verification gate required before merge Direct communication preferred: Honest assessment over validation; evidence discipline applied to all claims --- Tools & resources Stack: Next.js 16.2 (App Router), React 19, TypeScript strict, Tailwind v4, Cloudflare Workers via @opennextjs/cloudflare (not Pages), Supabase (Postgres, Auth, Storage, RLS, pgvector), no ORM — direct SQL migrations and Supabase JS client AI providers: Cloudflare Workers AI (default, @cf/-prefixed hosted models only), Anthropic claude-haiku/claude-sonnet (escalation path), deterministic mock adapter (test-suite default), Ollama llama3.1 8b (local dev/validation only — never production); abstracted behind lib/ai/provider.ts External services: Resend (outbound email), Cloudflare Email Routing with postal-mime (inbound lead parsing), Cloudflare Access Zero Trust Free (demo environment gating), Cloudflare Turnstile (CAPTCHA) Tooling: Vitest, Playwright, ESLint 9 flat config, Zod typed env loading, GitHub Actions CI Key env vars for Cloudflare Worker: NEXTPUBLICSUPABASEPUBLISHABLEKEY and SUPABASESECRETKEY (new sbpublishable/sbsecret format — legacy JWT keys not in use) Supabase project ref (prod): geappcqiihbgihcsitkj Demo site target: demo.usedcarsnz.co.nz

Last updated 6 days ago

Context
3% of project capacity used
Search mode

UsedCarsNZ_Requirements_Strategy_v5_6.md
541 lines

md



usedcarsnz_claude_code_build_plan_v1_1.md
669 lines

md



UsedCarsNZ_Requirements_Strategy_v5_3.md
553 lines

md



Research Report.md
91 lines

md


UsedCarsNZ_Requirements_Strategy_v5_6.md


**USEDCARSNZ**
 
Product Requirements & Go-to-Market Strategy
 
An Inspiral NZ Venture | usedcarsnz.co.nz
 
*Version 5.6 | July 2026 | Confidential*
 
*Supersedes v5.5. A build-state patch. PR #32 (merged to `develop` 15 July 2026, commit `e929943`, CI gate green — tsc/lint/vitest/build) closes the last code gap flagged in v5.5: `deploy-demo.yml` now ships the two cron workers (`deploy-outbox-sweep`, `deploy-raw-email-purge`), and both per-founder placeholders are filled (keepalive → demo Supabase `ttwsmrsgdqzjnobflihd`, confirmed not prod; email-inbound forward → a founder Gmail alias). **The engineering phase is over — no code remains for the demo.** This version updates §10, §14 and §15 accordingly; the critical path is now 100% founder/dashboard plus the urgent legal consult. Everything else — the wedge, the co-listing posture, the §7 compliance envelope, the revenue framing, and the still-unresolved marketplace-vs-tool-first fork — is carried unchanged from v5.5.*
 
---
 
# What Changed in v5.6 (and Why)
 
| **#** | **Change** | **Where** | **Why** |
| --- | --- | --- | --- |
| **1** | **The last code gap is closed (PR #32, `develop`, 15 Jul 2026, CI green).** `deploy-demo.yml` now carries `deploy-outbox-sweep` and `deploy-raw-email-purge` jobs mirroring `deploy-keepalive`. Failed-ack retry and the 30-day raw-email purge now ship on demo-branch deploys. | §14, §15 | v5.5 §14 item 1 said "deploy the two cron workers." Done. The `/privacy` page's retention claim now has a job behind it (once the demo branch deploys). |
| **2** | **Both per-founder placeholders filled.** `workers/keepalive/wrangler.jsonc` → demo Supabase `ttwsmrsgdqzjnobflihd` (verified NOT prod `geappcqiihbgihcsitkj`); `workers/email-inbound/wrangler.jsonc` → a founder Gmail forward alias. No `CHANGE-ME` remains anywhere in the repo. | §14 | These were the two "founder value" placeholders. Removing them from the worry list. |
| **3** | **Engineering phase declared over.** Prompts 0–8 complete and green in CI; the cron-deploy gap closed. **No code remains for the demo.** The critical path is now purely configuration (Supabase + Cloudflare + secrets + branch) and the urgent legal consult. | Exec Summary, §14, §15 | The founder asked for the loose ends tidied. They are. What's left is an afternoon of dashboards and a lawyer, not a build. |
| **4** | **Two known wrinkles logged, both deferred by choice.** (a) The two crons default `TARGET_URL` to **prod** but ride the demo-branch CI (the only CI in the repo); re-deploys are idempotent, so this is fine for now — split to a prod-cron workflow later if cleaner semantics are wanted. (b) The founder forward Gmail must still be **verified as a Cloudflare Email Routing destination** (Cloudflare emails a confirm link) before inbound forwarding works — pilot-only, not needed for the demo (`docs/infra/email-routing.md`, §14 item 12). | §14, §15 | Recorded so neither surprises a future session. Neither blocks the demo. |
 
*Nothing in v5.6 moves a gate, a strategy, or a compliance boundary. The marketplace-vs-tool-first fork remains open across four versions now — still correctly resolved by the five dealer conversations (§4.2), which have not yet happened.*
 
---
 
# What Changed in v5.5 (and Why)
 
| **#** | **Change** | **Where** | **Why** |
| --- | --- | --- | --- |
| **1** | **Prompt 7 is now COMPLETE (Prompt 8 close-out merged).** Re-audit of `develop`, 14 July 2026, confirms all seven previously-missing items shipped: `scripts/latency-check.ts` (with Cloudflare Access service-token headers + a fail-fast guard), `DEMO_RUNBOOK.md`, the `/privacy` page (linked from the footer, marked placeholder-pending-lawyer), `lib/images/compress.ts` (zero-dependency `createImageBitmap`/canvas → WebP ~0.8, ≤200KB), listing-detail ISR (`revalidate = 300` + `generateStaticParams`), `X-Robots-Tag: noindex` on demo, and a populated `docs/roadmap.md`. | §9, §14, §15 | v5.4 recorded the ~40% gap. The gap is closed. The engineering phase is effectively over; the remaining critical path is founder/dashboard and legal, not code. |
| **2** | **The two crons became standalone workers — a better pattern than briefed.** `workers/outbox-sweep` and `workers/raw-email-purge` each POST an authenticated app endpoint (`/api/cron/outbox-sweep`, `/api/cron/purge-raw-email`, guarded by `verifyCronRequest`) on a schedule, keeping the tested logic in the app. This correctly honours the OpenNext constraint that the app worker exports only `fetch` and cannot hold a `scheduled` handler. | §10, §15 | Records the architectural decision so a future session doesn't "consolidate" the crons back onto the app worker and break them. |
| **3** | **One code-adjacent gap remains: the cron workers are not deployed by CI.** `deploy-demo.yml` deploys the app worker and `keepalive` only. Until `outbox-sweep` and `raw-email-purge` are added to the workflow (or deployed manually once), failed acks never retry and raw buyer emails never purge at 30 days. **The purge is a Privacy Act item — the `/privacy` page's retention claim is not yet true in production.** | §14, §15 | A privacy page that promises a 30-day purge which no deployed job performs is exactly the Fair Trading / Privacy Act exposure the project's evidence discipline exists to prevent. Fixing this is §14 item 1. |
| **4** | **Everything else carried unchanged from v5.4.** The wedge, co-listing posture, §7 compliance envelope, revenue framing, the urgent CCCFA→FMA legal consult, the corrected MIT/InsideSales attribution, the retired four-environment model, and the still-unresolved marketplace-vs-tool-first fork all stand. The v5.4 changelog below remains the record for those. | — | v5.5 is a build-state patch. It moves no gate, no strategy, and no compliance boundary. |
 
*Note: the marketplace-vs-tool-first fork is now unresolved across three versions (v5.3, v5.4, v5.5). This is not fresh drift — v5.4 attached the forcing function (the third dealer-conversation question, §4.2). v5.5 simply notes the clock: the five conversations are the trigger, and they have not yet happened. Resolve on their evidence, not in a chair.*
 
---
 
# What Changed in v5.4 (and Why)
 
| **#** | **Change** | **Where** | **Why** |
| --- | --- | --- | --- |
| **1** | **Build state corrected to audited reality.** Prompts 0–6 complete: 20 migrations, immutable `lead_events`, both AI lanes with `guardReply` and a two-adapter provider layer, dealer inbox with the approve→send gate, the email-ingestion worker with five fixtures, conversion metrics + demo seed, CI gate. **Prompt 7 is ~40% complete** — seven deliverables never shipped (see §15). | §10, §14, §15 | v5.3 said "WP-0–3 built." That is now four prompts out of date. A strategy document that understates the build by this margin actively misleads every future session. |
| **2** | **The Prompt 7 gap named explicitly.** Missing: `latency-check.ts`, `DEMO_RUNBOOK.md`, the `/privacy` page, client-side image compression, page-level ISR, the email-outbox sweep cron, the raw-email 30-day purge cron. Two of these (privacy page, purge cron) are **compliance** items, not performance items. | §14, §15 | The demo cannot be rehearsed without a runbook, and the email lane processes buyer PII with no privacy page and no enforced retention. Naming the gap is the point of this document. |
| **3** | **Legal consultation promoted to URGENT.** The CCCFA→FMA enforcement transfer completed in July 2026. v5.3's split — "FTA/CGA near-term, finance-referral deferrable to the CCCFA/FMA transition" — has lost its deferral anchor. The transition has happened. | §7.3, §11, §13, §14 | The finance-referral bright line was deferred *pending* a regulatory event that has now occurred. It is no longer deferrable. Add the Privacy Act 2020 email-lane posture to the same conversation. |
| **4** | **AI provider default corrected.** Built as a two-adapter abstraction: `workers-ai` (default, `@cf/`-prefixed hosted models only, free Neuron allocation) with `anthropic` as a config-flip escalation. v5.3 §10 described Anthropic as the default. Both adapters are tested; a deterministic mock adapter and an optional Ollama adapter also exist for the test suite. | §10 | v5.3's §10 was written before build-plan v1.1 moved the default to Workers AI. The table has been stale in the opposite direction from the one v5.3 fixed. |
| **5** | **Speed-to-lead attribution corrected AGAIN.** v5.3 §3.1 still lists a "Harvard Business Review (2011)" bullet. Per the project's own evidence discipline, the transferable speed-to-lead figures originate from **MIT/InsideSales (Oldroyd)**, not HBR. The HBR bullet is removed rather than merely footnoted. | §3.1, §13 | v5.3 added an attribution-discipline warning *and left the misattributed bullet in place directly above it*. A caveat under an error is not a correction. This is the third context in which this misattribution has surfaced. |
| **6** | **Dev environment: local-only is CORRECT, not a gap.** Supabase's free tier caps at 2 active projects per organisation; prod + demo fills it. Local via the Supabase CLI **is** the dev environment. The four-environment target model in v5.3 §10.1 is retired as a near-term goal. | §10.1 | This was recorded as a loose end. It is not one. Removing it from the worry list is worth a line in the document. |
| **7** | **The marketplace-primary vs tool-first fork: flagged for the SECOND time, deliberately unresolved.** v5.3 named it and held marketplace-primary as the default. v5.4 does the same — but records that deferring it twice is itself a decision, and names the forcing function: the five dealer conversations will answer it empirically. | Exec Summary, §1, §12.2 | Naming an unresolved decision twice without a forcing function is drift. v5.4 supplies the forcing function rather than a founder-chair answer. |
 
---
 
# Executive Summary
 
New Zealand's used-car classifieds market is dominated by a single platform that has raised dealer pricing aggressively and faces no meaningful competition. UsedCarsNZ is a dealer-first, AI-native **co-listing** platform: dealers keep their Trade Me listing and **add** UsedCarsNZ, where every enquiry gets a first response in under 60 seconds, is qualified, and is handed to the dealer as a warm lead — with the resulting conversion lift measured and published.
 
| **The Problem** | Trade Me Motors holds near-total share and restructured dealer pricing upward in 2024 (reported per-listing rises from ~30% to ~105%), plus a further 5% from 1 July 2025. Dealer frustration is real and documented. |
| --- | --- |
| **The Opportunity** | Trade Me's motors vertical earned NZD $125.3M in FY2023/24 (filed accounts). Frustrated dealers are looking for an alternative they can add without leaving. |
| **The Wedge** | A demonstrated, published higher rate of sale, driven by sub-minute speed-to-lead and qualification — the one advantage a solo operator can deliver and a big dealer's slow sales desk cannot. |
| **Why Now** | NZME signed an MOU with Gumtree in May 2025, then confirmed at its February 2026 results it is no longer pursuing that partnership — though it remains open to launching its own venture. The funded-competitor path lost its technology partner; the window is open but not guaranteed. |
| **Highest-Leverage (and Existential) Move** | A single Motorcentral DMS integration gives access to the NZ independent-dealer base with no re-keying. Without inventory flow, the venture's economics break. |
| **Build State (v5.6)** | **Prompts 0–8 complete, CI green, last code gap closed (PR #32).** Engineering phase over — no code remains for the demo. Working product: marketplace, both AI lanes, dealer inbox with the approve→send gate, email ingestion, conversion dashboard, performance hardening, demo runbook, privacy page, three deployed-by-CI cron workers. Remaining: a Supabase + Cloudflare configuration afternoon, then the urgent legal consult and the five dealer conversations. |
| **90-Day Goal** | Stand up the Access-gated demo. 5 dealer conversations. Onboard first 5–10 Christchurch dealers. Then prove a measurable conversion lift across a pilot cohort within two months. |
 
> **Strategic tension — flagged for the second time (v5.4).** Two build decisions reshaped the entry strategy: the email-ingestion lane means the proof engine runs on the dealer's **existing Trade Me traffic** with zero marketplace volume, and the live landing page is positioned as a dealer-facing speed-to-lead tool, not a marketplace. Together these mean §12.2's designated *fallback* — "standalone dealer SaaS tool" — has arrived early as a candidate **front door**. v5.3 flagged this and held marketplace-primary. v5.4 does the same, and adds the honest note that **deferring twice is itself a decision.**
>
> **The forcing function.** This will not be resolved in a chair. It will be resolved by the five dealer conversations (§4.2). Ask each dealer, explicitly: *"Would you pay for this as a tool that answers your existing Trade Me leads, even if no buyer ever visits our site?"* If four of five say yes, the answer is tool-first and the strategy is rewritten around it. If they will only pay for reach, the answer is marketplace-primary. **Do not run the Meta ad test until this is answered**, because the ad copy differs materially between the two.
 
---
 
# 1. Elevator Pitch
 
*UsedCarsNZ is the platform that helps New Zealand dealers sell cars faster. Co-list alongside Trade Me at low cost; every enquiry gets an instant, qualified response; and we publish the proof that cars listed here convert better.*
 
## For Dealers
 
*"Don't leave Trade Me — add us. Every lead gets answered in under a minute, qualified, and handed to you warm. We measure the lift and show you the numbers. The price is flat and simple."*
 
## For Buyers
 
*"Get an instant answer on any car, any time. Ask in plain English, and a real, qualified conversation starts in seconds."*
 
**Note on AI search:** natural-language search remains a buyer-facing convenience, but it is not the differentiator — incumbents can and will bolt it on. It supports the experience; it is not the wedge. *(Status: deferred, not built. pgvector/embeddings remain Phase 2/3.)*
 
---
 
# 2. Market Context & Opportunity
 
## 2.1 The Monopoly Problem
 
Trade Me Motors holds dominant share of NZ online automotive classifieds. It is trusted — partly because paid listings deter fraud — but it is expensive for dealers and has faced no real competition for years. Package level alone now drives search prominence, and the 2024 restructure removed 'Super Features' and rebundled prominence into higher-priced tiers.
 
| **Factor** | **Detail** |
| --- | --- |
| **Trade Me motors revenue** | NZD $125.3M in FY2023/24 (up from $110.3M), from filed accounts — the reliable figure. Platform revenue, NOT total market size. |
| **Total market size** | ~USD $306–323M (analyst/company estimate, e.g. Mordor Intelligence) — indicative, not audited. |
| **2024 pricing restructure** | Reported per-listing rises from ~30% (with temporary loyalty rebate) up to ~105% for top-ranking Ultimate; one case moved a dealer from $11,505 to $16,399/month. Further 5% rise from 1 July 2025 (later planned increases paused). |
| **Facebook Marketplace** | Dominant free channel for sub-$15k cars. High volume, low trust. Not a direct competitor — buyers use both. |
| **AutoTrader NZ** | Majority-owned by Japan's Optimus Group (Dec 2023). ~40,000–44,000 cars. The clearest 'second portal' but minimal traction. |
| **Need A Car / DriveSouth** | Need A Car (~25k vehicles) is Limelight/Motorcentral-owned. DriveSouth is regional (Allied Press). |
| **Turners** | NZ's largest used-car retailer (~10% share) but a dealer, not a neutral portal. |
 
## 2.2 Validation Signal — and Its Limits
 
In May 2025, NZME signed an MOU with Gumtree Group to explore a competing marketplace, explicitly citing dealer frustration and the $125M opportunity. At its February 2026 results, NZME confirmed it is no longer exploring that marketplace with Gumtree — but stated it remains open to launching its own venture. The partnership is dead, which removes the fastest, best-resourced route to a competitor. That is a genuine tailwind. But NZME has kept the door open to building its own, and has capital plus a proven track record launching verticals (OneRoof). The Australian-tech shortcut closed; the threat did not vanish. Treat May 2025 → February 2026 as the threat changing shape, not disappearing.
 
## 2.3 The PropertyPal Parallel — Read Carefully
 
PropertyPal entered a single-portal Northern Ireland market in 2008, went agent by agent, and took leadership by 2012. The structural parallel to NZ automotive holds. But the fuller lesson is a caution: PropertyPal later triggered an agent revolt when it moved from per-listing to subscription pricing, and challenger HomesNI won agents with a flat, transparent, low monthly fee. The takeaway is not 'features win' — it is that challengers win on price transparency, dealer goodwill, and a provable value gap.
 
## 2.4 Competitive Landscape
 
| **Platform** | **Assessment** |
| --- | --- |
| **Trade Me Motors** | Dominant incumbent. High, prominence-based fees. The platform to co-list alongside — not the one to ask dealers to leave. |
| **AutoTrader NZ** | Second portal, Optimus-owned. Minimal traction. Not a launch-stage threat. |
| **Facebook Marketplace** | High volume, low trust. Buyers use both. Not a direct competitor. |
| **NZME (Gumtree partnership ended)** | MOU May 2025; NZME confirmed Feb 2026 it is no longer pursuing the Gumtree marketplace but remains open to its own venture. Partnership dead (a tailwind); intent to compete is not. A self-built NZME launch would own 'reach + audience,' leaving us the conversion/qualification niche — the threat is reshaped, not gone. |
| **CarExpert NZ (Trade Me JV)** | New-car content/reviews JV between Trade Me and Australia's CarExpert, launched early 2026, syndicated across Trade Me Motors and Stuff. New-car research, not used-car classifieds — not a direct competitor. Context: Trade Me is fortifying the top of the funnel. |
| **DriveChat** | Third-party **human-agent** live chat appearing on some Trade Me listings. The closest thing in-market to an "instant response" offer; it partially undercuts that phrase as a *standalone* pitch. It does **not** trip §12.2: human-staffed rather than sub-minute AI, covers only some listings, and — critically — publishes no auditable, cross-dealer sale-rate metric. Our wedge is the published proof, not merely fast chat. **Checked July 2026: still not triggering.** |
| **The graveyard** | CarMate, Carpage, AutoInsiders, Only Cars and others have failed or stalled. A fragmented weak field both validates the gap and warns that entry alone is not enough. |
 
---
 
# 3. The Wedge: Proven Sale-Rate Lift via Speed-to-Lead
 
This is the core of the strategy and the part that must not be diluted. A solo developer cannot out-audience Trade Me, so the bet cannot rest on reach. It rests on **conversion economics**: the only durable claim is that vehicles co-listed on UsedCarsNZ **sell faster and convert more enquiries** — and that we publish an auditable metric proving it.
 
## 3.1 Why Speed-to-Lead Is the Right Lever
 
Speed-to-lead is the most robust, transferable evidence base for a conversion advantage, and it is the one thing a small platform can actually guarantee — a templated acknowledgment fires in seconds, 24/7, including for the ~60% of leads that arrive after hours.
 
- **MIT / InsideSales (Oldroyd), Lead Response Management Study:** the widely-quoted '21x within 5 minutes vs 30 minutes' and '78% buy from the first responder' figures.
- **Cox Automotive:** leads contacted within 5 minutes convert at 25–32% vs 3–5% after an hour.
- **The reality gap:** the average dealer takes ~47 hours to respond, and only ~7% of firms respond within 5 minutes (Drift, 433 firms). This is the gap a sub-minute system closes.
> **⚠️ ATTRIBUTION DISCIPLINE (v5.4 — corrected for the third time).** The 21x and '78% first responder' figures are **MIT/InsideSales (Oldroyd)**. They are **not** from the 2011 Harvard Business Review study. v5.3 carried a warning about this *directly beneath a bullet that made the error*; v5.4 removes the bullet. In any dealer conversation, ad, or landing-page copy, **never** attribute these to "Harvard" — a misattributed statistic is precisely the Fair Trading Act credibility risk §13 exists to prevent. **Prefer first-party mystery-shopper data (§4.2) in every NZ dealer conversation.** It is better evidence and carries zero attribution risk.
 
*Treat specific multipliers as indicative, not precise — they trace to a small set of US studies recycled across vendor blogs (see §13). The direction is robust.*
 
## 3.2 Qualification as the Second Lever
 
AI pre-qualification (budget, finance need, trade-in, timeline, genuine intent) measurably improves conversion. CarGurus has reported pre-qualified leads as ~60% more likely to purchase (later framed as 41% more likely to close); AI chat vendors report 35–50% lifts in qualified-lead volume. The proven pattern: AI answers instantly, qualifies, books the test drive, then hands a warm, contextualised lead to the human. *(Built: Lane 1 qualification chat, `lib/ai/trigger.ts`.)*
 
## 3.3 Why This Is Defensible (and Where It Is Not)
 
An AI chatbot is not a moat — Trade Me, Motorcentral and a future NZME venture can all bolt one on. Motorcentral already ships an 'Auto Attendant' email auto-responder and AI-generated descriptions, so part of the headline feature already exists inside the incumbent DMS. Defensibility therefore cannot be 'we have AI.' It comes from being the only NZ platform that:
 
- Ties auto-qualification to a transparent, published sale-rate / lead-to-sale metric — the same way Trade Me markets its Ultimate case studies, but auditable and free to view *(built: `/metrics`, reading exclusively from the immutable `lead_events` log)*; and
- Keeps a human-in-the-loop to stay clear of Fair Trading Act / Consumer Guarantees Act liability for automated misrepresentations (§7) *(built: the `ai_drafts` approve→send gate, enforced by DB state machine and asserted in tests)*.
> **The falsifiable promise.** *"Cars co-listed on UsedCarsNZ get a first response in under 60 seconds and convert more enquiries to sales — and we publish the numbers."* If the pilot cohort cannot demonstrate a conversion lift, the wedge has failed — pivot or stop. This is the project's central risk, surfaced deliberately.
 
---
 
# 4. Go-to-Market Strategy
 
## 4.1 Motorcentral — The Existential Dependency
 
Motorcentral (Limelight Group, merged with Thorn Financial Services in 2022) is the dominant NZ independent-dealer DMS — 600–650+ dealerships, $2.5B+ annual sales. It already publishes inventory to Trade Me (via the Dealerbase API), AutoTrader, Need A Car and Driven. Becoming a Motorcentral publishing destination is how dealers get their stock onto UsedCarsNZ without re-keying. Without inventory flow, the economics break.
 
| **Factor** | **Detail** |
| --- | --- |
| **Classification** | Strategic partner — not a competitor. Position as a free additional distribution channel; zero cost to Motorcentral. |
| **Why it matters** | Single integration = access to the independent-dealer base with no dealer workflow change. |
| **Ownership risk** | Finance-aligned ownership (Limelight/Thorn) and historic Trade Me ties may make it slow to prioritise a tiny new destination. |
| **Competing feature** | Motorcentral already offers 'Auto Attendant' email auto-response and AI descriptions — reinforcing that our wedge must be the published proof metric, not 'we have AI.' |
| **Secondary target** | AutoPlay as a second DMS integration target. |
| **Fallback (a real bridge)** | CSV / data-feed importer. Dealers add ~1 listing/day on average, so even manual upload is 'not particularly time-consuming' (Commerce Commission). |
| **Regulatory note** | The Commerce Commission DECLINED Trade Me's 2017/18 bid to acquire Motorcentral on competition grounds — useful context for positioning Motorcentral as wanting more, neutral destinations. |
| **Timing (v5.4)** | **Sequenced after pilot validation.** Approach once the demo is live and a documented listing API / feed spec exists. A conversation with proof metrics beats a conversation with a promise. |
 
## 4.2 Phase 0 — Market Validation, Demo in Hand
 
*Original v5 rule: "Nothing gets built in Phase 0."* **v5.4 status:** a full working product was built ahead of Phase 0 — deliberately, so dealer conversations happen with a live demo rather than a static page. The purpose of Phase 0 is unchanged: validate the offer and the wedge before investing in *scale*. **No gate has moved.** The two-month pilot lift threshold (§5) remains the hard decision point.
 
### The Five Dealer Conversations
 
Visit five Christchurch dealers in person. Ask, then listen:
 
- "How do you currently manage your enquiries and stock?"
- "What's your biggest frustration with Trade Me — and how fast do enquiries actually get answered today?"
- **(New in v5.4 — the forcing question):** *"Would you pay for this as a tool that answers your existing Trade Me leads, even if no buyer ever visits our site?"*
You are not selling — you are listening. The third question resolves the marketplace-vs-tool-first fork empirically (see Executive Summary).
 
**Outreach assets exist:** a scored prospect list of 53 dealers (top-25 call-first, top-10 pilot candidates with call scripts) and a 50-dealer email list. The five conversations draw from the call-first cohort; the pilot (§5) draws from the top-10. *(Note: NZ's Unsolicited Electronic Messages Act 2007 governs the email outreach — confirm consent posture before sending.)*
 
### Mystery-Shopper Speed-to-Lead Measurement
 
Submit genuine enquiries to a sample of Christchurch Trade Me and AutoTrader listings and time the actual first responses. This produces **first-party, defensible** NZ-specific speed-to-lead data rather than relying on the US studies in §3.1. A dealer who hears "I enquired on ten Christchurch listings last week and the median first reply took N hours" is hearing measured local evidence, not a recycled statistic — and it sidesteps the Fair Trading Act attribution risk entirely. **This is now the preferred evidence in every dealer conversation.**
 
### The Landing Page / Ad Test — STILL BLOCKED
 
> **⚠️ Do not spend ad budget yet (unchanged from v5.3, now with a deadline).** The test as originally written is a **seller-side** capture test. The page that went live is **dealer-side** (Founding Dealer Program, positioned as a speed-to-lead tool). These measure different things. This choice is downstream of the marketplace-vs-tool-first decision — **and that decision is now scheduled: it resolves after the five dealer conversations.** Hold the $500–1,000 until then.
 
### What You Are Measuring
 
| **Metric** | **Target** | **What it tells you** |
| --- | --- | --- |
| **Cost per lead** | Under NZD $20 | Viability of paid acquisition at scale *(metric definition pending the fork decision)* |
| **Form submission rate** | >5% of ad clicks | Whether the offer resonates |
| **Qualitative call feedback** | Top 3 recurring pains + current response times + **the forcing question** | Whether the speed wedge is felt as a real pain — and which product they'd buy |
 
### The 60-Second Call Rule
 
When leads come in, call within 60 seconds and have a real conversation. This is a live demonstration of the product's core mechanic, and your best premium-feature research.
 
## 4.3 The Offer Definition — Proof Is Free, Not Premium
 
The instant-response AI and the conversion dashboard are the sales pitch, so they cannot sit behind a paywall — they belong in the free core offering. Candidate paid add-ons are in §11.
 
---
 
# 5. The Dealer Conversion-Proof Pilot (The Hard Gate)
 
Phase 0 validates acquisition. It does not answer the existential question: can we demonstrate a conversion lift for dealers? This pilot does, and it is a hard gate.
 
| **Element** | **Detail** |
| --- | --- |
| **Cohort** | 5–15 pilot dealers — target the most Trade-Me-fee-frustrated independents. |
| **Instrument** | Lead first-response time, enquiry-to-appointment rate, appointment-to-sale. Each dealer gets a live dashboard. *(Built: `/dealer/metrics`, SQL views over `lead_events`.)* |
| **Baseline mechanism** | The dealer routes their existing Trade Me enquiry emails into UsedCarsNZ (Cloudflare Email Routing → Email Worker → Supabase). This captures their *true* current first-response time empirically per lead — not a self-report — and lets the AI operate on their existing lead flow immediately. **Built** (`workers/email-inbound/`), **not yet wired at the Cloudflare zone.** |
| **Threshold to continue** | Within two months: median first-response under 5 minutes AND a higher enquiry-to-appointment rate than baseline. If no measurable lift, the wedge has failed. |
| **Decision** | Pass → productise the proof and scale. Fail → pivot or stop. Do not proceed on faith. |
| **Prerequisite (v5.4)** | A **pilot agreement** covering: data-processing authorisation for forwarded buyer enquiries, AI-labelled-response authorisation under §7, and 30-day raw-email retention. **This does not exist yet and blocks the pilot** (§14). |
 
---
 
# 6. Product Vision & Principles
 
## 6.1 Product Name & Entity
 
Product name: UsedCarsNZ. Domains: usedcarsnz.co.nz (primary), usedcarsnz.nz (secondary redirect). Parent entity: Inspiral NZ Ltd (GitHub org: `inspiro-nz`).
 
## 6.2 Core Principles
 
- **Proof, not promises:** a measured, published conversion metric is the product. Every feature serves it.
- **Speed by default:** every enquiry gets a sub-minute first touch, 24/7.
- **Compliance by design:** AI is bounded so the platform and its dealers never make automated misrepresentations (§7).
- **Co-list, don't compete:** we are additive to Trade Me, not a replacement ask.
- **Dealer-first goodwill:** flat, transparent, cheap pricing with no upsell ladder.
- **Trust by design:** WOF, rego, PPSR signals visible and labelled by source.
- **Cheap to run, easy to migrate:** open standards, portable, near-zero infra cost (hard ceiling: NZD $100/month).
---
 
# 7. Legal & Compliance Boundaries for the AI (Mandatory)
 
An AI that **auto-sends factual claims about a specific vehicle** is a liability landmine. The boundaries below define what may be built.
 
## 7.1 The Legal Exposure
 
- **Fair Trading Act 1986 (FTA):** prohibits false/misleading representations about a vehicle's nature, history, condition, price or consumer rights. Intent is irrelevant — a trader is liable whether a human or an AI made the claim. Fines up to $600,000 for a body corporate.
- **Consumer Guarantees Act 1993 (CGA):** requires a vehicle to be 'as described.' An AI stating a feature, spec, history or 'mint condition' the car lacks creates direct misrepresentation exposure (remedies up to rejection/refund via the Motor Vehicle Disputes Tribunal, jurisdiction to $100,000).
- **Unsubstantiated representations & CGA rights:** the FTA bars claims without reasonable grounds, and misrepresenting CGA rights.
- **In-trade disclosure & CIN:** dealers selling online must disclose they are 'in trade' and link the Consumer Information Notice on the listing.
- **Privacy Act 2020 (elevated in v5.4):** the email-ingestion lane processes buyer personal information. The dealer is the collecting agency; the platform processes on their behalf. **There is currently no privacy page and no enforced retention purge** (§14).
## 7.2 The Bounded AI Design
 
| **AI is ALLOWED to** | **AI must NOT** |
| --- | --- |
| Ask buyer-side pre-qualification questions: budget, finance need, trade-in, timeline, location, genuine-intent screening. | Auto-send factual claims about a specific vehicle's condition, history, spec or 'as described' status. |
| Answer routine, generic Q&A from an approved-facts list (opening hours, address). | State or imply CGA/warranty rights ('no warranty applies', 'you have 3 months'). |
| DRAFT replies for the dealer that a human approves before sending. | Send any vehicle-specific representation without human approval. |
| Book test drives and hand a contextualised, logged lead to the human. | Make unsubstantiated claims. |
 
**The two-lane architecture (built and verified):** the sub-60-second first touch is a **deterministic templated acknowledgment with no LLM in the send path**. The LLM operates only in the second lane: it *qualifies* the lead and *drafts* a reply, written to `ai_drafts` with `status='draft'`, which cannot be sent until an authenticated dealer approves it. This is enforced by a database state machine and asserted in tests — **not merely documented.** `lib/ai/guard.ts` runs a claims-screen over every Lane 1 output as belt-and-braces on top of the system prompt.
 
**Compliance is proven by mocks, not live runs.** No live model can be relied upon to misbehave on cue. The compliance envelope is proven by feeding `guardReply` deliberately bad output via the deterministic mock adapter. A green live run is not compliance proof. *(This principle is now embedded in the test suite: `lib/ai/__tests__/fake-provider.ts`.)*
 
## 7.3 The Referral Bright Line — NOW URGENT
 
Under the Financial Markets Conduct Act 2013 (as amended by FSLAA), a person gives **regulated financial advice** when they make a recommendation or give an opinion about acquiring or disposing of a financial advice product — and a consumer credit contract is such a product. Merely describing how products work, or introducing a customer to a provider, is **not** advice. Anyone giving regulated financial advice to retail clients must hold, or operate under, a Financial Advice Provider (FAP) licence — which a solo operator cannot realistically hold.
 
| **The AI MAY (bare referral — not advice)** | **The AI must NOT (regulated advice → FAP licence)** |
| --- | --- |
| Detect finance interest and ask if the buyer would like to be connected to a partner. | Recommend a specific loan, lender, or policy. |
| Capture details and hand a qualified lead to a licensed finance/insurance partner. | Give an opinion on suitability or affordability. |
| State factual, generic information ('finance is available through our partner'). | Rank or compare products, or present the referral as neutral 'best for you' advice. |
 
> **⚠️ v5.4 — THE DEFERRAL ANCHOR IS GONE.** v5.1 flagged the CCCFA enforcement transfer from the Commerce Commission to the FMA (proposed 1 July 2026). v5.3 used that pending transition as grounds to defer the finance-referral legal check. **The transfer has now completed.** There is no longer anything to wait for. The legal consultation covering the advice-vs-referral bright line, FSPR registration, and dispute-resolution-scheme membership is **required before any referral money changes hands** — and the finance referral is the primary revenue line.
 
*This is general information, not legal advice.*
 
---
 
# 8. User Personas
 
## 8.1 Dealer (Primary)
 
| **Attribute** | **Detail** |
| --- | --- |
| **Who** | Independent or small franchise dealer, 10–200 cars, Christchurch-first. |
| **Current pain** | Trade Me fees high and prominence-gated. Slow lead response loses sales. No proof of what's working. |
| **What they need** | A cheap second channel that answers leads instantly, qualifies them, and proves the lift — without re-keying stock. |
| **The 'pay twice' objection** | The answer is not 'we're cheaper' — it's 'this marginal fee pays for itself in incremental sales, and here's the dashboard.' |
| **Verification** | NZBN lookup + manual admin approval before first listing. *(Built: `/admin` approval queue.)* |
| **Pricing at launch** | Free. Proof metric and instant-response AI included free — they are the pitch. |
 
## 8.2 Private Seller
 
Individual selling one vehicle. Free at launch; pay-per-listing considered later. *(Status: not built. Phase 2/3.)*
 
## 8.3 Buyer
 
Anyone buying a used vehicle. No account needed to browse, search, or enquire. Gets an instant response on any enquiry. Optional account to save searches/listings and track conversations.
 
## 8.4 Platform Admin
 
Founder/operator. Dealer approval queue, listing moderation, user management, platform + conversion metrics.
 
---
 
# 9. Functional Requirements
 
*(Build status per requirement added in v5.4. ✅ = built and verified in code; ⚠️ = partially built; ❌ = not built.)*
 
## 9.1 Instant Lead Response & Qualification (Core — the Wedge)
 
- ✅ Sub-60-second first response to every buyer enquiry, 24/7. **Deterministic templated acknowledgment — no LLM in the send path.** (`POST /api/enquiries`; measured at <5s in the timing script.)
- ✅ Enquiry sources: (a) buyer enquiries on UsedCarsNZ listings; (b) the dealer's existing Trade Me enquiry emails via Cloudflare Email Routing → Email Worker → Supabase. *(Code complete; the Cloudflare zone routing is not yet configured.)*
- ✅ Buyer-side qualification flow: budget, finance need, trade-in, timeline, location, genuine-intent screening, persisted as structured data. (`lib/ai/trigger.ts`, `POST /api/ai/chat` with SSE streaming.)
- ✅ Dealer-side: AI generates a DRAFT written to `ai_drafts` (`status='draft'`). Nothing sends until `status='approved'` by an authenticated dealer. Enforced in code paths and tests.
- ✅ Clear 'you're chatting with an AI assistant' labelling on every AI interaction.
- ⚠️ Test-drive / viewing booking handoff — status transitions exist; the booking flow is thin.
- ✅ Every step time-stamped into the immutable `lead_events` log.
## 9.2 Conversion Proof Dashboard (Core — Free)
 
- ✅ Per-dealer: median + p90 first-response time, enquiry-to-appointment rate, appointment-to-sale rate, time-on-market. (`/dealer/metrics`, SQL views over `lead_events`.)
- ✅ Platform-level published aggregate metric. (`/metrics` — public, unauthenticated.)
- ✅ 'Sample data' badge on every metric surface when `DEMO_SAMPLE_DATA=true` — seeded numbers can never be mistaken for measured results (Fair Trading Act discipline).
- ✅ 'Insufficient data' shown honestly below a minimum-N threshold rather than a hollow number.
## 9.3 Listings
 
- ✅ Core fields, management (create/edit/pause/delete), status lifecycle, mark-as-sold.
- ✅ In-trade disclosure and CIN link on every dealer listing.
- ✅ Client-side image compression (WebP ~0.8, ≤200KB, zero-dependency canvas). (`lib/images/compress.ts`, shipped in the Prompt 8 close-out.)
- ❌ CSV bulk import — deferred.
## 9.4 Search & Discovery
 
- ✅ Standard filters, clean URLs (`/cars/[make]/[model]/[year]/[id]`), SSR.
- ❌ AI natural-language search (pgvector + embeddings) — deferred to Phase 2/3, as planned.
- ⚠️ SEO: clean URLs and SSR built; JSON-LD, `llms.txt`, sitemap unverified.
## 9.5 Enquiry & Lead Management (CRM Seed)
 
- ✅ Enquiry form on every listing; no account required; instant templated ack is the first touch.
- ✅ Every enquiry logged with timestamp + listing ref; dealer inbox with status chips (New, Contacted, Viewing Booked, Sold, Closed); lead timeline with first-response badge.
- ✅ Buyer/AI chat thread (`/thread/[id]`).
## 9.6 Dealer Accounts, Trust & Admin
 
- ✅ Dealer registration → admin approval queue; dealer dashboard.
- ✅ Auth: Supabase Auth (email/password, magic link, password reset), account deletion.
- ❌ PPSR link-out to CarJam, WOF/rego display, verified-dealer badge — not yet built.
---
 
# 10. Technical Architecture (As Built — Verified 12 July 2026)
 
*Corrected against a direct code audit of `develop`, not self-report. `docs/AUDIT-LEAD-ENGINE.md`, `docs/infra/demo-standup.md` and `docs/infra/email-routing.md` in the repo are the canonical detail.*
 
| **Layer** | **Technology (verified in code)** |
| --- | --- |
| **Frontend** | Next.js 16.2.7 (App Router), React 19.2.4, TypeScript (strict), Tailwind v4. |
| **Hosting** | Cloudflare Workers via `@opennextjs/cloudflare` v1.19 — *not* Pages. `middleware.ts` (not Next 16's `proxy.ts`) — the adapter requires edge middleware; `proxy.ts` forces the Node runtime, which it rejects. |
| **Database** | Supabase (managed Postgres), RLS. **20 migrations**, additive-only. |
| **Auth** | Supabase Auth. New `sb_publishable_` / `sb_secret_` key format adopted. |
| **AI — provider layer** | **Two adapters behind `lib/ai/provider.ts`: `workers-ai` (DEFAULT — `@cf/`-prefixed hosted models only, free 10,000 Neurons/day) and `anthropic` (config-flip escalation via `AI_PROVIDER_QUALIFY` / `AI_PROVIDER_DRAFT`).** Structured output via plain-text JSON + zod validation with one retry, then a safe fallback — deliberately NOT provider-native tool-calling, because the two adapters have incompatible tool-call shapes. |
| **AI — test adapters** | Deterministic **mock adapter** (`fake-provider.ts`) — the offline, free, default test path, and the *only* way compliance is actually proven. Optional **Ollama adapter** (`llama3.1` 8b validated; smaller models flake). |
| **AI — guardrails** | `lib/ai/guard.ts` claims-screen over every Lane 1 output; versioned prompts (`qualify.v1`, `draft.v1`); `prompt_version` recorded on every draft and event. Prompt-injection defence: buyer messages and inbound email bodies wrapped as untrusted data, with a boundary test. |
| **Inbound email** | Standalone Worker (`workers/email-inbound/`): Cloudflare Email Routing catch-all → `email()` handler → postal-mime → `trademe.ts` / `generic.ts` extractors → HMAC-SHA256-signed POST to `/api/inbound/email`. **Five fixtures** (trademe-synthetic, generic, malformed, hostile-injection, forwarding-confirmation). |
| **Scheduled workers** | Three standalone Cron Workers, split out because the OpenNext app worker exports only `fetch` (no `scheduled` handler): `workers/keepalive/` (`0 12 * * *`, pings the demo project to defeat the free-tier 7-day pause); `workers/outbox-sweep/` (every 15 min → `POST /api/cron/outbox-sweep`, retries failed acks); `workers/raw-email-purge/` (daily → `POST /api/cron/purge-raw-email`, enforces 30-day raw-email retention). The two `/api/cron/*` endpoints are auth-gated by `verifyCronRequest`. **All three deployed by CI** (`deploy-demo.yml`, PR #32). Wrinkle: the two new crons default `TARGET_URL` to prod but ride the demo-branch CI — idempotent re-deploys, fine for now. |
| **Security** | `lib/security.ts` (FROZEN): Turnstile, honeypot, in-memory IP rate limiting, HTML sanitisation. |
| **Email (outbound)** | Resend. `email_outbox` table for failed-send retry. |
| **Source / CI** | GitHub (`inspiro-nz/usedcarsnz`). `ci.yml`: typecheck + lint + vitest + build on every push and PRs into `develop`. `deploy-demo.yml`: push to `demo` branch → build with demo secrets → `wrangler deploy --env demo` + keepalive deploy. |
| **Testing** | Vitest (unit + integration), Playwright (3 E2E specs: landing, marketplace, signin — local-only, not in CI). |
 
**Schema:** `lead_events` (append-only, **immutable by trigger** — UPDATE/DELETE/TRUNCATE rejected at the DB level; corrections appended as compensating events, never mutated) is the source of truth for every conversion metric. `ai_drafts` (with a CHECK constraint: `status='approved'` requires `approved_by` AND `approved_at`) holds the human-approval audit trail. `approve_draft()` is a security-definer function that writes the status change and the `draft_approved` event **atomically**.
 
## 10.1 Environments (v5.4 — the four-environment model is RETIRED)
 
**Two cloud environments, not four:**
 
| **Environment** | **State** |
| --- | --- |
| **Local** | Supabase CLI (Docker). **This IS the dev environment.** |
| **Demo** | `usedcarsnz-demo` (Supabase free tier, Sydney) + `demo.usedcarsnz.co.nz` behind Cloudflare Access. **Code ready; Cloudflare Access not yet stood up.** |
| **Production** | `usedcarsnz-prod` (`geappcqiihbgihcsitkj`) + `usedcarsnz.co.nz`. Landing page live; **marketplace slice not yet deployed** (no Supabase secrets on the prod worker). |
 
**Why no cloud dev project:** Supabase's free tier caps at **2 active projects per organisation**. Prod + demo fills it. A third would need a second org or a paid plan. **Local via the CLI is the correct dev environment at $0/month — this is not a gap and does not need fixing.** v5.3's four-environment target is formally retired.
 
> **⚠️ SAFETY (carried from v5.3, unresolved).** v5.3 §10.1 recorded that local was running against **production**. Verify `.env.local` points at the local Docker stack (`http://127.0.0.1:54321`), never at `geappcqiihbgihcsitkj`. One `supabase db reset` against a prod-pointing config destroys production. **This is the single highest-severity item in the project.**
 
Branches: `main` (prod) + `develop` (integration) + `demo` (deploy trigger — **does not exist yet**).
 
---
 
# 11. Revenue & Monetisation
 
In a **co-listing** model the dealer already pays Trade Me for the listing — so revenue cannot come from the listing. It comes from the **transaction you help close**.
 
## 11.1 The Principles
 
- The proof metric and instant-response AI stay free — they are the sales pitch.
- Price flat, cheap, transparent, no upsell ladder (the HomesNI lesson; the PropertyPal subscription revolt is the warning).
- Avoid prominence-based, listing-fee gouging — the exact thing dealers resent about Trade Me's Ultimate tier.
- Monetise via finance referral and transaction-adjacent services, not by taxing the listing.
## 11.2 Candidate Revenue Lines
 
| **Line** | **How it works** | **Notes / risk** |
| --- | --- | --- |
| **Finance referral** | AI detects finance interest and refers the pre-qualified buyer to a licensed finance partner for a lead/commission fee. The AI introduces only — never recommends or opines (§7.3). | Primary revenue line. **Legal check now URGENT — the CCCFA→FMA deferral anchor is gone (§7.3).** Revenue throttled by enquiry volume; will not on its own pay a founder wage. |
| **Insurance referral** | At point of sale, refer comprehensive / mechanical-breakdown insurance for commission. | Similar regulatory care. Low dealer friction. |
| **Pre-purchase inspection** | Buyers book an AA inspection from the listing; revenue share. | Also a trust differentiator. |
| **Vehicle history margin** | White-label CarJam/PPSR; small margin per check. | Low value per unit, zero dealer friction. |
| **Flat dealer plan (the eventual backbone)** | Single flat, cheap monthly plan per dealer, introduced once proof and audience exist. | **This — not finance referral — is the line that scales to a founder wage**, because it does not depend on buyer finance behaviour. Flat per-dealer only; never per-listing or prominence-gated. |
| **Data asset (long-term)** | Proprietary NZ pricing intelligence. | Real but distant; needs scale. |
 
> **Revenue reality.** Covering running costs is trivial — under one funded finance referral a month does it (infra ceiling: NZD $100/month). Paying a founder wage on referral commissions alone needs roughly 20+ funded loans a month, implying on the order of ~25–90 active dealers — but the exact figure is governed almost entirely by **enquiries per listing per month**, the platform's weakest dimension and a number that cannot be known until there is live traffic. Referral revenue keeps you free-to-dealer during land-grab; the flat dealer plan is the line that scales to a wage.
 
## 11.3 The Flat Dealer Plan — When and How
 
Two hard preconditions before charging anything: (1) the published conversion metric exists and is credible, and (2) listings actually generate enquiries. Introduce it on those triggers, not on a calendar.
 
- **Price:** a single flat fee per dealer per month — never per-listing, never prominence-gated. Indicatively ~NZD $99–$199/dealer/month, held flat as a matter of principle.
- **Position as goodwill, not a tax:** lead with the proof, then the price, then the explicit anti-Trade-Me contrast.
- **Keep the proof dashboard viewable as the acquisition hook** even after the fee exists. Resist a free-vs-paid feature matrix — a solo founder cannot maintain tiering, and tiering is what you are positioning against.
---
 
# 12. Partnerships & Decision Triggers
 
## 12.1 Partnership Priority
 
- **Motorcentral (existential):** publishing-destination integration. Sequenced after pilot validation. Secondary: AutoPlay.
- **Finance partner (revenue):** the primary monetisation relationship. Blocked on the §7.3 legal check.
- **CarJam (trust):** link-out; white-label later.
- **NZTA Landata / AA New Zealand:** Phase 2/3.
## 12.2 Decision Triggers That Change the Plan
 
| **If…** | **Then…** |
| --- | --- |
| **NZME announces a self-built automotive venture or a new technology/brand partner** | Accelerate Motorcentral integration and pilot proof. A funded competitor owns 'reach + audience' — you must already occupy the conversion/qualification niche. The Gumtree exit bought time, not safety. |
| **Trade Me launches sub-minute AI auto-response AND publishes sale-rate metrics** | Your feature moat is gone. Pivot to the human-approval/compliance angle and dealer-goodwill pricing, or seek acquisition. **Both conditions must be met. Checked July 2026: not met.** |
| **DriveChat (or any rival) expands to a sub-minute AI product with published metrics** | Same response as above. **Checked July 2026: DriveChat remains human-agent chat — monitored, not triggering.** |
| **Motorcentral refuses integration** | The economics likely break. Reassess whether a CSV-feed MVP can sustain adoption before committing further. |
| **Pilot shows no conversion lift in two months** | The wedge has failed. Pivot or stop. Do not keep building on faith. |
| **No audience: listings generate too few enquiries to convert** | If, after the pilot plus active marketing and with ≥50 active dealers, listings sustain below ~0.25 enquiries per listing per month for three months, the conversion wedge is moot. **Materially de-risked by the email-ingestion lane** — the AI can prove lift on the dealer's *existing Trade Me traffic* with zero marketplace volume. The "standalone dealer SaaS tool" that was the *fallback* here is now a viable *front door* (see the Executive Summary fork). This remains the platform's weakest dimension; watch it from day one. |
 
---
 
# 13. Evidence Quality & Caveats
 
- Trade Me's $125.3M motors figure is from filed accounts (reliable). The NZ market sizing (~USD 306–323M) is analyst/company estimate.
- **⚠️ Speed-to-lead attribution (corrected for the third time in v5.4):** the 21x and '78% buy from the first responder' figures are **MIT/InsideSales (Oldroyd)**, NOT the 2011 HBR study. **Never attribute them to "Harvard" in any dealer-facing material.** v5.3 carried this warning while leaving the erroneous HBR bullet in §3.1; v5.4 has removed the bullet. **Prefer first-party mystery-shopper data (§4.2) in every NZ dealer conversation** — it is better evidence and carries zero attribution risk.
- Specific multipliers (7x, 21x, 60x) trace to a small set of US studies recycled across vendor blogs — directionally robust, specific numbers indicative.
- CarGurus' ~60% / 41% figures are US vendor/IHS data — directionally applicable, not NZ-specific.
- Trade Me dealer case-study figures (73% leads / 52% sales) are Trade Me's own marketing, not independently audited.
- **Seeded demo metrics carry a visible 'Sample data' badge AND a spoken disclaimer in the demo script.** Presenting fabricated conversion numbers as measured results is a direct Fair Trading Act exposure.
- **Compliance is proven by mocks, not live runs.** A green live-model run proves nothing about the envelope; only deliberately-bad output fed through `guardReply` does.
- **B2C aggregation via scraping is legally exposed** under the Copyright Act 1994. The correct path is B2B dealer relationships → legitimate data feeds → consumer layer.
- **Dealer email outreach is governed by the Unsolicited Electronic Messages Act 2007 (UEMA).** Confirm consent posture before sending to the 50-dealer list.
- **Regulatory landscape (v5.4):** the CCCFA enforcement transfer from the Commerce Commission to the FMA has **completed**. The v5.1/v5.3 deferral of the finance-referral legal check is therefore void (§7.3).
- *Informational, not legal advice.*
---
 
# 14. Immediate Next Steps (Critical Path — updated v5.5)
 
**⚠️ ZERO — before anything else.** Verify `.env.local` points at **local** Supabase, not `geappcqiihbgihcsitkj`. One `supabase db reset` against a prod-pointing config destroys production. Two minutes. Do it now.
 
*Prompt 8 (Prompt 7 close-out) and the cron-deploy gap are both DONE — struck through and moved to the top of the table as ✅. Everything remaining below is founder/dashboard or legal; no code is left for the demo.*
 
| **#** | **Action** | **Blocks** | **Status** |
| --- | --- | --- | --- |
| **✓** | ~~**Deploy the two cron workers.**~~ **DONE (PR #32).** `deploy-demo.yml` now ships `outbox-sweep` + `raw-email-purge`. Retention purge behind the `/privacy` claim now has a job — active once the demo branch deploys (item 5). | — | ✅ DONE |
| **✓** | ~~**Fill the two per-founder placeholders.**~~ **DONE (PR #32).** keepalive → demo Supabase `ttwsmrsgdqzjnobflihd`; email-inbound forward → founder Gmail alias. No `CHANGE-ME` remains. | — | ✅ DONE |
| **1** | **Supabase demo project: migrations + seed.** Confirm `usedcarsnz-demo` (ref `ttwsmrsgdqzjnobflihd`) exists; link the CLI, push migrations, run `seed:demo` (`docs/infra/demo-standup.md` §1–2). | The demo | ❌ TODO |
| **2** | **Set secrets.** App secrets (`--env demo`) + worker secrets. **`CRON_SECRET` must be set on BOTH sides** — on the app (`--env demo`, so the `/api/cron/*` endpoints can verify) and on each of the three cron workers (so they can send `Authorization: Bearer`); the endpoints fail closed (503) if it's unset. Plus 5 GitHub repo secrets. `deploy-demo.yml` fails without the CI ones. | The demo | ❌ TODO |
| **3** | **Cloudflare Access demo stand-up.** Zero Trust org (Free), One-time PIN IdP, self-hosted Access app on `demo.usedcarsnz.co.nz`, service token. **The runbook (`docs/infra/demo-standup.md`) is already written — execute it.** ~90 min of dashboard work. | The demo | ❌ TODO |
| **4** | **Create the `demo` branch and push.** `deploy-demo.yml` triggers on it; it does not exist yet. | The demo | ❌ TODO |
| **5** | **Verify.** Phone/private-window → Access PIN page (not a listing); `npm run latency-check` passes all budgets; one full `DEMO_RUNBOOK` dry-run + capture the screen-recording fallback. | Dealer meetings | ❌ TODO |
| **6** | **LEGAL CONSULT — URGENT.** (a) FTA/CGA AI scope + CIN/in-trade; (b) **the finance-referral bright line, FSPR registration, DRS membership — the CCCFA→FMA deferral anchor is GONE**; (c) Privacy Act 2020 email-lane posture + **the `/privacy` page copy (currently placeholder)**; (d) the **pilot agreement** (data-processing + AI-labelled-response authorisation). | The pilot AND all revenue | ❌ **URGENT** |
| **7** | **Five Christchurch dealer conversations.** Include the forcing question (§4.2) that resolves the marketplace-vs-tool-first fork. | The ad test, the strategy | ❌ TODO |
| **8** | **Resolve the fork**, then the seller-vs-dealer ad-test decision, then spend the ad budget. | The ad test | ⏸ Blocked on #7 |
| **9** | **Deploy the marketplace slice to production.** On `main` but not live (no Supabase secrets on the prod worker). | Nothing (demo is Access-gated) | ⏸ Deferred |
| **10** | **Motorcentral.** Sequenced after pilot validation — a conversation with proof beats one with a promise. | Scale | ⏸ Deferred |
| **11** | **Email Routing at the zone (pilot, not demo).** Enable Email Routing; **verify the founder forward Gmail as a Cloudflare destination (confirm-link email)**; DNS collision check vs Resend; catch-all → email worker. | The pilot | ⏸ Deferred |
 
### First Dealer Conversation Script
 
*"Hi, I'm building a way for NZ dealers to sell cars faster — you keep your Trade Me listing and add us. Two questions: how do you currently manage your enquiries and stock? And what's your biggest frustration with Trade Me — honestly, how fast do enquiries actually get answered today?"* Then stop talking.
 
**Then, before you leave:** *"Would you pay for this as a tool that answers your existing Trade Me leads — even if no buyer ever visits our site?"*
 
---
 
# 15. AI-Assisted Build Workflow & Build State
 
**The pattern:** Claude (chat) as strategic director — architectural decisions, scoped briefs, gate review. Claude Code as implementation agent — repo work within those briefs. The founder approves every diff; **Claude Code never commits autonomously.** One work-package per session, with a hard verification gate before merge.
 
**Session invariants (nine, embedded verbatim in every prompt):** `develop` base branch, never `main`; frozen paths (landing route group, `app/api/lead/route.ts`, `lib/security.ts`) are import-only; TypeScript strict + ESLint; Workers-runtime compatibility for every dependency; additive-only migrations; secrets via env only; **Windows/PowerShell — one command per line, never `&&`-chained; git refs with braces quoted (`"stash@{0}"`)**; the §7 compliance envelope enforced in code and tests; standard end-of-session report with a pass/fail gate checklist.
 
## Build State (verified by code audit, 12 July 2026)
 
| **Prompt** | **Delivers** | **Status** |
| --- | --- | --- |
| **0** | Repo audit | ✅ `docs/AUDIT-LEAD-ENGINE.md` |
| **1** | Immutable `lead_events`, `ai_drafts`, `messages`, `dealer_aliases`, event-writer lib | ✅ Complete |
| **2** | Enquiry intake + sub-60s templated ack, `email_outbox` | ✅ Complete |
| **3** | AI service: both lanes, two-adapter provider, `guard.ts`, versioned prompts, red-team suite | ✅ Complete (**exceeds spec** — mock + Ollama test adapters added) |
| **4** | Dealer inbox, lead timeline, approve→send gate | ✅ Complete |
| **5** | Email ingestion worker, extractors, 5 fixtures, HMAC endpoint | ✅ Code complete (**Cloudflare zone not configured**) |
| **6** | Metrics views, `/api/metrics`, dealer dashboard, public aggregate, demo seed | ✅ Complete |
| **7** | Performance, crons, runbook, privacy | ✅ Complete (delivered via the Prompt 8 close-out) |
| **8** | Prompt 7 close-out | ✅ Complete — merged on `feature/prompt7-closeout` |
 
**All seven former Prompt 7 gaps are closed** (verified 14 July 2026): `scripts/latency-check.ts` (with Cloudflare Access service-token headers); `DEMO_RUNBOOK.md`; the `/privacy` page; client-side image compression (`lib/images/compress.ts`); listing-detail ISR (`revalidate = 300` + `generateStaticParams`; `/cars` search stays `force-dynamic` as it depends on searchParams); the email-outbox sweep and raw-email purge crons; plus `X-Robots-Tag: noindex` on demo and a populated `docs/roadmap.md`.
 
**The crons are two standalone workers, correctly.** `workers/outbox-sweep` (every 15 min) and `workers/raw-email-purge` (daily) each POST an authenticated app endpoint (`/api/cron/outbox-sweep`, `/api/cron/purge-raw-email`, guarded by `verifyCronRequest`). The app worker's `wrangler.jsonc` still has no `triggers` block — deliberately, because the OpenNext app worker exports only `fetch` and has no `scheduled` handler. The tested logic lives in the app; the workers are thin scheduled pokers. **Do not consolidate them back onto the app worker — it cannot hold a cron.**
 
**The last code-adjacent gap is now closed (PR #32).** `deploy-demo.yml` ships all three cron workers (`keepalive`, `outbox-sweep`, `raw-email-purge`) on demo-branch deploys. The outbox will drain and raw buyer emails will purge at 30 days once the demo branch is created and deployed (§14 item 4). Two logged wrinkles, both deferred by choice: the two new crons default `TARGET_URL` to prod but ride the demo-branch CI (idempotent — fine for now; split to a prod-cron workflow later if wanted), and the founder forward Gmail still needs verifying as a Cloudflare Email Routing destination before inbound forwarding works (pilot-only, §14 item 11).
 
---
 
*UsedCarsNZ — an Inspiral NZ venture — Confidential — July 2026 (v5.6, 15 July)*
 
