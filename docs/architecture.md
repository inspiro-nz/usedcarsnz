# UsedCarsNZ — Architecture

*Created 19 July 2026, verified against `develop`. One page, four diagrams.
GitHub renders the Mermaid blocks natively.*

## The two invariants (read these first)

1. **The OpenNext app worker exports only `fetch`.** It cannot hold a
   `scheduled` handler, so **every cron job is a standalone Worker** under
   `workers/` that POSTs an authenticated app endpoint. Do not consolidate
   crons onto the app worker — the trigger would fire into a void.
2. **`lead_events` is append-only, enforced by a DB trigger** (UPDATE/DELETE/
   TRUNCATE rejected for every role). Corrections are appended as compensating
   events, never mutations. Every conversion metric reads exclusively from this
   log — its immutability *is* the product's proof claim.

---

## 1. System context

Everything user-facing runs through the OpenNext app worker; four standalone
Workers handle email ingestion and schedules. Supabase holds all state; Resend
sends; Email Routing receives; Access walls the demo.

```mermaid
flowchart LR
    Buyer([Buyer])
    Dealer([Dealer])
    Admin([Founder / Admin])

    subgraph CF["Cloudflare"]
        Access["Access wall<br/>(demo only, one-time PIN)"]
        App["App Worker (OpenNext)<br/>fetch only — marketplace, APIs,<br/>dealer inbox, metrics"]
        Turnstile["Turnstile"]
        ER["Email Routing<br/>catch-all lead-*@usedcarsnz.co.nz"]
        WEI["Worker: email-inbound<br/>postal-mime → HMAC POST"]
        WKA["Worker: keepalive<br/>daily"]
        WOS["Worker: outbox-sweep<br/>every 15 min"]
        WRP["Worker: raw-email-purge<br/>daily"]
    end

    subgraph SB["Supabase"]
        DB[("Postgres + RLS<br/>lead_events (immutable)<br/>ai_drafts, enquiries,<br/>email_outbox")]
        Auth["Auth"]
        Storage["Storage (raw email MIME)"]
    end

    Resend["Resend (outbound email)"]
    AI["Workers AI (default)<br/>Anthropic (escalation)"]

    Buyer -->|browse, enquire, chat| Access --> App
    Dealer -->|inbox, approve drafts| App
    Admin -->|approval queue| App
    Buyer -.->|Trade Me enquiry email| ER --> WEI -->|HMAC-signed POST<br/>/api/inbound/email| App
    App --- Turnstile
    App --> DB
    App --> Auth
    App -->|ack + approved replies| Resend
    App -->|qualify + draft| AI
    WKA -->|keepalive_ping insert| DB
    WOS -->|POST /api/cron/outbox-sweep| App
    WRP -->|POST /api/cron/purge-raw-email| App
    WEI --> Storage
```

## 2. The two AI lanes and the approve→send gate

Lane 1's send path is deterministic — no LLM can delay or distort the sub-60s
acknowledgment. Lane 2's LLM output can only ever become a buyer-visible
message through the DB-enforced dealer approval gate.

```mermaid
flowchart TB
    E["Buyer enquiry<br/>(form or email lane)"]

    subgraph L1["Lane 1 — deterministic (no LLM in send path)"]
        ACK["Templated acknowledgment<br/>sent in seconds via Resend"]
        OB["email_outbox<br/>(on send failure; swept every 15 min)"]
    end

    subgraph L2["Lane 2 — LLM, draft-only"]
        Q["Qualify (budget, finance,<br/>trade-in, timeline, intent)"]
        G["guardReply claims-screen<br/>(lib/ai/guard.ts)"]
        D["ai_drafts row, status = draft"]
    end

    GATE{"Dealer approves?<br/>approve_draft() — security definer;<br/>CHECK: approved requires<br/>approved_by AND approved_at"}
    SEND["Reply sent to buyer"]
    LOG[("lead_events — append-only,<br/>every step timestamped")]

    E --> ACK
    ACK -.->|failure| OB
    E --> Q --> G --> D --> GATE
    GATE -->|"yes (atomic: status + event)"| SEND
    GATE -->|no| D
    E --> LOG
    ACK --> LOG
    D --> LOG
    SEND --> LOG
```

Compliance is proven by feeding deliberately bad output through `guardReply`
via the deterministic mock adapter (`lib/ai/__tests__/fake-provider.ts`) — a
green live-model run proves nothing about the envelope (Strategy §7).

## 3. Environments and deploy topology

Two cloud environments plus local — there is no cloud dev project (Supabase
free tier caps at two). Production deliberately has **no CI deploy**.

```mermaid
flowchart LR
    subgraph Local["LOCAL — the dev environment"]
        LDev["Supabase CLI (Docker)<br/>http://127.0.0.1:54321<br/>npm run dev"]
    end

    subgraph GH["GitHub"]
        Dev["develop (integration, PR-only)"]
        Main["main (prod — currently behind develop)"]
        DemoB["demo (deploy trigger)"]
        PA["Action: Promote demo<br/>(force-push ref → demo,<br/>then dispatch deploy)"]
        DD["Workflow: deploy-demo.yml<br/>app + 3 cron workers"]
    end

    subgraph Demo["DEMO — demo.usedcarsnz.co.nz"]
        DApp["usedcarsnz-demo Worker (env.demo)<br/>behind Cloudflare Access<br/>X-Robots-Tag: noindex<br/>DEMO_SAMPLE_DATA=true"]
        DSB[("Supabase usedcarsnz-demo<br/>ttwsmrsgdqzjnobflihd")]
    end

    subgraph Prod["PROD — usedcarsnz.co.nz"]
        PApp["usedcarsnz Worker<br/>landing page only today<br/>manual npm run deploy"]
        PSB[("Supabase usedcarsnz-prod<br/>geappcqiihbgihcsitkj")]
    end

    Dev --> PA --> DemoB --> DD --> DApp
    DApp --> DSB
    Main -.->|manual deploy only| PApp
    PApp -.-> PSB
```

Secrets live in three places, set once each: the app worker
(`wrangler secret put <NAME> --env demo`: `SUPABASE_SECRET_KEY`,
`TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, optional
`ANTHROPIC_API_KEY` / `INBOUND_HMAC_SECRET`); each standalone worker (keepalive
→ `SUPABASE_SECRET_KEY`; sweep/purge → `CRON_SECRET` + `CF_ACCESS_*`;
email-inbound → `INBOUND_HMAC_SECRET`); and GitHub repo secrets for the deploy
workflow (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, three
`DEMO_NEXT_PUBLIC_*`). Names only here — values never appear in the repo.

## 4. Cron wiring

Thin scheduled Workers poke authenticated app endpoints; the tested logic stays
in the app. `TARGET_URL` resolution is the part people get wrong — CI overrides
it to demo; the config default (prod) applies only to manual deploys.

```mermaid
flowchart LR
    subgraph Crons["Standalone Cron Workers"]
        KA["keepalive — 0 12 * * *<br/>(daily, ~midnight NZ)"]
        OS["outbox-sweep — */15 * * * *"]
        RP["raw-email-purge — 30 13 * * *"]
    end

    KA -->|"insert keepalive_ping<br/>(defeats 7-day free-tier pause)"| DSB[("Demo Supabase")]

    OS --> T{"TARGET_URL<br/>CI deploy: --var → demo host<br/>manual deploy: config default → prod"}
    RP --> T
    T -->|"Authorization: Bearer CRON_SECRET<br/>+ CF-Access-Client-Id / -Secret<br/>(service token through the Access wall)"| API["App /api/cron/*<br/>verifyCronRequest:<br/>constant-time compare,<br/>fails closed 503 if secret unset"]
    API -->|sweepOutbox: retry failed acks| DSB
    API -->|"purge raw MIME > 30 days<br/>(the /privacy retention mechanism)"| DSB
```

Never set worker **vars** in the Cloudflare dashboard: `wrangler deploy` runs
with `--keep-vars` false, so every CI deploy re-asserts config/`--var` values
and silently clobbers dashboard edits. Secrets are never clobbered. Schedules
are deliberately offset so no two jobs collide. Full table:
`docs/infra/cron-schedules.md`.
