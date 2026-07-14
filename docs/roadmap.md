# UsedCarsNZ — build roadmap

**Last updated:** 2026-07-14 (end of Prompt 7 close-out, `feature/prompt7-closeout`).

The build ships in numbered "prompts" (work packages). This file is the current
state of record: what is done, what is in flight, and what is deferred. It
replaces the empty placeholder that used to sit here.

---

## Done — merged to `develop` and working

| Prompt | Scope | Evidence |
|---|---|---|
| 0 | Schema foundation — enums, identity, listings, leads, immutable `lead_events`, RLS | `supabase/migrations/20260621*` |
| 1 | Founding-dealer landing wedge (FROZEN) | `app/page.tsx`, `app/api/lead/route.ts`, `lib/security.ts` |
| 2 | Marketplace slice — `/cars` search, listing detail, dealer/admin, auth | `app/(marketplace)/*` |
| 3 | Enquiry intake — `POST /api/enquiries`, templated (no-LLM) ack, `email_outbox` retry | `app/api/enquiries`, `lib/email/*` |
| 4 | AI lanes — Lane 1 qualification chat + Lane 2 dealer draft, guard + red-team suite, human-approval gate | `lib/ai/*` |
| 5 | Email-ingestion lead lane — inbound worker, alias→dealer, nullable listing_id, shared first-touch | `workers/email-inbound`, `/api/inbound/email` |
| 6 | Conversion-metrics proof layer — views, dealer/public dashboards, "Sample data" honesty badge | `lib/metrics-views.ts`, `/dealer/metrics`, `/metrics` |
| 7 | **Performance hardening & demo runbook (this close-out)** | see below |

### Prompt 7 deliverables (this branch)
- **A** `scripts/latency-check.ts` — deployed-demo latency gate with Cloudflare Access service-token headers, p50/p75/p95 vs budgets, non-zero on breach. `npm run latency-check`.
- **B** Page-level ISR on the listing detail route (`revalidate = 300` + `generateStaticParams`) with on-demand `revalidatePath` on create / status-change / mark-sold. `/cars` stays `force-dynamic` (results depend on searchParams). Loading states are skeletons, not spinners.
- **C** Client-side image compression (`lib/images/compress.ts`) — zero-dependency `createImageBitmap` + canvas, ≤1600px, WebP ~0.8, ≤200KB; fixed aspect-ratio containers = zero CLS.
- **D** Cron wiring — standalone `workers/outbox-sweep` + `workers/raw-email-purge` POST authenticated app endpoints (the OpenNext app worker exports only `fetch`; it cannot take a cron trigger). Schedules in `docs/infra/cron-schedules.md`.
- **E** `X-Robots-Tag: noindex` via `next.config.js` `headers()`, gated on `NEXT_PUBLIC_APP_ENV === "demo"`; prod response byte-for-byte unchanged.
- **F** `/privacy` page (placeholder pending lawyer review) linked from the marketplace footer.
- **G** `DEMO_RUNBOOK.md` — the rehearsal script for the dealer meeting.

---

## Next — to go live (founder infra, not code)

The code for a gated demo at `demo.usedcarsnz.co.nz` is complete. What remains is
operational and needs Cloudflare/Supabase credentials. Tracked in
`docs/LOOSE-ENDS.md` (PART B/C). Summary:

1. Demo Supabase project — push migrations, `npm run seed:demo`.
2. Worker secrets via `wrangler secret put` (app `--env demo`, keepalive, email-inbound).
3. GitHub Actions secrets for `deploy-demo.yml`.
4. Cloudflare Zero Trust / Access — org, One-time-PIN IdP, self-hosted app policy, `demo-machine` service token.
5. Create the `demo` branch → trigger `deploy-demo.yml`; verify the Access wall.
6. Run `latency-check` against the deployed demo (founder step — needs the service token).

---

## Later — pilot and beyond (not blocking the demo)

Ordered by urgency; detail in `docs/LOOSE-ENDS.md` PART D.

1. **Legal consult (urgent)** — CCCFA→FMA transfer completed; privacy page is placeholder; buyer PII flows through the email lane.
2. **Production deployment** — the marketplace slice is on `main` but not live (no Supabase secrets on the prod worker).
3. **Marketplace-primary vs tool-first** positioning — unresolved; the first dealer conversations decide it.
4. **Seller-side vs dealer-side ad test** — hold ad budget until resolved.
5. **Motorcentral integration** — sequenced post-pilot.
6. **Real Trade Me lead-email fixture** — redacted sample from the first pilot dealer for `workers/email-inbound/fixtures`.
