# Legal consult brief — UsedCarsNZ (one meeting, four workstreams)

*Prepared 19 July 2026 to accompany the booking (Strategy v5.7 §14 item 6 —
URGENT). Purpose: define the scope tightly enough that the solicitor can quote
a fixed fee, and arrive at the meeting with every document already read. This
brief is founder-prepared with AI assistance and is a question list, not a
position.*

## Who we are, in four sentences

Inspiral NZ Ltd operates UsedCarsNZ, a pre-revenue platform for NZ used-car
dealers: every buyer enquiry gets a **templated, non-AI acknowledgment in under
60 seconds**, an **always-labelled AI assistant** qualifies the buyer, and any
substantive reply exists only as a **draft that a dealer must approve before it
sends** — enforced in the database, not by policy. A five-dealer Christchurch
pilot is imminent; the pilot is free and involves dealers routing their
existing Trade Me enquiry emails through the platform. Revenue is planned
later, primarily via finance referrals — **currently blocked, by our own rule,
until this consult**. We are a solo-founder bootstrap; proportionate answers
matter more than exhaustive ones.

## Materials sent with this brief

1. `docs/legal/pilot-agreement-DRAFT.md` — pilot agreement scaffold with
   **[LAWYER: …] markers on every clause needing judgment**
2. The `/privacy` page copy (currently live behind the demo wall, banner-marked
   placeholder)
3. `docs/architecture.md` — one-page system description (what actually happens
   to data)
4. Strategy v5.7 §7 — the compliance boundaries the system is built to

## Workstream A — FTA / CGA scope of the AI (design sign-off)

- A1. Does the two-lane design (templated ack; labelled AI questions from an
  approved-facts list; human approval before any vehicle-specific statement)
  adequately contain Fair Trading Act 1986 / Consumer Guarantees Act 1993
  misrepresentation risk for **the platform** (as distinct from the dealer)?
- A2. Is our in-trade disclosure + Consumer Information Notice link on every
  dealer listing sufficient as implemented, or does the CIN need particular
  presentation?
- A3. Demo honesty: seeded metrics carry a visible "Sample data — not measured
  results" badge plus a spoken disclaimer. Adequate, or is more needed?
- A4. When we later publish measured conversion metrics, what substantiation
  should we retain to be safe on unsubstantiated-representations exposure?

## Workstream B — Finance referral bright line (the revenue blocker)

Context: the CCCFA enforcement transfer to the FMA completed July 2026; our
prior reason to defer this question is gone. Intended model: the AI detects
finance interest, asks if the buyer wants to be connected, and passes the lead
to a licensed partner for a fee. **It never recommends, compares or opines.**

- B1. Is that bare-referral model outside "regulated financial advice" under
  the FMCA (as amended by FSLAA)? Where exactly is the line in the wording the
  AI may use?
- B2. Do we need FSPR registration and/or dispute-resolution-scheme membership
  to receive referral fees in this model?
- B3. What written arrangement with the finance partner protects us, and what
  disclosure does the buyer need at the point of referral?
- B4. Anything about an **AI** performing the detect-and-offer step (vs a
  human) that changes the analysis?

## Workstream C — Privacy Act 2020 (email lane + retention)

- C1. Review/rewrite the `/privacy` page copy for public launch.
- C2. Roles: dealer as collecting agency, platform as processor on the
  dealer's behalf — is that characterisation right, and does the pilot
  agreement express it adequately (draft cl 5)?
- C3. Retention: raw inbound emails auto-purge at 30 days (deployed job).
  The structured enquiry record needs a defined retention period — advise one.
- C4. The audit event log is **append-only by design** (tamper-evidence is the
  product). Deletion requests are honoured by de-identification rather than
  log mutation. Does that satisfy IPP 9 and deletion expectations?
- C5. Breach-notification wording between platform and dealer (draft cl 5.7).

## Workstream D — Pilot agreement review

Review `pilot-agreement-DRAFT.md` as the working text. The specific markers:
agency/processor (5.1), Trade Me dealer-terms question on forwarding (4.2),
retention/post-termination (5.4, 10.2), breach timeframe (5.7), liability
allocation for dealer-approved drafts and the cap (7.2, 11.2), and the FMCA
exclusion wording (3.5). Schedule A (baseline method) will have one option
selected before signature.

## Out of scope for this consult

Company structuring, IP assignment, employment, tax, and the eventual paid
dealer plan's terms (that contract does not exist yet and is gated on pilot
results).

## Timing

The pilot targets first dealer signatures within ~4–6 weeks; the pilot cannot
start before the agreement is settled, and no referral revenue will be taken
before Workstream B is answered. A staged response (D+C first, B before any
referral goes live) is acceptable if it lowers cost.

---

*Not legal advice; this document only organises the questions.*
