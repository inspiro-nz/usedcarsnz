# Dealer onboarding — forward your Trade Me leads

*Audience: a Founding-Dealer pilot participant. One-time setup, ~3 minutes.*

## The one-line explanation for the dealer

> "Set one auto-forward rule so a copy of every Trade Me enquiry email also goes
> to your private UsedCarsNZ address. We reply to the buyer within a minute,
> qualify them for you, and drop the lead straight on your desk — you keep doing
> exactly what you do now."

Your private address is:

```
lead-{your-slug}@usedcarsnz.co.nz
```

We create this for you and send it to you — you never pick it yourself (it's how
we route leads to the right dealer, so it has to be exact).

> **Privacy:** forwarded buyer emails are processed under the pilot agreement.
> The original email is retained for **30 days** for troubleshooting, then
> automatically deleted. See the pilot agreement, clause *Data handling &
> retention*.

---

## Gmail — set up forwarding

1. In Gmail, click the **gear icon → See all settings**.
2. Open the **Forwarding and POP/IMAP** tab.
3. Click **Add a forwarding address**.
4. Enter your `lead-{your-slug}@usedcarsnz.co.nz` address and click **Next → Proceed**.
5. Gmail sends a **confirmation email** to that address. We receive it for you and
   forward it back so you can click the confirmation link (or tell us the code).
   *This is the "forwarding-confirmation flow" — see below.*

   > _[screenshot placeholder: Gmail "Add a forwarding address" dialog]_

6. Once confirmed, in **Settings → Filters and Blocked Addresses → Create a new
   filter**:
   - **From:** `no-reply@trademe.co.nz` (or the address your Trade Me lead emails
     come from — check a recent one).
   - Click **Create filter**, tick **Forward it to** `lead-{your-slug}@…`, click
     **Create filter**.

   > _[screenshot placeholder: Gmail filter "Forward it to" step]_

   Filtering to just Trade Me emails (rather than forwarding *everything*) keeps
   your unrelated mail private.

---

## Outlook / Microsoft 365 — set up forwarding

1. **Settings (gear) → Mail → Rules → Add new rule**.
2. Name it "Forward Trade Me leads".
3. **Add a condition → From →** the address your Trade Me lead emails come from.
4. **Add an action → Forward to →** `lead-{your-slug}@usedcarsnz.co.nz`.
5. **Save.**

   > _[screenshot placeholder: Outlook "Add a rule" with Forward-to action]_

Outlook usually does **not** require a separate confirmation step. If it sends a
verification email, we handle it the same way as Gmail (below).

---

## The forwarding-confirmation flow (what happens & why)

Gmail (and sometimes Outlook) won't forward to a new address until it's confirmed.
It emails a confirmation link/code **to your `lead-…` address**.

Our system recognises that this is a setup email (not a buyer lead) and **forwards
it to the UsedCarsNZ founder inbox** automatically. We then:

- click the link on your behalf, or
- send you the confirmation code to paste into Gmail.

You'll get a quick note from us either way. Once confirmed, real leads start
flowing — you don't need to do anything else.

---

## What the buyer sees

Within about a minute of a Trade Me enquiry, the buyer gets a short, friendly
acknowledgement that:

- comes from **"{Your Business} via UsedCarsNZ"**, with replies going to **you**;
- says a team member will follow up personally;
- is clearly labelled as coming from **your AI assistant**, and that **a human
  replies to anything about the vehicle itself** (we never let the AI make claims
  about the car, warranty, or finance).

Prefer no auto-acknowledgement? Tell us and we'll turn it off for your account
(the lead and qualification still reach you — only the buyer auto-reply is
suppressed).
