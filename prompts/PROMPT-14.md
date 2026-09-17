# PROMPT 14 — Vehicle data capture, and the buyer AI search it unlocks

You are Claude Code in `inspiro-nz/usedcarsnz`. **Read `docs/review/NEXT.md`,
`docs/review/ROADMAP.md` (M1, M2, M6 and the Kill list) and Strategy v5.7 §9.3
/ §9.4 before touching anything.** This package has a hard dependency and a
strategic tension, both stated below; a session that skips the reading will
build the wrong half.

**Problem (founder):** a buyer should be able to find a car by describing it
("auto SUV under $25k in Canterbury, seven seats, towbar"). That search does
not exist. More fundamentally, **the data points it would search over are not
being captured** — the listings schema has ~30 vehicle columns and an
`embedding vector(1536)`, and the dealer form writes 16 of them.

**Definition of done: every vehicle data point a buyer would filter or ask on
is either captured or explicitly and defensibly out of scope; the browse page's
structured filters get measurably richer from that capture alone; and a
natural-language query resolves to explainable structured filters, with vector
similarity used only where structure runs out.**

---

## Sequencing — read this before deciding you can start

Two constraints from the existing plan bind this package:

1. **M1 feed ingestion (`prompts/PROMPT-13.md`, unwritten) comes first, and is
   BLOCKED on a real dealer sample export.** `docs/review/NEXT.md` is explicit:
   *"no M1 code is to be written… A parser built against an imagined schema is
   work that will be thrown away, and worse, it anchors the design to columns
   the dealer may not have."* The same warning applies with full force here —
   the sample export is the single best evidence of which vehicle fields
   dealers can actually supply at scale. **Do not run Task 2 (the migration)
   before that file exists.** Task 1 (the audit) is safe to run today and is
   in fact the right preparation for reading the export.
2. **The Kill list rejects "all further marketplace browse/filter richness"**
   as belonging to the destination-marketplace model the business is not
   pursuing, and §9.4 records AI search as *"a buyer-facing convenience… not
   the differentiator… incumbents can and will bolt it on."*

Task 3 (buyer NL search) sits directly in that tension and **is not
founder-approved by this document** — it needs an explicit decision before it
is built. Tasks 1 and 2 do not: structured vehicle data is load-bearing for
work that is already committed, and that is the justification to use —

- **M2 programmatic pages** need body-type/price-band/location facets to
  generate against, and the acceptance criteria require every page be backed by
  real stock. You cannot generate a "7-seaters under $30k in Canterbury" page
  from data you never captured.
- **The demand thesis** (AI crawlers reading structured data) is only as good
  as the Car JSON-LD, which today emits brand/model/year/odometer/offer and
  nothing else — no VIN, no engine, no transmission, no seating capacity, all
  of which schema.org/Car defines and all of which are columns that exist.
- **M6** exposes listings via an API/MCP surface for AI assistants. Sparse rows
  make that surface worthless.

**So: this package's centre of gravity is capture, not search.** If the session
can only do one thing, do Tasks 1–2 and stop.

---

## Session invariants

1. PR-only; never commit autonomously — present the diff and report, then stop.
2. **Frozen paths untouched**: the landing route group incl. `app/page.tsx`,
   `app/api/lead/route.ts`, `lib/security.ts`.
3. **Migrations are additive-only** (project rule, 22 migrations deep). No
   column drops, no type changes to existing columns, no RLS weakening. Every
   new column is nullable or defaulted — existing rows and the manual-entry
   path must keep working untouched.
4. The manual dealer-entry path stays the long-tail fallback (ROADMAP M1). New
   fields are **optional** on the form; a dealer who fills in nothing new must
   still be able to publish a listing.
5. No AI call may block a page render or an enquiry. The AI lane's existing
   discipline applies: provider behind `lib/ai/provider.ts`, zod-validated
   structured output with one retry then a safe fallback, and the fallback must
   be a *useful* result (see Task 3), never an error page.
6. Windows/PowerShell locally: one command per line, never `&&`.

---

## Task 1 — Audit: the data-point register (do this first, and stop here for review)

Produce `docs/vehicle-data-points.md`: every data point a NZ used-car buyer
plausibly filters or asks on, in one table, each row marked with

- **Status** — `captured` / `column exists, never written` / `missing entirely`
- **Source** — dealer-typed / dealer feed (M1) / VIN or plate lookup / derived
- **Used by** — browse filter, JSON-LD property, programmatic page axis, AI
  search, none

Verify every status claim **against the code**, not against this prompt. The
starting picture, from a read on 13 Sep 2026 — re-verify, it may have moved:

- **Captured** (16, via `app/(marketplace)/dealer/listings/new/new-form.tsx` →
  `createListingAction` in `app/(marketplace)/dealer/actions.ts:84`): make,
  model, year, variant, body_type, fuel, transmission, odometer_km, colour,
  price_nzd, suburb, city, region, description, cin_link, dealer_id.
- **Column exists, nothing ever writes it** (`supabase/migrations/20260621090300_listings.sql`):
  `drive`, `seats`, `engine_size_cc`, `cylinders`, `wof_expiry`, `rego_expiry`,
  `previous_owners`, `import_origin`, `condition`, `latitude`, `longitude`,
  `title`, `embedding`. Also the entire `listing_photos` table — unreferenced
  in app code (§9.4 already flags this, and ROADMAP M1 owns wiring it; **do not
  duplicate that work here**).
- **Missing entirely** — the interesting set:
  - **VIN and/or plate.** No column anywhere. This is the join key for
    CarJam/NZTA/PPSR (§9.6 lists the PPSR link-out as not built) and the only
    way to fill the spec fields *without* asking dealers to type them.
  - **Features / equipment.** No structured field. Real queries name features
    — towbar, ISOFIX, CarPlay, tow rating, sunroof, roof rails, reversing
    camera, heated seats. Today these are findable only if a dealer typed them
    into the optional free-text `description`.
  - **Derived facets** — price band, age band, km band; and a **normalised**
    make/model. `make` is free text matched with `ilike`
    (`app/(marketplace)/cars/page.tsx:36-51`), so "Toyota" / "TOYOTA" /
    "Toyata" are three different makes in the facet list. This is a
    data-quality bug today, independent of any AI.

For each *missing* row, state where the data would come from and what it costs
to get. Explicitly recommend a **minimum viable set** — the smallest set of new
fields that serves M2 grounding, the JSON-LD, and NL search — and a **defer**
set with reasons. Flag any field that is only worth capturing if the M1 feed
supplies it for free.

**Founder gate: stop after Task 1 and present the register.** The minimum
viable set is a founder decision, and it should be taken with the dealer sample
export in hand.

---

## Task 2 — Capture (only after Task 1 is approved and the sample export exists)

1. **Migration** (`supabase/migrations/<ts>_listing_search_fields.sql`),
   additive-only, implementing the approved minimum viable set. Expect it to
   include, subject to Task 1's findings:
   - `vin text` and `plate text` — nullable. **Treat both as sensitive:** decide
     and document whether they are publicly readable. A plate is a lookup key
     to an owner-adjacent record; the default should be *not* exposed to `anon`.
     Read §6.2's privacy posture and the RLS migrations before choosing, and
     remember the lesson in `20260904091000_revoke_anon_default_privileges.sql`
     — **`revoke … from public` does not lock a table down in this database;
     anon and authenticated hold explicit grants from ALTER DEFAULT PRIVILEGES,
     so revoke by role name.** Verify your choice with a test that reads as
     `anon`, not by reading the grant statements.
   - `features text[]` (or `jsonb`) with a **controlled vocabulary** defined in
     TypeScript, not free text — an uncontrolled feature list is unsearchable.
     Index it (GIN) if you use array containment in filters.
   - `make_normalised` / `model_normalised`, maintained by a trigger or a
     generated column, over a canonical make list. This is what the facet and
     the filters should key on; the display columns stay as typed.
   - Backfill for existing rows where it can be derived; never invent values.
2. **Extend the capture surfaces** so nothing stays write-only:
   - `new-form.tsx` + `createListingAction` cover every column the register
     marks as worth capturing, including the ones that already exist and are
     never written (`drive`, `seats`, `engine_size_cc`, `wof_expiry`, …). Keep
     the form usable — group the additions into a collapsed "Full specification
     (optional)" section rather than doubling the visible field count.
   - If an edit path for listings does not exist, note it; do not build one
     here unless it is trivial, and say so in the report either way.
3. **Spend the new data immediately**, or the capture is unproven:
   - `app/(marketplace)/cars/page.tsx` — filters for the new facets, keyed on
     the normalised columns. Fixing the make-facet duplication is part of this.
   - The Car JSON-LD in
     `app/(marketplace)/cars/[make]/[model]/[year]/[id]/page.tsx:80` — add every
     schema.org/Car property the new columns support (`vehicleTransmission`,
     `vehicleEngine`, `seatingCapacity`, `fuelType`,
     `driveWheelConfiguration`, `vehicleIdentificationNumber` *only if* Task 2.1
     concluded VIN is public). Re-validate in the Rich Results Test — ROADMAP
     M-1 still has that tick open.
4. **Tests**: vitest over the normalisation and the feature vocabulary; a SQL
   boundary test in the `PROMPT-T2` suite style asserting anon cannot read any
   column Task 2.1 decided is private.

---

## Task 3 — Buyer NL search (DO NOT BUILD without an explicit founder go-ahead)

Recorded here so the design exists when the decision is taken. If the go-ahead
is given, the architecture is **LLM → structured filters first, vector second**,
and the session should push back on any instruction to do it vector-first:

- "Auto SUV under $25k in Canterbury with seven seats" is a *structured* query.
  A parse to a filter object beats cosine similarity on it — on precision, on
  cost, and decisively on **explainability**: the result page shows removable
  chips (`SUV` · `auto` · `≤$25k` · `Canterbury` · `7+ seats`), so the buyer can
  see and correct what the machine understood. A vector hit list explains
  nothing and cannot be corrected.
- Implementation shape: a versioned prompt (`search.v1`, alongside
  `qualify.v1` / `draft.v1`) → zod-validated filter object → the *existing*
  query builder on `/cars`. One retry, then the safe fallback: **fall back to
  the current keyword search and say so**, never an error.
- Vector earns its place only on the vibe tail ("something reliable for a first
  car"): embed `title + description + features`, backfill, and enable the HNSW
  index that `20260621090300_listings.sql` deliberately leaves commented out at
  the bottom of the file. Use it to **re-rank or to rescue a zero-result
  structured query**, not as the primary path. Note the embedding column is
  1536-d and commented as OpenAI `text-embedding-3-small`, while the default
  provider is `workers-ai` — reconcile the dimension with whatever model is
  actually chosen, in the migration, before backfilling anything.
- Compliance: the parse is AI output about *the buyer's query*, not claims
  about a vehicle, so `lib/ai/guard.ts` may not be the right screen — reason
  about it explicitly rather than bolting the existing guard on. Whatever is
  shown to the buyer must not assert anything about a car that the row does not
  say.
- Cost/latency budget: the parse runs on a buyer keystroke path. Cache by
  normalised query string, and never let it block first paint of the results
  that structured filters can already produce.

---

## Gate

`tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build` · local
`npx playwright test` fully green (`npm run e2e:setup` first; local stack up) ·
the `e2e.yml` job green on the PR. Additionally: the migration applies cleanly
on a fresh `supabase db reset` **and** as an increment over an existing
database, and an existing listing created before the migration still renders,
edits and appears in browse results unchanged.

## Report

The data-point register's headline numbers (captured / write-only / missing,
before and after). Which fields you added and which you deferred, with the
reason for each deferral. The VIN/plate privacy decision and the test that
proves it. What the new data visibly bought — filters, JSON-LD properties, M2
page axes now generatable. Whether Task 3 was authorised, and if not, what
remains blocked on it. Anything the dealer sample export revealed that
contradicts this prompt — that contradiction is the most valuable thing in the
report, say it plainly. Stop — do not commit.
