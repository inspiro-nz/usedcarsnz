# UsedCarsNZ Pilot Programme Agreement — DRAFT

> ## ⚠️ DRAFT — NOT LEGAL ADVICE — DO NOT SIGN
>
> This is a **founder-prepared scaffold** (drafted with AI assistance, 19 July
> 2026) whose purpose is to make the lawyer's review faster and cheaper by
> showing exactly what the system does and what the pilot needs. It has **not**
> been reviewed by a lawyer, is **not** legal advice, and must be reviewed and
> rewritten by an NZ solicitor before it is put in front of any dealer
> (Strategy v5.7 §14 item 6(d)). Items needing legal judgment are marked
> **[LAWYER: …]**. The system descriptions in clauses 3–5 are accurate to the
> code as at 19 July 2026 and should survive review largely intact.

---

**PARTIES**

1. **Inspiral NZ Limited**, trading as UsedCarsNZ (**"the Platform"**)
2. **[Dealer legal name]**, NZBN [ ], of [address], a registered motor vehicle
   trader (**"the Dealer"**)

**BACKGROUND**

A. The Platform operates a lead-response and co-listing service for New Zealand
   motor vehicle dealers: every buyer enquiry receives an automated
   acknowledgment in under 60 seconds, is qualified by a clearly-labelled AI
   assistant, and is handed to the Dealer as a warm lead, with response-time and
   conversion metrics recorded in a tamper-evident event log.
B. The parties wish to run a time-limited pilot to measure, honestly and
   per-lead, whether the service improves the Dealer's enquiry-to-appointment
   performance against a baseline (Schedule A).
C. The pilot is **free of charge** to the Dealer, and neither party is obliged
   to continue after it ends.

---

## 1. Term

1.1 The pilot runs for **two months** from the Go-Live Date (the date the
    Dealer's enquiry flow is first connected under clause 4), unless ended
    earlier under clause 10.

1.2 Either party may end the pilot at any time on **five working days'** written
    notice, without giving reasons and without penalty.

## 2. Fees

2.1 The pilot is free. No fees, commissions or charges of any kind are payable
    by the Dealer during the pilot.

2.2 Nothing in this agreement obliges either party to enter any paid
    arrangement after the pilot.

## 3. What the service does (and does not do)

3.1 **Instant acknowledgment.** Every buyer enquiry receives a **fixed,
    templated acknowledgment** — not written by an AI model — sent
    automatically, typically within seconds, 24/7.

3.2 **Labelled AI assistant.** A software assistant, **always visibly labelled
    as an AI assistant**, may ask the buyer qualification questions (budget,
    finance interest, trade-in, timeline, location, intent) and answer routine
    generic questions from an approved-facts list.

3.3 **Human approval before substantive replies.** Any free-text or
    vehicle-specific reply to a buyer is generated only as a **draft** for the
    Dealer. **Nothing is sent to a buyer until a person authorised by the
    Dealer approves it.** This is enforced in the Platform's database, not
    merely by policy.

3.4 **The AI must not, and is built so it cannot without approval:** make
    claims about a specific vehicle's condition, history or specifications;
    state or imply Consumer Guarantees Act rights or warranty positions; or
    make any representation the Dealer has not approved.

3.5 **No finance or insurance referrals during the pilot.** The service will
    not recommend, arrange or refer finance or insurance during the pilot.
    **[LAWYER: this exclusion is deliberate pending the FMCA/FSLAA
    advice-vs-referral review; confirm wording keeps the pilot clear of
    regulated financial advice.]**

3.6 **Metrics.** Every step of every lead is timestamped into an append-only
    event log that cannot be edited or deleted (corrections are appended, never
    overwritten). The Dealer's dashboard is computed exclusively from that log.

## 4. Connecting the Dealer's enquiry flow

4.1 The Dealer authorises the Platform to receive buyer enquiries addressed to
    the Dealer via: (a) enquiry forms on the Dealer's UsedCarsNZ listings; and
    (b) the Dealer's dedicated lead email address on the Platform's domain, to
    which the Dealer (or its listing provider, e.g. Trade Me) directs or
    forwards enquiry emails, as set out in Schedule B.

4.2 The Dealer confirms it is entitled to direct those enquiries to the
    Platform. **[LAWYER: does redirecting Trade Me enquiry notification emails
    to a third-party processor raise any issue under Trade Me's dealer terms?
    The Dealer, not the Platform, holds the Trade Me relationship.]**

4.3 The Dealer will nominate at least one authorised user responsible for
    reviewing and approving draft replies during business hours.

## 5. Privacy and data processing

5.1 **Roles.** For buyer personal information handled in the pilot, the
    **Dealer is the agency** collecting the information (Privacy Act 2020), and
    the **Platform processes it on the Dealer's behalf** to operate the
    service. **[LAWYER: confirm agency/processor characterisation and whether
    an information-sharing or processor clause needs particular form.]**

5.2 **What is processed:** the buyer's name, contact details, message content,
    the vehicle enquired about, conversation history with the labelled AI
    assistant and the Dealer, and request metadata used for security.

5.3 **Purposes only:** delivering enquiries to the Dealer; sending the
    acknowledgment; qualifying the lead; preparing drafts for Dealer approval;
    computing response-time and conversion metrics; security and abuse
    prevention. No sale of personal information. No marketing use.

5.4 **Retention.** Raw inbound enquiry **emails** are kept for a maximum of
    **30 days** (for delivery/parsing diagnosis) and then automatically
    deleted by a scheduled job. The structured enquiry record and conversation
    are retained so the Dealer can serve the buyer. **[LAWYER: confirm a
    retention period for the structured record and post-termination handling —
    note the event log is append-only by design; deletion requests are honoured
    by de-identification rather than log mutation.]**

5.5 **Sub-processors.** The Platform uses Cloudflare (hosting, email routing),
    Supabase (database, storage) and Resend (outbound email). The Platform
    remains responsible for them.

5.6 **Buyer rights.** Access/correction requests from buyers received by
    either party will be notified to the other and handled by the Dealer as
    agency, with the Platform's assistance.

5.7 **Breach.** Each party will notify the other without undue delay of any
    privacy breach affecting pilot data and cooperate on any notifiable-breach
    assessment (Privacy Act 2020, Part 6). **[LAWYER: confirm notification
    timeframe wording.]**

## 6. The Dealer's authorisations

The Dealer authorises the Platform, for the pilot term, to:

(a) receive and process buyer enquiries under clause 4;
(b) send the templated acknowledgment to buyers on the Dealer's behalf;
(c) operate the labelled AI assistant to qualify buyers and prepare drafts;
(d) send to buyers **only** those substantive replies a Dealer-authorised user
    has approved; and
(e) record all of the above in the event log and compute metrics from it.

## 7. The Dealer's responsibilities

7.1 The Dealer remains solely responsible for its listings' content and its
    statutory obligations as a motor vehicle trader — including Fair Trading
    Act 1986 accuracy, Consumer Guarantees Act 1993 compliance, in-trade
    disclosure and the Consumer Information Notice on each listing.

7.2 The Dealer is responsible for the content of every draft it approves. An
    approved draft is the Dealer's statement, not the Platform's.
    **[LAWYER: liability allocation between platform-generated draft and
    dealer approval — the key clause; see also clause 11.]**

7.3 The Dealer will review pending drafts at least each business day, so the
    pilot measures the service rather than an unattended inbox.

## 8. Metrics, publication and honesty

8.1 The Dealer's per-dealer dashboard is visible to the Dealer and the
    Platform only.

8.2 The Platform may publish **aggregate, anonymised** metrics (e.g. platform
    median first-response time). It will not publish metrics identifying the
    Dealer without the Dealer's prior written consent.

8.3 The Platform will never present sample, seeded or simulated numbers as
    measured results, and will label any demonstration data as sample data.

8.4 The Dealer may use its own dashboard figures in its own marketing,
    provided they are quoted accurately.

## 9. Baseline measurement

9.1 The pilot's purpose is a fair before/after comparison. The baseline is
    captured per Schedule A **before** the AI assistant is switched on for the
    Dealer.

9.2 The Dealer will cooperate with the chosen baseline method (Schedule A) and
    warrants that any self-reported figures it provides are honest estimates.

## 10. Ending the pilot

10.1 On termination or expiry: the Platform stops receiving new enquiries for
     the Dealer; in-flight buyer conversations are handed to the Dealer.

10.2 On the Dealer's written request, the Platform will delete or de-identify
     the buyer personal information it processed for the Dealer, except that
     append-only event-log entries are retained in de-identified form and
     aggregate metrics already published remain published.
     **[LAWYER: confirm this de-identification approach satisfies IPP 9 and
     deletion expectations.]**

## 11. Liability

11.1 The pilot service is provided free and "as is". The Platform does not
     warrant uninterrupted operation.

11.2 Each party's total liability under the pilot is capped at **NZD [1,000]**,
     and neither party is liable for indirect or consequential loss.
     **[LAWYER: cap amount and carve-outs (privacy breach? approved-content
     liability per 7.2?) need advice — placeholder only.]**

11.3 Nothing in this agreement limits either party's statutory obligations to
     consumers, which cannot be contracted out of.

## 12. Confidentiality

12.1 Each party will keep the other's non-public information confidential
     (including the Dealer's lead volumes and the Platform's product details),
     except as required by law. Clause 8 governs metrics publication.

## 13. General

13.1 This agreement is governed by New Zealand law.
13.2 It may be varied only in writing signed by both parties.
13.3 Neither party may assign it without the other's consent.
13.4 It is the entire agreement for the pilot.
13.5 Notices may be given by email to the addresses below.

---

**SIGNED**

| | Inspiral NZ Limited | The Dealer |
|---|---|---|
| Name | | |
| Position | | |
| Email (notices) | | |
| Signature | | |
| Date | | |

---

## Schedule A — Baseline method *(select ONE before Go-Live — Strategy v5.7 §5 ⚠ FOUNDER DECISION)*

- [ ] **(a) Mystery-shop baseline.** Before Go-Live, the Platform submits 3–5
  genuine enquiries to the Dealer's live listings on the Dealer's existing
  channels and records actual first-response times. The Dealer consents to
  this measurement and will not treat those enquiries differently.
  *(Measures first-response directly; appointment baseline from 9.2
  self-report.)*
- [ ] **(b) Quiet-period baseline.** For [2–4] weeks from Go-Live, enquiries
  are ingested and logged but the AI assistant stays off; the Dealer BCCs (or
  auto-forwards) its own replies to its lead address so real response times
  and outcomes are computed from the log.
- [ ] **(c) Self-reported baseline.** The Dealer provides its honest estimate
  of current typical first-response time and enquiry-to-appointment rate,
  recorded here and labelled self-reported in all comparisons:
  first response: [ ] · enquiries → appointments: [ ]%.

## Schedule B — Connection details

| Item | Value |
|---|---|
| Dealer lead address on the Platform | `lead-[dealer]@usedcarsnz.co.nz` |
| Enquiry sources routed to it | e.g. Trade Me enquiry notifications, dealer website form |
| Dealer-authorised approving users (name + email) | |
| Dealer notices email | |
| Go-Live Date (AI on) | |

---

*Draft prepared 19 July 2026 against the system as built (Strategy v5.7 §§3, 5,
7, 9; `docs/architecture.md`). Not legal advice. For solicitor review — the
[LAWYER: …] markers are the specific questions to resolve.*
