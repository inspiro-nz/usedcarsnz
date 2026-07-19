# Demo runbook — the dealer meeting

The document you rehearse from before a dealer meeting. Print it or keep it open
on the laptop. The goal of the demo is one thing: **the dealer sees a buyer
enquiry answered in under 60 seconds, then sees the human-approved reply and the
honest metric.** Everything below serves that money shot.

Related: `docs/infra/demo-standup.md` (one-time stand-up), `docs/infra/cron-schedules.md`.

> **The one line you must say out loud at the dashboard (verbatim):**
> *"These are sample numbers showing what your dashboard will look like — the
> metric we publish will only ever be measured data."*

---

## 1. T‑1 day — prepare

Do this the day before, not on the morning of.

- [ ] Refresh the demo: GitHub → **Actions** → **Promote demo** → **Run
  workflow** (leave `ref` as `develop`). This re-points the `demo` branch and
  dispatches the deploy. *(Fallback if Actions is down: `git checkout -B demo
  develop` then `git push -u origin demo --force`.)*
- [ ] Confirm the demo deploy succeeded (GitHub Actions → Deploy demo → green).
- [ ] Confirm `email_outbox` has no stuck rows (sweep cron healthy — a growing
  outbox means acks are failing to send).
- [ ] Seed the demo data (against the demo project — the script refuses prod):

```
npm run seed:demo
```

- [ ] Run the latency check against the deployed demo and confirm it passes:

```
npm run latency-check
```

  (Needs `DEMO_URL`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` exported —
  see the script header. If any route FAILs, fix before the meeting, don't wing it.)

- [ ] **Capture the offline fallback:** screen-record the full money-shot flow
  end to end (section 3) and save it to the laptop *and* your phone. If the venue
  or the demo env dies, you narrate over this recording.
- [ ] Charge the phone to 100%. Charge the laptop.
- [ ] Test your phone hotspot works and the laptop can join it.

---

## 2. T‑30 minutes — arm the demo

At the venue, before the dealer sits down.

- [ ] **Authenticate BOTH devices through Cloudflare Access** (laptop and phone).
  Open the demo URL on each, complete the one-time PIN emailed to your
  allow-listed address. Do this now so no PIN screen appears mid-demo.
- [ ] Reset to a clean, worked-in baseline:

```
npm run demo:reset
```

- [ ] Pre-warm the demo URLs on both devices (first hit pays the cold/ISR cost):
  open `/cars`, one listing, and `/dealer` so they are cached.
- [ ] On the **laptop**: open the dealer **lead inbox** (`/dealer/leads`).
- [ ] On the **phone**: open the **listing** you'll enquire on.
- [ ] **Dry-run one enquiry end to end** yourself (phone → inbox → approve),
  **and confirm the ack email actually arrived in the buyer inbox on the
  phone** — if it did not, `RESEND_API_KEY` is missing on the demo worker;
  fix before the dealer arrives. The inbox entry appearing is NOT proof the
  email sent.
- [ ] Reset once more so the dealer sees a clean board:

```
npm run demo:reset
```

---

## 3. The 5‑minute choreography

Say the lines; do the actions. Keep the laptop facing the dealer.

1. **"Watch what happens when a buyer enquires on your car."**
   On the **phone**, submit the enquiry form on the open listing.
2. **Point at the laptop.** Within a few seconds the enquiry appears in the inbox
   and the buyer has already had an acknowledgement.
   **"That acknowledgement went out in under a minute — automatically. No LLM in
   that path, so it can't be slow and it can't go off-script."**
3. On the **phone**, open the buyer thread and send **two chat messages** (e.g.
   *"Is it still available?"*, *"Can I view it Saturday?"*). Let the AI assistant
   reply — note the **"AI assistant of {dealer}"** label.
   **"The buyer's talking to your assistant — always labelled as AI, never
   pretending to be you."**
4. On the **laptop**, a **draft reply appears in the inbox** for approval.
   **Edit one line** of it so the dealer sees it's theirs to change.
5. Click **Approve & send.**
   **"Nothing goes to the buyer until you approve it. You're always the human in
   the loop."**
6. Open the lead **timeline**. Point at the first-response time and the event log.
   **"This is the immutable log — first-response time, every step, tamper-proof.
   This is the number we publish."**
7. Open the **dashboard** (`/dealer`). Point at the median first response.
   **Say the sample-data line out loud, verbatim:**
   > *"These are sample numbers showing what your dashboard will look like — the
   > metric we publish will only ever be measured data."*
   (The **"Sample data"** badge is on screen while you say it.)

Stop there. That's the shot.

---

## 4. If something breaks

| Symptom | Do this |
|---|---|
| **Venue wifi is bad / dropping** | Switch both devices to your **phone hotspot** (you tested it at T‑1). |
| **Demo environment is down / won't load** | Switch to the **screen recording** from T‑1 and narrate over it — same script, section 3. |
| **AI reply is slow, or the Neuron/model cap is hit** | Do not panic or wait. **The acknowledgement already landed — it never had an LLM in its path.** Say so, then narrate the draft-and-approve step from the recording. The money shot (sub-60s ack + human approval) does not depend on the model being fast. |
| **A chat turn errors** | The thread degrades to "the team will come back to you" by design — point that out as a feature (it never looks broken to a buyer), and move to the inbox draft. |

---

## 5. After the meeting

- [ ] Reset the demo so the next meeting starts clean:

```
npm run demo:reset
```

- [ ] **Leave-behind (optional):** if the dealer wants to poke at it themselves,
  add their email to the Cloudflare Access allow-list (Zero Trust → Access →
  the demo app → the Allow policy) so they can log in with a one-time PIN. Remove
  it later if the pilot doesn't proceed.
- [ ] **Capture their objections** while fresh — template:

```
Dealer:
Their current lead tool / process:
Biggest objection:
What made them lean in:
Follow-up owed (and by when):
```

- [ ] Note anything in the demo that felt slow or off, so it gets fixed before the
  next one.
