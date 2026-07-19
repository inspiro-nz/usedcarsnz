# Mystery-shopper protocol — the first-party speed-to-lead baseline

*Created 19 July 2026. This is the method behind roadmap 30-day item 1. The
number it produces ("I enquired on N Christchurch listings in July and the
median first reply took X hours") is the preferred evidence in every dealer
conversation (Strategy v5.7 §4.2) — it replaces the recycled US studies and
carries zero attribution risk. That only holds if the method is defensible, so
follow this protocol and keep the raw log.*

**Do not confuse this with pilot baseline option (a).** This protocol is the
anonymous, market-wide stat for conversations. Per-dealer baseline
mystery-shopping for pilot measurement is separate, **consented in the pilot
agreement** (Schedule A), and happens later.

## Sample design (before sending anything)

- **n = 10 listings minimum**, all Christchurch.
- **≥ 8 different dealers** — never more than two listings from one dealer, or
  one slow dealer drags the whole median.
- **Channels:** ~7 Trade Me, ~3 AutoTrader (mirrors where dealers actually
  are; note channel per row).
- **Stock:** mainstream retail band (~$8k–$35k), no auctions, dealers only
  (no private sellers — the pitch is about dealer response).
- **Timing spread — this is the point:** ~4 enquiries during business hours,
  ~3 weekday evenings (after 6pm), ~3 weekend. The after-hours gap is the
  product's core claim; the sample must be able to show it.
- **Exclusion:** do not shop any dealer on the five-conversation visit list
  within two weeks before their meeting. If a dealer you later meet asks
  whether they were in the sample, answer honestly.

## The enquiry

Use a genuine, answerable buyer question, varied slightly per listing so
replies aren't template-detected. Base form:

> "Hi, is this still available? Roughly what would the cash price be, and
> could I view it this week?"

Rules: real contact details (a dedicated email you check, e.g. a plus-alias;
phone optional — if given, answer calls politely); never fabricate a trade-in,
finance need, or identity; never book an appointment; when a dealer follows
up, close the loop within a day — *"Thanks for coming back to me — I've gone
another way. Appreciate the quick reply."* The cost to each dealer should be
one reply.

## Measurement rules

- Record the **send timestamp** the moment each enquiry goes.
- **Auto-acknowledgment ≠ first response.** Record both, separately:
  - `t_auto` — any automated/template reply (including Motorcentral
    Auto Attendant-style responders). Interesting data; not the headline.
  - `t_human` — the first reply that engages with the actual question
    (availability/price/viewing). **The headline metric is minutes from send
    to `t_human`.**
- If a phone call arrives first, that call is `t_human` — log the call time.
- Observation window: **7 days**. No human reply in 7 days → record as
  "no response (>7 days)" and **include it in the story but not the median**
  (report it as its own count: "2 of 10 never replied").

## Capture log (one row per enquiry — keep this file updated as you go)

| # | Channel | Dealer | Listing (short) | Sent (date, time) | t_auto | t_human | Mins to human | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| … | | | | | | | | |

## Reporting rules (Fair Trading Act discipline)

- Quote **median minutes-to-first-human-reply**, always with the frame:
  *"n = 10 Christchurch dealer listings, July 2026, my own enquiries."*
- Also usable: the after-hours vs business-hours split, and the no-response
  count. Report what happened, including anything that undercuts the pitch
  (a market full of fast responders is a finding, not a failure — it feeds
  the §12.2 assessment honestly).
- **Never** extrapolate to "NZ dealers take X on average", never blend this
  with the US studies into one figure, and never name a specific dealer's
  time in another dealer's meeting.
- Keep the completed log (and the reply emails) as substantiation — the FTA
  bars unsubstantiated representations, and this log is the substantiation.

## Effort

~1 hour to send on day one (staggered per the timing spread), ~10 minutes a
day logging replies for a week. Do it the same week as the demo stand-up so
the number is fresh for the first meeting.
