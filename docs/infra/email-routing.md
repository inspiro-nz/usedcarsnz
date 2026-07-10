# Runbook — Cloudflare Email Routing for the inbound-lead lane (§5.3)

*This is manual work for the operator (Chris). The code is done; this is the
dashboard/DNS/secret setup that turns it on. Do the steps in order — the DNS
collision check in step 4 is the one that can break outbound email if rushed.*

**Zone:** `usedcarsnz.co.nz` (Cloudflare)
**Worker:** `usedcarsnz-email-inbound` (from `workers/email-inbound/`)
**App endpoint:** `POST https://usedcarsnz.co.nz/api/inbound/email`

---

## 0. Prerequisites

- `usedcarsnz.co.nz` is on Cloudflare with Cloudflare-managed DNS.
- Resend is already the **sending** provider (the app's acks send as
  `no-reply@usedcarsnz.co.nz`). **Do not remove any existing Resend DNS records.**
- You can run `wrangler` (installed as a dev dependency).

---

## 1. Generate and set the shared HMAC secret

The Worker signs each POST; the app verifies it. They must share one secret.

```
# generate
openssl rand -hex 32
```

- **App side:** set `INBOUND_HMAC_SECRET` to that value in the app Worker's env
  (Cloudflare dashboard → the `usedcarsnz` app Worker → Settings → Variables →
  **Encrypt**), and mirror it in `.env.local` for local dev.
- **Worker side:** from `workers/email-inbound/`:
  ```
  wrangler secret put INBOUND_HMAC_SECRET
  ```
  Paste the SAME value.

Also set on the app: `FOUNDER_EMAIL` (where unknown-alias / unparseable-mail
notices go — an external inbox).

---

## 2. Deploy the Email Worker

From `workers/email-inbound/`:

```
# edit wrangler.jsonc first:
#   FOUNDER_FORWARD_ADDRESS -> the founder's EXTERNAL inbox (NOT a @usedcarsnz.co.nz
#     address — that would loop through the catch-all)
#   APP_INBOUND_URL         -> https://usedcarsnz.co.nz/api/inbound/email
wrangler deploy
```

---

## 3. Enable Email Routing and add the destination address

Cloudflare dashboard → **`usedcarsnz.co.nz` → Email → Email Routing**:

1. Click **Enable Email Routing**. Cloudflare will propose the **MX** and **SPF**
   (TXT) records it needs to *receive* mail — **do not accept blindly yet**; go to
   step 4 first to reconcile them with Resend, then accept.
2. Under **Destination addresses**, add the founder's external inbox (the
   `FOUNDER_FORWARD_ADDRESS` from step 2) and **click the verification link**
   Cloudflare emails there. `message.forward()` only works to a verified
   destination.

---

## 4. DNS collision check with Resend (do this carefully)

Inbound (Email Routing) and outbound (Resend) touch **different** DNS records.
The only real overlap risk is the **root MX** and the **root SPF TXT**.

| Record | Owner | Value (confirm exact strings in dashboard) | Notes |
|---|---|---|---|
| `MX  usedcarsnz.co.nz` | **Email Routing** | `route1.mx.cloudflare.net` (prio 3x), `route2…`, `route3…` | Receiving. Cloudflare adds all three. |
| `TXT usedcarsnz.co.nz` (SPF) | **shared** | `v=spf1 include:_spf.mx.cloudflare.net include:_spf.resend.com ~all` | **Merge, don't duplicate.** One SPF TXT only — it must include BOTH Cloudflare (receiving/forwarding) and Resend (sending). Two separate `v=spf1` records = broken SPF. |
| `CNAME resend._domainkey…` / DKIM | **Resend** | (unchanged) | Sending. Leave as-is. |
| `MX  send.usedcarsnz.co.nz` (or Resend's custom MAIL FROM subdomain) | **Resend** | `feedback-smtp…amazonses.com` | If present, it's on a **subdomain** — no collision with the root MX above. Leave as-is. |
| `TXT _dmarc.usedcarsnz.co.nz` | shared | `v=DMARC1; p=none; rua=…` | Keep/relax as needed; both flows benefit. |

**Procedure:**
1. Note the current root SPF TXT (Resend's).
2. When enabling Email Routing, if it wants to add a *second* `v=spf1` record,
   instead **edit the existing one** to include `include:_spf.mx.cloudflare.net`.
3. Accept Email Routing's **MX** records (root had no MX before if the domain
   only sent mail — confirm there was no conflicting root MX).
4. Leave every Resend DKIM/CNAME and any Resend subdomain MX untouched.

After propagation, Email Routing's dashboard should show **healthy** for MX + SPF,
and a Resend domain re-check should still show **verified**.

---

## 5. Route lead mail to the Worker

Email → Email Routing → **Routing rules**:

- Set the **Catch-all address** action to **Send to a Worker →
  `usedcarsnz-email-inbound`**, and **enable** the catch-all.

Why catch-all: dealers use per-dealer `lead-{slug}@` locals we provision on
demand; a catch-all means we don't add a routing rule per dealer. The Worker
itself decides: `lead-*` → parse & POST; anything else (incl. forwarding
confirmations) → forward to the founder.

> If you'd rather not catch-all the whole domain, add one **custom address** rule
> per `lead-{slug}@` → Worker instead. More rules to manage, same result.

---

## 6. Provision a dealer alias (per dealer)

Aliases are **admin-only** (`dealer_aliases` has no self-serve insert). For each
pilot dealer, insert their alias against the correct dealer (service-role / SQL):

```sql
insert into public.dealer_aliases (dealer_id, alias, source_hint, active)
values ('<dealer-uuid>', 'lead-addington-autos', 'trademe', true);
```

`source_hint` = `trademe` tags leads as `email_trademe`; anything else use
`generic` (→ `email_other`). Then give the dealer their
`lead-addington-autos@usedcarsnz.co.nz` address (see
`docs/dealer-onboarding-email.md`).

---

## 7. Smoke test after go-live

1. From a personal inbox, send an email to `lead-{a-test-slug}@usedcarsnz.co.nz`
   (provision the test alias first).
2. Confirm: an enquiry appears (source `email_*`), the buyer gets the ack (unless
   the dealer opted out), and the raw email lands in the `inbound-email-raw`
   bucket.
3. Send one to a **non-lead** local (e.g. `hello@usedcarsnz.co.nz`) and confirm it
   forwards to the founder inbox, not created as a lead.

---

## Deferred (Prompt 7, not part of this setup)

- **CRON** for `public.purge_inbound_email_raw()` (30-day raw-MIME purge) and the
  `email_outbox` sweep. The purge function exists; nothing calls it on a schedule
  yet.
- If the app is later put behind **Cloudflare Access**, the Worker's POST needs a
  **service token** (`CF-Access-Client-Id` / `CF-Access-Client-Secret`) added to
  `action.signed.headers`. Local dev and a public endpoint need none.
